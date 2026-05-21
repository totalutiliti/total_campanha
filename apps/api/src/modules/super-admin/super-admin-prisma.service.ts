import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@total-campanha/db';

import { env } from '../../config/config.module.js';

/**
 * PrismaClient dedicado ao escopo Super Admin (RULES 1.6).
 *
 * Conecta com `DATABASE_MIGRATION_URL` — role `migration_user` (BYPASSRLS) —
 * porque o Super Admin é cross-tenant: lista todos os tenants, agrega
 * `usage_log` global e grava `audit_logs` com `tenant_id = NULL` (ações
 * que não pertencem a tenant nenhum). O `PrismaService` normal usa `app_user`
 * e o RLS bloquearia esses acessos.
 *
 * Em DEV, `DATABASE_MIGRATION_URL` aponta para o mesmo Postgres do
 * docker-compose (superusuário) — funciona igual.
 */
@Injectable()
export class SuperAdminPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SuperAdminPrismaService.name);

  constructor(config: ConfigService) {
    const url = env(config, 'DATABASE_MIGRATION_URL') ?? env(config, 'DATABASE_URL');
    super({ datasources: { db: { url } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma Super Admin conectado (BYPASSRLS)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
