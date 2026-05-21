import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TokenService } from '../auth/token.service.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.type.js';

/**
 * Guarda do escopo Super Admin (/admin).
 *
 * Exige um JWT com `aud: 'super-admin'` E que o usuário ainda tenha
 * `isSuperAdmin = true` no banco (defesa: revogação imediata mesmo com token
 * válido). Nunca tem `tid` — Super Admin é cross-tenant via BYPASSRLS.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente.');
    }
    const payload = await this.tokens.verificarAccessToken(header.slice(7).trim());
    if (payload.aud !== 'super-admin') {
      throw new ForbiddenException('Token não é de Super Admin.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isSuperAdmin) {
      throw new ForbiddenException('Usuário não é Super Admin.');
    }

    req.user = { sub: payload.sub, tid: null, role: null, aud: 'super-admin' };
    return true;
  }
}
