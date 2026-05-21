import type { Role } from '@total-campanha/shared';

/**
 * Payload do access token.
 *
 * - `sub`: userId
 * - `tid`: tenantId atualmente selecionado (pode ser null logo após /auth/login
 *          se o user pertence a múltiplos tenants — nesse caso precisa
 *          chamar /auth/select-tenant para gerar um access token completo)
 * - `role`: papel do user neste tenant
 * - `aud`: 'tenant' (padrão) | 'super-admin' (escopo /admin)
 */
export interface AccessTokenPayload {
  sub: string;
  tid: string | null;
  role: Role | null;
  aud: 'tenant' | 'super-admin';
}

export interface RefreshTokenPayload {
  sub: string;
  // Identificador único do refresh token (jti) — usado para invalidação
  // individual e detecção de reuse (rotation).
  jti: string;
  // Família do token — todos os refresh tokens da mesma sessão compartilham
  // family. Se um refresh já consumido for re-apresentado, invalidamos a família inteira.
  fam: string;
  // Tenant selecionado na sessão. Preservado entre rotations para que o
  // /auth/refresh re-emita o access token com o mesmo tenant (sem isso, todo
  // boot do app perderia o tenant e cairia na tela de escolha).
  tid: string | null;
}

/**
 * Estende req.user com nossos campos (usado por decorators @TenantId, @CurrentUser).
 */
export interface AuthenticatedUser {
  sub: string;
  tid: string | null;
  role: Role | null;
  aud: 'tenant' | 'super-admin';
}
