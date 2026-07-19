import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@total-campanha/db';

/**
 * Conexão privilegiada isolada para descobrir IDs em rotinas cross-tenant.
 * Nunca injete este serviço em processadores de dispatch e nunca faça mutações
 * de domínio por ele; mutações continuam em PrismaService.runInTenant().
 */
@Injectable()
export class ControlPlanePrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ControlPlanePrismaService.name);

  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_MIGRATION_URL') ?? config.get<string>('DATABASE_URL');
    super({ datasources: { db: { url } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma conectado (plano de controle somente leitura)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
