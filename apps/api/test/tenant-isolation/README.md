# test/tenant-isolation/

Suíte **GATE** do CI (RULES 1.5).

## O que testa

Para cada uma das 7 entidades tenant-scoped (Contato, Segmento, Template,
Campanha, Mensagem, ConexaoWhatsapp, ConexaoEmail), valida as 4 violações
clássicas:

1. **Leitura cross-tenant** — `findUnique({ id: <do outro tenant> })` retorna `null`.
2. **List sem filtro** — `findMany()` só retorna registros do tenant atual.
3. **Update cross-tenant** — `updateMany({ id: <do outro tenant> })` afeta 0 linhas.
4. **Delete cross-tenant** — `deleteMany({ id: <do outro tenant> })` afeta 0 linhas.

Mais um teste de write-guard que confirma que `INSERT` com `tenant_id` de outro
tenant é bloqueado pela cláusula `WITH CHECK` da policy RLS.

## Onde a regra vive

O isolamento vem **do Postgres**, não do código TypeScript. A migration
`packages/db/prisma/migrations/0002_enable_rls/migration.sql` ativa
`ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` em cada tabela e cria a
policy `tenant_isolation` com `USING` e `WITH CHECK` (idênticos):

```sql
USING      (tenant_id = current_setting('app.current_tenant', true)::uuid)
WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
```

O `app_user` (role usado pela API) **não** tem `BYPASSRLS`. Toda transação que
fizer queries DEVE primeiro setar `app.current_tenant` via
`PrismaService.runInTenant(tenantId, ...)`. É o que esta suíte testa.

## Como rodar localmente

```bash
# Pré-requisito: Docker rodando (testcontainers sobe um postgres descartável).
pnpm --filter @total-campanha/api test:tenant-isolation
```

A primeira execução demora porque o testcontainers baixa a imagem
`postgres:16-alpine` e roda `prisma migrate deploy`.

## Quando esta suíte falha

**Não merge.** Sem exceção. Se você precisa adicionar uma tabela
tenant-scoped, o procedimento é:

1. Criar a tabela no `schema.prisma` com `tenantId String @map("tenant_id") @db.Uuid`.
2. Adicionar o nome em snake_case na lista `RLS_TENANT_TABLES` em
   `packages/db/src/rls-tables.ts`.
3. Acrescentar `SELECT tc_enable_tenant_rls('<tabela>');` numa **nova** migration
   (jamais editar a `0002_enable_rls/migration.sql`).
4. Adicionar a entidade no array de casos em `entidades.spec.ts`.
5. Garantir que o service usa `runInTenant()` em todas as queries.
