import * as crypto from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Queue } from 'bullmq';

import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Public } from '../auth/public.decorator.js';

/**
 * Webhook da Meta Cloud API por tenant (SPECS seção 2 — Webhooks).
 *
 * - GET  /webhooks/meta/:tenantSlug/:secret — handshake de verificação da Meta.
 * - POST /webhooks/meta/:tenantSlug/:secret — eventos (status + mensagens in).
 *
 * Autenticação: o `secret` no path é o `webhookSecret` por tenant (random 32
 * bytes, gerado ao conectar). Sem App Secret por tenant não há como validar
 * X-Hub-Signature-256 — o segredo na URL é a mitigação: o slug é público
 * (aparece na página de opt-in), o secret não. POST com secret errado responde
 * 200 sem enfileirar (não dá oráculo a atacante; a Meta real nunca erra a URL
 * que o próprio tenant configurou). Handshake errado falha alto (403) para o
 * tenant perceber configuração errada na hora.
 *
 * `@SkipThrottle`: callbacks de status chegam em rajada (1 por mensagem
 * enviada) — o throttle global de 60/min derrubaria campanhas reais e a Meta
 * desabilita webhooks que respondem 429.
 *
 * O POST NÃO processa síncrono (Meta tem timeout de 5s): apenas enfileira em
 * `webhook-meta` e responde 200 imediatamente.
 */
@ApiTags('webhooks')
@SkipThrottle()
@Controller('webhooks/meta')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhook-meta') private readonly fila: Queue,
  ) {}

  @Public()
  @Get(':tenantSlug/:secret')
  async verificar(
    @Param('tenantSlug') slug: string,
    @Param('secret') secret: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): Promise<string> {
    const conexao = await this.conexaoDoSlug(slug);
    if (
      mode === 'subscribe' &&
      conexao &&
      igualTimingSafe(secret, conexao.webhookSecret) &&
      igualTimingSafe(verifyToken, conexao.webhookSecret)
    ) {
      // Meta espera o challenge cru no corpo.
      return challenge;
    }
    throw new ForbiddenException('verify_token inválido.');
  }

  @Public()
  @Post(':tenantSlug/:secret')
  async receber(
    @Param('tenantSlug') slug: string,
    @Param('secret') secret: string,
    @Body() payload: unknown,
  ): Promise<{ ok: true }> {
    const conexao = await this.conexaoDoSlug(slug);
    if (!conexao || !igualTimingSafe(secret, conexao.webhookSecret)) {
      // 200 sem enfileirar: não confirma a existência do tenant/segredo e a
      // Meta não fica reenviando. O log fica para diagnóstico.
      this.logger.warn({ msg: 'webhook_meta_rejeitado', slug });
      return { ok: true };
    }
    if (typeof payload !== 'object' || payload === null) {
      throw new BadRequestException('Payload inválido.');
    }
    await this.fila.add('processar', { tenantId: conexao.tenantId, payload });
    return { ok: true };
  }

  private async conexaoDoSlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) return null;
    return this.prisma.runInTenant(tenant.id, (tx) =>
      tx.conexaoWhatsapp.findUnique({ where: { tenantId: tenant.id } }),
    );
  }
}

function igualTimingSafe(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
