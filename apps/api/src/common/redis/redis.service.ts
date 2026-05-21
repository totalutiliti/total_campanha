import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { env } from '../../config/config.module.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(env(config, 'REDIS_URL'), {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('Redis conectado');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async ping(): Promise<'PONG'> {
    const r = await this.client.ping();
    return r as 'PONG';
  }
}
