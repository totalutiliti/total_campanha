"use strict";
/**
 * Testes de RLS — packages/db.
 *
 * Sobe um Postgres descartável via testcontainers, aplica as migrations do
 * projeto, e verifica:
 *   1. Toda tabela em RLS_TENANT_TABLES tem `rowsecurity = true` e FORCE ROW LEVEL SECURITY.
 *   2. Toda tabela em RLS_TENANT_TABLES tem a policy `tenant_isolation`.
 *   3. As tabelas globais (tenants, users, user_tenants, usage_logs) NÃO têm RLS.
 *   4. Sem `app.current_tenant` setado, SELECTs em tabelas tenant-scoped retornam 0 linhas
 *      (mesmo com dados de múltiplos tenants no banco).
 *   5. Com `SET LOCAL app.current_tenant` para o tenant A, SELECTs só retornam dados do tenant A.
 *
 * Este teste é GATE no CI (RULES 1.5).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const path = __importStar(require("node:path"));
const postgresql_1 = require("@testcontainers/postgresql");
const client_1 = require("@prisma/client");
const rls_tables_js_1 = require("../src/rls-tables.js");
const TABELAS_GLOBAIS_SEM_RLS = ['tenants', 'users', 'user_tenants', 'usage_logs'];
let container;
let adminUrl; // role do testcontainers (BYPASSRLS — usado para setup)
let appUrl; // role app_user (respeita RLS)
let adminPrisma;
let appPrisma;
async function aplicarMigrations(databaseUrl) {
    // Roda `prisma migrate deploy` apontando ambas as URLs para o container.
    // Em PROD usamos migration_user (BYPASSRLS); aqui o role do testcontainers
    // já é superuser, então serve.
    const cwd = path.resolve(__dirname, '..');
    (0, node_child_process_1.execSync)('pnpm prisma migrate deploy', {
        cwd,
        env: {
            ...process.env,
            DATABASE_URL: databaseUrl,
            DATABASE_MIGRATION_URL: databaseUrl,
        },
        stdio: 'inherit',
    });
}
beforeAll(async () => {
    container = await new postgresql_1.PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('total_campanha_test')
        .withUsername('postgres')
        .withPassword('postgres')
        .start();
    adminUrl = container.getConnectionUri();
    // Aplica migrations (cria tabelas + roles app_user/migration_user + RLS).
    await aplicarMigrations(adminUrl);
    // Constrói URL como app_user (a senha foi setada no 0002_enable_rls.sql).
    const u = new URL(adminUrl);
    appUrl = `postgresql://app_user:changeme_app_user@${u.hostname}:${u.port}${u.pathname}?schema=public`;
    adminPrisma = new client_1.PrismaClient({ datasources: { db: { url: adminUrl } } });
    appPrisma = new client_1.PrismaClient({ datasources: { db: { url: appUrl } } });
}, 180_000);
afterAll(async () => {
    await adminPrisma?.$disconnect();
    await appPrisma?.$disconnect();
    await container?.stop();
});
describe('RLS — metadata', () => {
    test.each(rls_tables_js_1.RLS_TENANT_TABLES)('tabela %s tem RLS habilitado e FORCEd', async (tabela) => {
        const rows = await adminPrisma.$queryRawUnsafe(`SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE oid = $1::regclass`, tabela);
        expect(rows).toHaveLength(1);
        expect(rows[0].relrowsecurity).toBe(true);
        expect(rows[0].relforcerowsecurity).toBe(true);
    });
    test.each(rls_tables_js_1.RLS_TENANT_TABLES)('tabela %s tem policy tenant_isolation', async (tabela) => {
        const rows = await adminPrisma.$queryRawUnsafe(`SELECT polname
         FROM pg_policy
        WHERE polrelid = $1::regclass`, tabela);
        const nomes = rows.map((r) => r.polname);
        expect(nomes).toContain('tenant_isolation');
    });
    test.each(TABELAS_GLOBAIS_SEM_RLS)('tabela global %s NÃO tem RLS', async (tabela) => {
        const rows = await adminPrisma.$queryRawUnsafe(`SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass`, tabela);
        expect(rows).toHaveLength(1);
        expect(rows[0].relrowsecurity).toBe(false);
    });
});
describe('RLS — comportamento em runtime', () => {
    const tenantA = '11111111-1111-1111-1111-111111111111';
    const tenantB = '22222222-2222-2222-2222-222222222222';
    beforeAll(async () => {
        // Setup: 2 tenants, 1 contato em cada.
        await adminPrisma.$executeRawUnsafe(`INSERT INTO tenants (id, slug, cnpj, razao_social, plano, status, created_at, updated_at)
       VALUES ($1, 'tenant-a', '00000000000001', 'Tenant A LTDA', 'STARTER', 'ATIVO', now(), now()),
              ($2, 'tenant-b', '00000000000002', 'Tenant B LTDA', 'STARTER', 'ATIVO', now(), now())`, tenantA, tenantB);
        await adminPrisma.$executeRawUnsafe(`INSERT INTO contatos (id, tenant_id, email, telefone_e164, tags, extras,
                             opt_in_email, opt_in_whatsapp, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'a@a.com', '+5511900000001', ARRAY[]::text[], '{}'::jsonb,
               true, true, now(), now()),
              (gen_random_uuid(), $2, 'b@b.com', '+5511900000002', ARRAY[]::text[], '{}'::jsonb,
               true, true, now(), now())`, tenantA, tenantB);
    });
    test('sem app.current_tenant setado, SELECT em contatos retorna 0 linhas', async () => {
        const result = await appPrisma.$queryRawUnsafe(`SELECT count(*)::bigint AS count FROM contatos`);
        expect(Number(result[0].count)).toBe(0);
    });
    test('com tenantA setado, SELECT só retorna contatos do tenantA', async () => {
        await appPrisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantA}'`);
            const rows = await tx.$queryRawUnsafe(`SELECT tenant_id FROM contatos`);
            expect(rows).toHaveLength(1);
            expect(rows[0].tenant_id).toBe(tenantA);
        });
    });
    test('com tenantB setado, INSERT cross-tenant é bloqueado pela WITH CHECK', async () => {
        await expect(appPrisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant = '${tenantB}'`);
            // Tenta inserir em nome do tenantA enquanto a sessão é do tenantB.
            await tx.$executeRawUnsafe(`INSERT INTO contatos (id, tenant_id, email, tags, extras,
                                 opt_in_email, opt_in_whatsapp, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, 'cross@a.com', ARRAY[]::text[], '{}'::jsonb,
                   true, true, now(), now())`, tenantA);
        })).rejects.toThrow();
    });
});
//# sourceMappingURL=rls.test.js.map