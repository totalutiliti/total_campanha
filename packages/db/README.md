# @total-campanha/db

Schema Prisma e migrations do Total Campanha.

## Estrutura

```
prisma/
├── schema.prisma                 # SPECS.md seção 1 (espelho)
├── seed.ts                       # seed DEV (aborta em PROD — RULES 2.1)
└── migrations/
    ├── migration_lock.toml
    └── 0002_enable_rls/
        └── migration.sql         # RLS + roles app_user/migration_user
src/
├── index.ts                      # re-export do PrismaClient
└── rls-tables.ts                 # lista canônica das tabelas com RLS
tests/
└── rls.test.ts                   # GATE no CI (RULES 1.5)
```

## Comandos

```bash
# Gerar client
pnpm db:generate

# Aplicar migrations em DEV
pnpm db:migrate                   # equivalente a `prisma migrate dev`

# Aplicar em staging/prod (depois de revisão + backup)
pnpm db:migrate:deploy

# Seed DEV (proibido em PROD)
pnpm db:seed

# Testes de RLS (sobe Postgres descartável via testcontainers)
pnpm --filter @total-campanha/db test:rls
```

## Primeira execução em uma máquina nova

A migration `0001_init` ainda não foi gerada — o Prisma cria automaticamente na
primeira vez que rodar `pnpm db:migrate --name initial`. Depois disso, a
`0002_enable_rls` (já incluída no repo) será aplicada em sequência.

Em PROD, o nome da migration inicial precisa ser **exatamente** o mesmo gerado
em DEV/staging (Prisma valida hash) — por isso geramos uma vez em DEV e
commitamos o diretório `0001_init/`.

## Roles do banco

- **migration_user** — `BYPASSRLS`. Usado APENAS pelos comandos `prisma migrate ...`.
  String de conexão em `DATABASE_MIGRATION_URL`.
- **app_user** — respeita RLS. Usado pela API e pelo Worker. String em `DATABASE_APP_URL`.
- **superuser** (postgres) — somente para administração manual e DR.

Em DEV todos podem apontar para `postgres` (do `docker-compose.yml`) com a senha
`postgres`. Em PROD, cada role tem sua própria senha em Key Vault.

## Não esquecer

- `tenant_id` **SEMPRE** vem do JWT, nunca do body (RULES 1.3).
- Toda transação Prisma na API faz `SET LOCAL app.current_tenant` via
  `PrismaService.runInTenant()` (ver `docs/SKILL.md` seção 4).
- `opt_in_logs` é **imutável** (RULES 5.4) — UPDATE/DELETE revogados pra `app_user`.
