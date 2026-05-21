import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from './jwt-payload.type.js';

/**
 * Retorna o user do JWT validado pelo JwtAuthGuard. Lança 401 se ausente —
 * indica que o handler foi exposto sem o guard, o que é bug.
 */
export const CurrentUser = createParamDecorator((_, ctx: ExecutionContext): AuthenticatedUser => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
  if (!req.user) throw new UnauthorizedException('Usuário não autenticado.');
  return req.user;
});
