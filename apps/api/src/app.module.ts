import { Module } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';

import { AuditModule } from './common/audit/audit.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { HealthModule } from './common/health/health.module.js';
import { IntegrationsModule } from './common/integrations/integrations.module.js';
import { MailModule } from './common/mail/mail.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { AppQueueModule } from './common/queue/queue.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { AppThrottlerModule } from './common/throttler/throttler.module.js';
import { UsageModule } from './common/usage/usage.module.js';
import { AppConfigModule } from './config/config.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CampanhasModule } from './modules/campanhas/campanhas.module.js';
import { ConexoesModule } from './modules/conexoes/conexoes.module.js';
import { ContatosModule } from './modules/contatos/contatos.module.js';
import { InboxModule } from './modules/inbox/inbox.module.js';
import { PublicModule } from './modules/public/public.module.js';
import { SegmentosModule } from './modules/segmentos/segmentos.module.js';
import { SuperAdminModule } from './modules/super-admin/super-admin.module.js';
import { TemplatesModule } from './modules/templates/templates.module.js';
import { TenantsModule } from './modules/tenants/tenants.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        // pino-http já redacta cookies e Authorization headers por padrão quando
        // configurado — adicionar campos sensíveis aqui se aparecerem.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.senha',
            'req.body.novaSenha',
            'req.body.token',
            'req.body.appSecret',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    PrismaModule,
    RedisModule,
    AppQueueModule,
    AppThrottlerModule,
    AuditModule,
    CryptoModule,
    IntegrationsModule,
    MailModule,
    UsageModule,
    HealthModule,

    AuthModule,
    UsersModule,
    TenantsModule,
    ContatosModule,
    SegmentosModule,
    TemplatesModule,
    CampanhasModule,
    ConexoesModule,
    InboxModule,
    AnalyticsModule,
    BillingModule,
    WebhooksModule,
    SuperAdminModule,
    PublicModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
