import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

import { env } from '../../config/config.module.js';

/**
 * Rate limiting.
 *
 * Existe UM throttler global: `default` (60 req/min/IP) — aplica-se a toda rota.
 *
 * Rotas sensíveis (login, signup, forgot, reset — RULES 3.4) NÃO usam um
 * throttler separado: elas SOBRESCREVEM o `default` com um limite estrito via
 * `@Throttle({ default: { limit: RATE_LIMIT_AUTH_MAX, ttl: janela } })`.
 *
 * Por que não um throttler nomeado `auth`: o @nestjs/throttler aplica TODOS os
 * throttlers do array a TODAS as rotas; um `auth` global limitaria a API
 * inteira a 5/15min. `@Throttle` só troca a config, não o escopo.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = new Redis(env(config, 'REDIS_URL'), { maxRetriesPerRequest: null });
        return {
          throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
          storage: new ThrottlerStorageRedisService(redis),
        };
      },
    }),
  ],
  exports: [ThrottlerModule],
})
export class AppThrottlerModule {}
