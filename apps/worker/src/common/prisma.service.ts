import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@total-campanha/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Espelho do PrismaService da API.
 *
 * Em algum momento deve virar um pacote compartilhado em `packages/db` — por
 * enquanto duplicado para evitar acoplamento prematuro entre API e Worker.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma conectado (worker)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async runInTenant<T>(tenantId: string, fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
    if (!UUID_REGEX.test(tenantId)) {
      throw new Error(`[worker/prisma] runInTenant tenantId inválido: ${tenantId}`);
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
      return fn(tx as PrismaTx);
    });
  }
}
