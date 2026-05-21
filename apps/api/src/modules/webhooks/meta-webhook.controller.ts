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
import type { Queue } from 'bullmq';

import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

/**
 * Webhook da Meta Cloud API por tenant (SPECS seção 2 — Webhooks).
 *
 * - GET  /webhooks/meta/:tenantSlug — handshake de verificação da Meta.
 * - POST /webhooks/meta/:tenantSlug — eventos (status updates + mensagens in).
 *
 * O POST NÃO processa síncrono (Meta tem timeout de 5s): apenas enfileira em
 * `webhook-meta` e responde 200 imediatamente. Retornamos 200 mesmo quando o
 * tenant não existe, para a Meta não ficar reenviando indefinidamente.
 */
@ApiTags('webhooks')
@Controller('webhooks/meta')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhook-meta') private readonly fila: Queue,
  ) {}

  @Public()
  @Get(':tenantSlug')
  async verificar(
    @Param('tenantSlug') slug: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new ForbiddenException();

    const conexao = await this.prisma.runInTenant(tenant.id, (tx) =>
      tx.conexaoWhatsapp.findUnique({ where: { tenantId: tenant.id } }),
    );
    if (mode === 'subscribe' && conexao && verifyToken === conexao.webhookSecret) {
      // Meta espera o challenge cru no corpo.
      return challenge;
    }
    throw new ForbiddenException('verify_token inválido.');
  }

  @Public()
  @Post(':tenantSlug')
  async receber(
    @Param('tenantSlug') slug: string,
    @Body() payload: unknown,
  ): Promise<{ ok: true }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      // 200 para a Meta não reenviar — mas não enfileira.
      this.logger.warn({ msg: 'webhook_meta_tenant_inexistente', slug });
      return { ok: true };
    }
    if (typeof payload !== 'object' || payload === null) {
      throw new BadRequestException('Payload inválido.');
    }
    await this.fila.add('processar', { tenantId: tenant.id, payload });
    return { ok: true };
  }
}
