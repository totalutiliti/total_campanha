import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { env } from '../../config/config.module.js';

/**
 * Conexão BullMQ compartilhada com o worker (apps/worker).
 *
 * Filas registradas neste módulo (declaradas em `BullModule.registerQueue`):
 *   - 'contatos-importar' (Fase 2.1) — imports CSV grandes (>SYNC_LIMITE)
 *   - 'dispatch-email'    (Fase 5.2)
 *   - 'dispatch-whatsapp' (Fase 5.2)
 *   - 'webhook-meta'      (Fase 5.2)
 *
 * Cada módulo de domínio injeta a fila via @InjectQueue('<nome>').
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: env(config, 'REDIS_URL') },
        prefix: env(config, 'BULLMQ_PREFIX'),
        defaultJobOptions: {
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 24 * 3600 },
          attempts: 1,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'contatos-importar' },
      { name: 'dispatch-email' },
      { name: 'dispatch-whatsapp' },
      { name: 'webhook-meta' },
    ),
  ],
  exports: [BullModule],
})
export class AppQueueModule {}
