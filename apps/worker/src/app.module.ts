import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { loadEnv } from './config/env.js';
import { CryptoService } from './common/crypto.service.js';
import { MailService } from './common/mail.service.js';
import { PrismaService } from './common/prisma.service.js';
import { UsageService } from './common/usage.service.js';
import { MetaWhatsappClient } from './integrations/meta-whatsapp.client.js';
import { WorkerSesIdentityClient } from './integrations/ses-identity.client.js';
import { DispatchEmailProcessor } from './processors/dispatch-email.processor.js';
import { DispatchWhatsappProcessor } from './processors/dispatch-whatsapp.processor.js';
import { ImportarContatosProcessor } from './processors/importar-contatos.processor.js';
import { RetryProcessor } from './processors/retry.processor.js';
import { TrialProcessor } from './processors/trial.processor.js';
import { VerificarEmailsProcessor } from './processors/verificar-emails.processor.js';
import { WebhookMetaProcessor } from './processors/webhook-meta.processor.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: (raw) => loadEnv(raw) }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const prefix = config.get<string>('BULLMQ_PREFIX') ?? 'tc';
        return {
          connection: { url: redisUrl },
          prefix,
          defaultJobOptions: {
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 24 * 3600 },
            attempts: 1,
          },
        };
      },
    }),
    // Filas que este worker consome.
    BullModule.registerQueue(
      { name: 'contatos-importar' },
      { name: 'conexoes-verificar-email' },
      { name: 'dispatch-email' },
      { name: 'dispatch-whatsapp' },
      { name: 'dispatch-retry' },
      { name: 'webhook-meta' },
      { name: 'billing-trial' },
    ),
  ],
  providers: [
    // Infra
    PrismaService,
    CryptoService,
    MailService,
    UsageService,
    MetaWhatsappClient,
    WorkerSesIdentityClient,
    // Processors
    ImportarContatosProcessor,
    VerificarEmailsProcessor,
    DispatchEmailProcessor,
    DispatchWhatsappProcessor,
    WebhookMetaProcessor,
    RetryProcessor,
    TrialProcessor,
  ],
})
export class AppModule {}
