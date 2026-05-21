import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { TokenService } from './token.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { AuthenticatedUser } from './jwt-payload.type.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente.');
    }
    const token = header.slice('Bearer '.length).trim();
    const payload = await this.tokens.verificarAccessToken(token);

    req.user = {
      sub: payload.sub,
      tid: payload.tid,
      role: payload.role,
      aud: payload.aud,
    };
    return true;
  }
}
