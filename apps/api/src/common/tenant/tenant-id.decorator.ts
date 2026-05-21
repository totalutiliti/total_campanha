import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../../modules/auth/jwt-payload.type.js';

/**
 * Retorna o tenantId do JWT validado pelo JwtAuthGuard.
 *
 * - Lança 401 se não houver user no request (handler exposto sem JwtAuthGuard).
 * - Lança 403 se o JWT for "pending" (user multi-tenant que ainda não escolheu) —
 *   o cliente deve chamar /auth/select-tenant antes de acessar recursos.
 *
 * Ver docs/SKILL.md seção 9.
 */
export const TenantId = createParamDecorator((_, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
  const user = req.user;
  if (!user) throw new UnauthorizedException('Usuário não autenticado.');
  if (!user.tid) {
    throw new ForbiddenException('Tenant não selecionado. Chame /auth/select-tenant.');
  }
  return user.tid;
});
