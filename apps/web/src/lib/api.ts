/**
 * Cliente fetch mínimo apontando para a API NestJS.
 *
 * Em SSR (server components), o `process.env.API_BASE_URL` é usado (rede
 * interna). No cliente, `NEXT_PUBLIC_API_URL` precisa estar setado.
 */
function baseUrl(): string {
  if (typeof window === 'undefined') {
    return (process.env.API_BASE_URL ?? 'http://localhost:3001') + '/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${baseUrl()}${path}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
  if (!r.ok) {
    throw new Error(`API GET ${path} → ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export async function apiPostPublic<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!r.ok) {
    const erro = await r.text();
    throw new Error(`API POST ${path} → ${r.status} ${erro}`);
  }
  return r.json() as Promise<T>;
}
