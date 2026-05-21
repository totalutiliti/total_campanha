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
export {};
//# sourceMappingURL=rls.test.d.ts.map