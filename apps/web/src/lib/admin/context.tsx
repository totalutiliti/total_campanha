'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { baseUrl } from '../auth/api-client';
import { decodeJwt } from '../auth/jwt';

/**
 * Contexto de autenticação do escopo Super Admin (/admin).
 *
 * É TOTALMENTE separado do AuthProvider do tenant:
 *  - O login é `POST /admin/auth/login` e devolve um JWT `aud='super-admin'`.
 *  - Esse escopo NÃO tem refresh cookie (o backend só emite o access token de
 *    15 min). Logo, sem renovação silenciosa: ao expirar (ou em 401/403), a
 *    sessão é encerrada e o guard manda para /admin/login.
 *  - O token vive em memória (ref) e é espelhado em `sessionStorage` só para
 *    sobreviver a um reload dentro da janela de 15 min. (Trade-off conhecido:
 *    token em sessionStorage tem exposição a XSS; aceitável para uma ferramenta
 *    interna de operador atrás de login dedicado.)
 */

const STORAGE_KEY = 'tc:admin:token';

export interface AdminApiRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Caminho relativo ao baseUrl, ex.: '/admin/tenants'. */
  path: string;
  body?: unknown;
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'anonimo' }
  | { tipo: 'autenticado'; token: string; email: string; expEm: number };

interface ContextoAdmin {
  estado: Estado;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  /** Chamada autenticada à API /admin. Em 401/403/expiração, encerra a sessão. */
  api: <T>(req: AdminApiRequest) => Promise<T>;
}

interface Persistido {
  token: string;
  email: string;
}

const Ctx = createContext<ContextoAdmin | null>(null);

export function useAdminAuth(): ContextoAdmin {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth deve ser usado dentro de <AdminAuthProvider>.');
  return ctx;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const tokenRef = useRef<string | null>(null);

  // Boot: recupera o token do sessionStorage (sobrevive a reload dentro dos 15min).
  useEffect(() => {
    try {
      const cru = sessionStorage.getItem(STORAGE_KEY);
      if (!cru) {
        setEstado({ tipo: 'anonimo' });
        return;
      }
      const p = JSON.parse(cru) as Persistido;
      const payload = decodeJwt(p.token);
      if (!payload || payload.aud !== 'super-admin' || payload.exp * 1000 <= Date.now()) {
        sessionStorage.removeItem(STORAGE_KEY);
        setEstado({ tipo: 'anonimo' });
        return;
      }
      tokenRef.current = p.token;
      setEstado({ tipo: 'autenticado', token: p.token, email: p.email, expEm: payload.exp * 1000 });
    } catch {
      setEstado({ tipo: 'anonimo' });
    }
  }, []);

  const encerrar = useCallback(() => {
    tokenRef.current = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // sessionStorage pode estar indisponível — ignora.
    }
    setEstado({ tipo: 'anonimo' });
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const r = await fetch(`${baseUrl()}/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (!r.ok) {
      // Mensagem genérica — não revela se o e-mail existe nem se é super admin.
      throw new Error('E-mail ou senha incorretos.');
    }
    const json = (await r.json()) as { accessToken?: string };
    if (!json.accessToken) throw new Error('Resposta de login inválida.');
    const payload = decodeJwt(json.accessToken);
    if (!payload || payload.aud !== 'super-admin') {
      throw new Error('Este acesso não é de Super Admin.');
    }
    tokenRef.current = json.accessToken;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: json.accessToken, email }));
    } catch {
      // segue sem persistir (sessão só em memória)
    }
    setEstado({
      tipo: 'autenticado',
      token: json.accessToken,
      email,
      expEm: payload.exp * 1000,
    });
  }, []);

  const api = useCallback(
    <T,>(req: AdminApiRequest): Promise<T> => {
      const token = tokenRef.current;
      const payload = token ? decodeJwt(token) : null;
      if (!token || !payload || payload.exp * 1000 <= Date.now()) {
        encerrar();
        return Promise.reject(new Error('Sessão expirada. Entre novamente.'));
      }

      const headers: Record<string, string> = {
        accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (req.body !== undefined) headers['content-type'] = 'application/json';

      return fetch(`${baseUrl()}${req.path}`, {
        method: req.method ?? 'GET',
        headers,
        ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {}),
        cache: 'no-store',
      }).then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          encerrar();
          throw new Error('Sessão expirada. Entre novamente.');
        }
        if (!r.ok) {
          const corpo = await r.text();
          let msg = corpo.slice(0, 300);
          try {
            const j = JSON.parse(corpo) as { message?: unknown };
            if (typeof j.message === 'string') msg = j.message;
            else if (Array.isArray(j.message)) msg = j.message.join(', ');
          } catch {
            // corpo não-JSON — usa o texto cru
          }
          const err = new Error(msg || `Erro ${r.status}`);
          (err as unknown as { status: number }).status = r.status;
          throw err;
        }
        if (r.status === 204) return undefined as T;
        const ct = r.headers.get('content-type') ?? '';
        if (!ct.includes('application/json')) return (await r.text()) as unknown as T;
        return (await r.json()) as T;
      });
    },
    [encerrar],
  );

  const valor = useMemo<ContextoAdmin>(
    () => ({ estado, login, logout: encerrar, api }),
    [estado, login, encerrar, api],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
