'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { apiFetch, baseUrl, ApiRequest } from './api-client';

export type Role = 'ADMIN' | 'EDITOR_CAMPANHA' | 'VISUALIZADOR';

export interface TenantInfo {
  id: string;
  slug: string;
  razaoSocial: string;
  plano: string;
  status: string;
  role: Role;
}

export interface MeResponse {
  id: string;
  email: string;
  has2fa: boolean;
  isSuperAdmin: boolean;
  role: Role | null;
  tenantAtual: TenantInfo | null;
  tenants: TenantInfo[];
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'anonimo' }
  | { tipo: 'precisa-escolher-tenant'; accessToken: string; tenants: TenantInfo[] }
  | { tipo: 'autenticado'; accessToken: string; me: MeResponse };

interface ContextoAuth {
  estado: Estado;
  /** Login com email/senha. Retorna `'2fa'` quando o user precisa fornecer o código. */
  login: (email: string, senha: string, totp?: string) => Promise<'ok' | '2fa' | 'multi-tenant'>;
  /** Após login, escolhe um tenant. */
  selecionarTenant: (tenantId: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Atalho para fazer chamadas autenticadas a partir de componentes —
   * já injeta accessToken e refresh automático.
   */
  api: <T>(req: ApiRequest) => Promise<T>;
}

const Ctx = createContext<ContextoAuth | null>(null);

export function useAuth(): ContextoAuth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  // Mantemos o token também numa ref para o api-client acessar dentro do mesmo
  // ciclo de render sem closure desatualizada.
  const tokenRef = useRef<string | null>(null);

  // -------------------------------------------------------------------------
  // Boot: tenta refresh com o cookie HttpOnly. Se ok, carrega /me.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch(`${baseUrl()}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!r.ok) {
          if (!cancelado) setEstado({ tipo: 'anonimo' });
          return;
        }
        const { accessToken } = (await r.json()) as { accessToken: string };
        if (cancelado) return;
        tokenRef.current = accessToken;

        // /auth/refresh atualmente devolve access token sem tid. Precisa /me
        // para saber tenant atual + lista. Se /me retorna tenantAtual=null,
        // entra em modo "escolher tenant".
        const me = await fetchMe(accessToken);
        if (cancelado) return;

        if (!me.tenantAtual && me.tenants.length > 0) {
          setEstado({ tipo: 'precisa-escolher-tenant', accessToken, tenants: me.tenants });
        } else if (me.tenantAtual) {
          setEstado({ tipo: 'autenticado', accessToken, me });
        } else {
          // User sem nenhum tenant ativo — força logout silencioso.
          setEstado({ tipo: 'anonimo' });
        }
      } catch {
        if (!cancelado) setEstado({ tipo: 'anonimo' });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // -------------------------------------------------------------------------
  // api: wrapper que injeta accessToken + refresh automático.
  // -------------------------------------------------------------------------
  const api = useCallback(<T,>(req: ApiRequest): Promise<T> => {
    return apiFetch<T>(
      {
        accessToken: tokenRef.current,
        onAccessToken: (novo) => {
          tokenRef.current = novo;
          setEstado((atual) => {
            if (atual.tipo === 'autenticado') return { ...atual, accessToken: novo };
            if (atual.tipo === 'precisa-escolher-tenant') return { ...atual, accessToken: novo };
            return atual;
          });
        },
        onSessionPerdida: () => {
          tokenRef.current = null;
          setEstado({ tipo: 'anonimo' });
        },
      },
      req,
    );
  }, []);

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------
  const login = useCallback(
    async (
      email: string,
      senha: string,
      totp?: string,
    ): Promise<'ok' | '2fa' | 'multi-tenant'> => {
      const r = await fetch(`${baseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, senha, ...(totp ? { totp } : {}) }),
      });
      if (!r.ok) {
        const corpo = await r.text();
        throw new Error(corpo || `Falha no login (${r.status})`);
      }
      const json = (await r.json()) as {
        accessToken: string;
        precisa2fa?: true;
        precisaEscolherTenant?: { tenants: TenantInfo[] };
      };

      if (json.precisa2fa) {
        return '2fa';
      }

      tokenRef.current = json.accessToken;

      if (json.precisaEscolherTenant) {
        setEstado({
          tipo: 'precisa-escolher-tenant',
          accessToken: json.accessToken,
          tenants: json.precisaEscolherTenant.tenants.map((t) => ({
            ...t,
            // POST /auth/login devolve só id/slug/razaoSocial — o `role` virá no /me após select.
            plano: '',
            status: 'ATIVO',
            role: 'VISUALIZADOR' as Role,
          })),
        });
        return 'multi-tenant';
      }

      const me = await fetchMe(json.accessToken);
      setEstado({ tipo: 'autenticado', accessToken: json.accessToken, me });
      return 'ok';
    },
    [],
  );

  // -------------------------------------------------------------------------
  // selecionarTenant
  // -------------------------------------------------------------------------
  const selecionarTenant = useCallback(async (tenantId: string) => {
    const r = await fetch(`${baseUrl()}/auth/select-tenant`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ tenantId }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || `Falha ao selecionar tenant (${r.status})`);
    }
    const json = (await r.json()) as { accessToken: string };
    tokenRef.current = json.accessToken;
    const me = await fetchMe(json.accessToken);
    setEstado({ tipo: 'autenticado', accessToken: json.accessToken, me });
  }, []);

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      await fetch(`${baseUrl()}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // silencioso
    }
    tokenRef.current = null;
    setEstado({ tipo: 'anonimo' });
  }, []);

  const valor = useMemo<ContextoAuth>(
    () => ({ estado, login, selecionarTenant, logout, api }),
    [estado, login, selecionarTenant, logout, api],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

async function fetchMe(accessToken: string): Promise<MeResponse> {
  const r = await fetch(`${baseUrl()}/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    credentials: 'include',
  });
  if (!r.ok) throw new Error(`Falha em /me (${r.status})`);
  return (await r.json()) as MeResponse;
}
