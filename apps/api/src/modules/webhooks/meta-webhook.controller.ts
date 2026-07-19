import * as crypto from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Queue } from 'bullmq';
import type { Request } from 'express';

import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Public } from '../auth/public.decorator.js';

import { assinaturaHmacValida, igualTimingSafe } from './meta-webhook-signature.js';

/**
 * Webhook da Meta Cloud API por tenant (SPECS seção 2 — Webhooks).
 *
 * - GET  /webhooks/meta/:tenantSlug/:secret — handshake de verificação da Meta.
 * - POST /webhooks/meta/:tenantSlug/:secret — eventos (status + mensagens in).
 *
 * O secret no path serve para roteamento e handshake. Todo POST é autenticado
 * criptograficamente por X-Hub-Signature-256, usando o App Secret cifrado do
 * app Meta do tenant. Payloads válidos são deduplicados antes da fila.
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
    private readonly cryptoService: CryptoService,
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
  @HttpCode(HttpStatus.OK)
  async receber(
    @Param('tenantSlug') slug: string,
    @Param('secret') secret: string,
    @Body() payload: unknown,
    @Headers('x-hub-signature-256') assinatura: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ ok: true }> {
    const conexao = await this.conexaoDoSlug(slug);
    if (!conexao || !igualTimingSafe(secret, conexao.webhookSecret)) {
      // 200 sem enfileirar: não confirma a existência do tenant/segredo e a
      // Meta não fica reenviando. O log fica para diagnóstico.
      this.logger.warn({ msg: 'webhook_meta_rejeitado', slug });
      return { ok: true };
    }
    if (!conexao.appSecretEncrypted || conexao.appSecretEncrypted.length === 0 || !req.rawBody) {
      this.logger.warn({ msg: 'webhook_meta_sem_material_hmac', slug });
      return { ok: true };
    }
    const appSecret = await this.cryptoService.decryptToken(conexao.appSecretEncrypted);
    if (!assinaturaHmacValida(req.rawBody, assinatura, appSecret)) {
      this.logger.warn({ msg: 'webhook_meta_hmac_invalido', slug });
      return { ok: true };
    }
    if (typeof payload !== 'object' || payload === null) {
      throw new BadRequestException('Payload inválido.');
    }

    const eventoHash = crypto.createHash('sha256').update(req.rawBody).digest('hex');
    const evento = await this.prisma.runInTenant(conexao.tenantId, (tx) =>
      tx.webhookEvento.upsert({
        where: {
          tenantId_provedor_eventoHash: {
            tenantId: conexao.tenantId,
            provedor: 'META',
            eventoHash,
          },
        },
        create: { tenantId: conexao.tenantId, provedor: 'META', eventoHash },
        update: {},
      }),
    );
    if (evento.processadoEm) return { ok: true };

    await this.fila.add(
      'processar',
      { tenantId: conexao.tenantId, eventoId: evento.id, payload },
      { jobId: `meta-${eventoHash}`, attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
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
