/**
 * Helpers compartilhados entre as specs de tenant-isolation.
 *
 * Sobe um Postgres descartável (testcontainers), aplica as migrations do
 * monorepo (que incluem 0002_enable_rls), e cria dois tenants pré-populados
 * para testes cross-tenant.
 *
 * Cada spec roda em isolamento (jest --runInBand garante ordem).
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

export interface TenantFixture {
  id: string;
  slug: string;
}

export interface IsolationContext {
  container: StartedPostgreSqlContainer;
  adminPrisma: PrismaClient; // BYPASSRLS — para setup e asserts globais
  appPrisma: PrismaClient;   // app_user — respeita RLS
  tenantA: TenantFixture;
  tenantB: TenantFixture;
  outroTenantId: (atual: string) => string;
}

const DB_PACKAGE_DIR = path.resolve(__dirname, '../../../../packages/db');

export async function iniciarIsolationContext(): Promise<IsolationContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('total_campanha_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const adminUrl = container.getConnectionUri();

  execSync('pnpm prisma migrate deploy', {
    cwd: DB_PACKAGE_DIR,
    env: { ...process.env, DATABASE_URL: adminUrl, DATABASE_MIGRATION_URL: adminUrl },
    stdio: 'inherit',
  });

  const adminPrisma = new PrismaClient({ datasources: { db: { url: adminUrl } } });

  const u = new URL(adminUrl);
  const appUrl = `postgresql://app_user:changeme_app_user@${u.hostname}:${u.port}${u.pathname}?schema=public`;
  const appPrisma = new PrismaClient({ datasources: { db: { url: appUrl } } });

  const tenantA: TenantFixture = {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'tenant-a',
  };
  const tenantB: TenantFixture = {
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'tenant-b',
  };

  await adminPrisma.tenant.createMany({
    data: [
      {
        id: tenantA.id,
        slug: tenantA.slug,
        cnpj: '00000000000001',
        razaoSocial: 'Tenant A LTDA',
        status: 'ATIVO',
      },
      {
        id: tenantB.id,
        slug: tenantB.slug,
        cnpj: '00000000000002',
        razaoSocial: 'Tenant B LTDA',
        status: 'ATIVO',
      },
    ],
  });

  return {
    container,
    adminPrisma,
    appPrisma,
    tenantA,
    tenantB,
    outroTenantId: (atual) => (atual === tenantA.id ? tenantB.id : tenantA.id),
  };
}

export async function encerrarIsolationContext(ctx: IsolationContext): Promise<void> {
  await ctx.adminPrisma?.$disconnect();
  await ctx.appPrisma?.$disconnect();
  await ctx.container?.stop();
}

/**
 * Roda `fn` com `SET LOCAL app.current_tenant = tenantId`, simulando
 * exatamente o que o `PrismaService.runInTenant` faria em runtime.
 */
export async function comTenant<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect'>) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantId}'`);
    return fn(tx);
  });
}
