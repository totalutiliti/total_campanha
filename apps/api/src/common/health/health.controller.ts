import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  live(): { ok: true; ts: string } {
    return { ok: true, ts: new Date().toISOString() };
  }

  @Get('ready')
  async ready(): Promise<{ ok: true; db: 'up'; redis: 'up' }> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ db: 'down' });
    }
    try {
      await this.redis.ping();
    } catch {
      throw new ServiceUnavailableException({ redis: 'down' });
    }
    return { ok: true, db: 'up', redis: 'up' };
  }
}
