import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module.js';

import { AsaasWebhookController } from './asaas-webhook.controller.js';
import { MetaWebhookController } from './meta-webhook.controller.js';

/**
 * WebhooksModule — endpoints públicos que recebem callbacks externos.
 * Meta (WhatsApp) e Asaas (billing) implementados; SES (bounces) entra futuro.
 */
@Module({
  imports: [BillingModule, BullModule.registerQueue({ name: 'webhook-meta' })],
  controllers: [MetaWebhookController, AsaasWebhookController],
})
export class WebhooksModule {}
