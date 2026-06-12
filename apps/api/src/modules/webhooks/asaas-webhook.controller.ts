import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';

import { env } from '../../config/config.module.js';
import { Public } from '../auth/public.decorator.js';
import { BillingService } from '../billing/billing.service.js';

interface AsaasWebhookBody {
  event?: string;
  payment?: { subscription?: string };
  subscription?: { id?: string };
}

/**
 * Webhook do Asaas (billing). Valida o header `asaas-access-token` contra
 * `ASAAS_WEBHOOK_TOKEN`. FAIL-CLOSED: sem o token configurado, rejeita tudo —
 * um POST anônimo aqui mudaria status de billing de tenant (ativar sem pagar,
 * cancelar conta alheia). Em dev, configure o token no .env para testar.
 */
@ApiTags('webhooks')
@Controller('webhooks/asaas')
export class AsaasWebhookController {
  private readonly logger = new Logger(AsaasWebhookController.name);
  private readonly tokenEsperado: string | undefined;

  constructor(
    config: ConfigService,
    private readonly billing: BillingService,
  ) {
    this.tokenEsperado = env(config, 'ASAAS_WEBHOOK_TOKEN');
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receber(
    @Headers('asaas-access-token') token: string | undefined,
    @Body() body: AsaasWebhookBody,
  ): Promise<{ ok: true }> {
    if (!this.tokenEsperado) {
      this.logger.warn({ msg: 'webhook_asaas_rejeitado_token_nao_configurado' });
      throw new ForbiddenException('Webhook não configurado.');
    }
    if (token !== this.tokenEsperado) {
      throw new ForbiddenException('Token de webhook inválido.');
    }
    const evento = body.event ?? '';
    const subId = body.subscription?.id ?? body.payment?.subscription ?? null;
    await this.billing.processarWebhook(evento, subId);
    return { ok: true };
  }
}
