/**
 * Decode (sem verificar assinatura) o payload de um JWT.
 * Usado apenas para acessar `exp` / `tid` / `role` no frontend — o backend
 * verifica a assinatura em cada request.
 */
export interface AccessTokenPayload {
  sub: string;
  tid: string | null;
  role: 'ADMIN' | 'EDITOR_CAMPANHA' | 'VISUALIZADOR' | null;
  aud: 'tenant' | 'super-admin';
  exp: number; // segundos desde epoch
  iat: number;
}

export function decodeJwt(token: string): AccessTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const json =
      typeof atob === 'function'
        ? atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
        : Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(json) as AccessTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Margem de segurança: considera expirado N segundos antes do real `exp`,
 * para evitar race conditions (request sai válido mas chega expirado).
 */
export function jwtExpiraLogo(payload: AccessTokenPayload, margemSeg = 30): boolean {
  return payload.exp * 1000 - margemSeg * 1000 <= Date.now();
}
