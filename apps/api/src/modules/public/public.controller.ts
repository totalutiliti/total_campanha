import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '../auth/public.decorator.js';

import { OptInDto } from './dto/opt-in.dto.js';
import { OptInService } from './opt-in.service.js';
import { OptOutService } from './opt-out.service.js';

@ApiTags('public')
@Controller('p')
// Rate limit do bucket 'default' (60 req/min/IP) já se aplica por padrão.
// Reforça em /opt-in com janela menor para conter bots que furam reCAPTCHA.
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class PublicController {
  constructor(
    private readonly optIn: OptInService,
    private readonly optOut: OptOutService,
  ) {}

  @Public()
  @Get('opt-in/:tenantSlug')
  async paginaOptIn(@Param('tenantSlug') slug: string) {
    return this.optIn.dadosLanding(slug);
  }

  @Public()
  @Post('opt-in/:tenantSlug')
  async submeterOptIn(
    @Param('tenantSlug') slug: string,
    @Body() dto: OptInDto,
    @Req() req: Request,
  ) {
    return this.optIn.submeter(slug, dto, {
      ip: extrairIp(req),
      userAgent: (req.get('user-agent') ?? 'desconhecido').slice(0, 500),
    });
  }

  @Public()
  @Get('opt-out/:token')
  async submeterOptOut(@Param('token') token: string, @Req() req: Request) {
    return this.optOut.executar(token, {
      ip: extrairIp(req),
      userAgent: (req.get('user-agent') ?? 'desconhecido').slice(0, 500),
    });
  }

  /**
   * One-Click Unsubscribe (RFC 8058) — Gmail/Yahoo fazem POST direto na URL do
   * header List-Unsubscribe, sem abrir página. Mesmo efeito do GET.
   */
  @Public()
  @Post('opt-out/:token')
  async submeterOptOutOneClick(@Param('token') token: string, @Req() req: Request) {
    return this.optOut.executar(token, {
      ip: extrairIp(req),
      userAgent: (req.get('user-agent') ?? 'one-click').slice(0, 500),
    });
  }
}

function extrairIp(req: Request): string {
  // Em PROD atrás de proxy Azure, X-Forwarded-For chega. Pega o primeiro.
  const xff = req.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.ip ?? '0.0.0.0';
}
