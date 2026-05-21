import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@total-campanha/shared';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../../modules/auth/jwt-payload.type.js';

import { ROLES_KEY } from './roles.decorator.js';

/**
 * Garante que o role do JWT está na allowlist do handler.
 *
 * - Sem `@Roles(...)` no handler: NEGA (não há default permissivo — RULES 1).
 * - Com `@Roles(Role.ADMIN)`: aceita ADMIN; nega EDITOR_CAMPANHA/VISUALIZADOR.
 *
 * Não checa o tenant: o RLS no Postgres faz isso de forma definitiva.
 * O papel do guard aqui é só ortogonal: "este recurso requer ADMIN?".
 */
@Injectable()
export class TenantRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      throw new ForbiddenException('Handler sem @Roles — defina explicitamente.');
    }

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user) throw new UnauthorizedException('Usuário não autenticado.');
    if (!user.role) {
      throw new ForbiddenException('Tenant não selecionado.');
    }
    if (!rolesPermitidos.includes(user.role)) {
      throw new ForbiddenException('Role insuficiente.');
    }
    return true;
  }
}
