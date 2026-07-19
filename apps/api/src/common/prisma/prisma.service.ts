import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@total-campanha/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma conectado');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Executa `fn` dentro de uma transação Prisma com `SET LOCAL app.current_tenant`
   * configurado — o RLS do Postgres garante que apenas dados deste tenant sejam visíveis.
   *
   * **Sempre use isso em código de domínio.** Acesso direto ao `this.contato.*`
   * etc. é anti-padrão (ver docs/SKILL.md "Anti-padrões").
   *
   * Segurança: tenantId DEVE vir do JWT validado. Aqui validamos o formato UUID
   * antes de interpolar em SQL — mesmo sendo SET LOCAL, defesa em profundidade.
   */
  async runInTenant<T>(tenantId: string, fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
    if (!UUID_REGEX.test(tenantId)) {
      throw new Error(`[prisma] runInTenant recebeu tenantId inválido: ${tenantId}`);
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
      return fn(tx as PrismaTx);
    });
  }

  /**
   * Para uso de Super Admin (RULES 1.6). Roda com `BYPASSRLS` desde que a string
   * de conexão use o role `migration_user` — não use isso na API normal.
   *
   * No MVP, Super Admin usa uma instância separada do PrismaClient configurada
   * em SuperAdminModule; este método existe só para casos pontuais (cron jobs
   * cross-tenant, materialized views, etc).
   */
  async runUnscoped<T>(fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      // Garante que qualquer SET LOCAL anterior não vaze.
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = ''`);
      return fn(tx as PrismaTx);
    });
  }
}

// Re-export tipos do Prisma utilizados em DTOs/services.
export { Prisma };
