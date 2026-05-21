/**
 * Cliente HTTP que conhece autenticação:
 *   - Adiciona Authorization: Bearer <token> em cada request quando há access token.
 *   - Inclui o cookie de refresh (credentials: 'include') para o /auth/refresh.
 *   - Em 401, tenta um único refresh transparente e refaz a request original.
 *
 * O access token vive em memória, dentro do AuthProvider — este módulo é
 * stateless. Quem chama, passa o token corrente; quando o refresh atualiza,
 * o AuthProvider re-renderiza e chama de novo com o novo token.
 *
 * NÃO use este módulo em server components — ele depende de `fetch` com
 * cookies do browser. Em RSC use os fetchers em `lib/api.ts`.
 */

import { decodeJwt, jwtExpiraLogo } from './jwt';

export interface ApiClientOptions {
  accessToken: string | null;
  onAccessToken: (novo: string) => void;
  onSessionPerdida: () => void;
}

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** Para upload multipart. Se setado, ignora `body`. */
  formData?: FormData;
}

export function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
}

export async function apiFetch<T>(opts: ApiClientOptions, req: ApiRequest): Promise<T> {
  let token = opts.accessToken;

  // Pre-emptive refresh: se o JWT tá quase expirando, refresha antes de tentar.
  if (token) {
    const payload = decodeJwt(token);
    if (payload && jwtExpiraLogo(payload, 30)) {
      try {
        token = await refresh(opts);
      } catch {
        // Deixa cair no fluxo abaixo — pode ser que a request seja pública.
      }
    }
  }

  const tentar = async (bearerToken: string | null): Promise<Response> => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
    if (!req.formData && req.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    return fetch(`${baseUrl()}${req.path}`, {
      method: req.method ?? 'GET',
      headers,
      credentials: 'include',
      ...(req.formData
        ? { body: req.formData }
        : req.body !== undefined
          ? { body: JSON.stringify(req.body) }
          : {}),
      cache: 'no-store',
    });
  };

  let r = await tentar(token);

  if (r.status === 401 && token !== null) {
    // Tenta refresh uma vez. Se falhar, sessão perdida.
    try {
      const novoToken = await refresh(opts);
      r = await tentar(novoToken);
    } catch {
      opts.onSessionPerdida();
      throw new Error('Sessão expirada.');
    }
  }

  if (!r.ok) {
    const corpo = await r.text();
    const erro = new Error(`API ${req.method ?? 'GET'} ${req.path} → ${r.status}: ${corpo.slice(0, 200)}`);
    (erro as unknown as { status: number }).status = r.status;
    throw erro;
  }

  // Endpoints 204 / sem corpo.
  if (r.status === 204) return undefined as T;
  const ct = r.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return (await r.text()) as unknown as T;
  }
  return (await r.json()) as T;
}

/**
 * Chama POST /auth/refresh usando o cookie HttpOnly. Notifica o caller via
 * `onAccessToken` e devolve o token novo para a chamada que disparou o refresh.
 */
async function refresh(opts: ApiClientOptions): Promise<string> {
  const r = await fetch(`${baseUrl()}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  if (!r.ok) {
    throw new Error('Refresh falhou.');
  }
  const json = (await r.json()) as { accessToken?: string };
  if (!json.accessToken) throw new Error('Refresh sem accessToken.');
  opts.onAccessToken(json.accessToken);
  return json.accessToken;
}
