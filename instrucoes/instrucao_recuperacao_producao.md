# instrucao_recuperacao_producao.md — Total Campanha

> Runbook de prevenção e recuperação de incidentes em PROD.
> Baseado no incidente real do Total IA Contábil (`prisma db push` apagou tabela users).
> Toda alteração de schema em PROD passa por esse documento.

## 1. Comandos PROIBIDOS em PROD (lista negra)

NUNCA, em qualquer hipótese, executar em ambiente PROD:

```bash
prisma db push                       # ← APAGOU users em Total IA Contábil
prisma db push --accept-data-loss
prisma db push --force-reset
prisma migrate reset
prisma migrate dev
prisma db seed                       # se o seed não for idempotente
DROP TABLE ...                       # qualquer DROP
DROP DATABASE ...
TRUNCATE ...                         # em tabelas de domínio
DELETE FROM ... ;                    # sem WHERE
UPDATE ... SET ... ;                 # sem WHERE
ALTER TABLE ... DROP COLUMN ...      # sem snapshot prévio
ALTER COLUMN ... TYPE ...            # com possível data loss
```

Se em dúvida se o comando é destrutivo, **NÃO RODE**. Pergunte ao João em mensagem separada.

## 2. Comandos PERMITIDOS em PROD (lista branca)

- `prisma migrate deploy` — APENAS após review do diff e backup
- `$executeRawUnsafe('ALTER TABLE ... ADD COLUMN ...')` — adição idempotente (`IF NOT EXISTS`)
- `$executeRawUnsafe('CREATE INDEX CONCURRENTLY ...')` — sem lock de tabela
- `$executeRawUnsafe('CREATE TABLE IF NOT EXISTS ...')`
- `INSERT INTO ... VALUES (...)` — para correção pontual revisada
- `UPDATE ... SET ... WHERE id = '...'` — single row revisado

## 3. Checklist pré-alteração de schema em PROD

Antes de qualquer alteração de schema em PROD, executar **na ordem** e documentar a saída em uma issue do GitHub:

### 3.1. Snapshot do estado atual

```bash
# Confirmar PITR habilitado e capturar janela:
az postgres flexible-server show \
  -g rg-totalcampanha-prod \
  -n pg-totalcampanha-prod \
  --query "{backup:backup, ha:highAvailability}"

# Backup lógico do schema (estrutura, sem dados, para diff):
az containerapp exec \
  --name tc-api-prod \
  --resource-group rg-totalcampanha-prod \
  --command 'pg_dump $DATABASE_URL --schema-only --no-owner > /tmp/schema-before.sql && cat /tmp/schema-before.sql' \
  > snapshots/schema-$(date +%Y%m%d-%H%M).sql
```

### 3.2. Contagem de registros das tabelas críticas

```bash
az containerapp exec \
  --name tc-api-prod \
  --resource-group rg-totalcampanha-prod \
  --command 'node -e "
    const { PrismaClient } = require(\"@prisma/client\");
    const p = new PrismaClient();
    (async () => {
      const tables = [
        \"tenants\", \"users\", \"user_tenants\",
        \"contatos\", \"segmentos\", \"templates\",
        \"campanhas\", \"mensagens\",
        \"conexoes_whatsapp\", \"conexoes_email\",
        \"opt_in_log\", \"audit_log\", \"usage_log\"
      ];
      for (const t of tables) {
        const r = await p.\$queryRawUnsafe(\`SELECT count(*) FROM \"\${t}\"\`);
        console.log(t, r[0].count);
      }
      await p.\$disconnect();
    })();
  "'
```

Salvar a saída em `snapshots/counts-{timestamp}.txt`.

### 3.3. Plano da mudança

Documentar em uma issue:
- **O que muda:** ex.: "Adicionar coluna `tier_meta` em `conexoes_whatsapp`"
- **Por que:** referência ao requisito ou bug
- **SQL exato a executar:** sem variáveis, sem placeholders
- **Plano de rollback:** SQL que reverte (ex.: `ALTER TABLE conexoes_whatsapp DROP COLUMN tier_meta`)
- **Impacto na aplicação:** código atual quebra? deploy precisa vir antes ou depois?
- **Tempo estimado de execução:** se > 30s, considerar `CONCURRENTLY` ou fazer fora de horário comercial

### 3.4. Confirmação humana

João precisa responder explicitamente em mensagem separada:

> "Ok, autorizo executar a alteração X em PROD agora."

Sem essa confirmação, o Antigravity **não executa**.

### 3.5. Execução

Usar `$executeRawUnsafe` dentro do container:

```bash
az containerapp exec \
  --name tc-api-prod \
  --resource-group rg-totalcampanha-prod \
  --command 'node -e "
    const { PrismaClient } = require(\"@prisma/client\");
    const p = new PrismaClient();
    (async () => {
      await p.\$executeRawUnsafe(\"ALTER TABLE conexoes_whatsapp ADD COLUMN IF NOT EXISTS tier_meta VARCHAR(20) DEFAULT \\\"TIER_250\\\"\");
      console.log(\"OK\");
      await p.\$disconnect();
    })();
  "'
```

### 3.6. Verificação pós-alteração

Re-rodar contagem da seção 3.2. Os totais devem ser **idênticos** aos de antes (a menos que a alteração intencionalmente afete dados, o que exige confirmação extra).

Smoke test:
- Healthcheck `tc-api-prod` HTTP 200
- Login admin
- Listar contatos
- Criar campanha de teste (sem disparar)

## 4. Cenários de incidente e recuperação

### Cenário 4.1 — Tabela apagada por engano

Sintoma: count = 0 em tabela que tinha dados, queries falham, erros 500.

Recuperação:
1. **Parar tráfego de escrita**: scale `tc-api-prod` para 0 replicas
   ```bash
   az containerapp revision deactivate --name tc-api-prod -g rg-totalcampanha-prod --revision tc-api-prod--<rev-atual>
   ```
2. **Identificar timestamp do incidente** via logs Application Insights
3. **Point-in-Time Restore** do PostgreSQL para 5min antes do incidente:
   ```bash
   az postgres flexible-server restore \
     --resource-group rg-totalcampanha-prod \
     --name pg-totalcampanha-prod-restore \
     --source-server pg-totalcampanha-prod \
     --restore-time "2026-MM-DDTHH:MM:00+00:00"
   ```
4. Aguardar ~10-15 min
5. **Exportar a tabela afetada** do servidor restore:
   ```bash
   pg_dump --table=tabela_afetada postgresql://... -h pg-totalcampanha-prod-restore.postgres.database.azure.com > tabela.sql
   ```
6. **Restaurar no servidor original** dentro de transação:
   ```sql
   BEGIN;
   -- restore data
   \i tabela.sql
   COMMIT;
   ```
7. Re-ativar `tc-api-prod`
8. Smoke test
9. Deletar servidor restore (custo)

### Cenário 4.2 — Tabela corrompida (alguns registros perdidos)

Mais complexo, exige `pg_dump` seletivo do PITR + reconciliação. Pedir suporte Azure se necessário.

### Cenário 4.3 — Tenant deletado por engano

Tenant tem soft delete (`tenants.status = CANCELADO`) — não delete real. Restaurar:
```sql
UPDATE tenants SET status = 'ATIVO' WHERE id = '...';
```

Se foi hard delete (não devia acontecer), seguir Cenário 4.1.

### Cenário 4.4 — Tokens BYOA WhatsApp comprometidos

Se houver suspeita que `TOKEN_KMS_KEY` ou o banco vazou:
1. Avisar todos os tenants
2. Forçar reset de tokens (status `PENDENTE_VERIFICACAO`)
3. Cada tenant gera novo System User Token na Meta dele e re-pluga
4. Rotacionar `TOKEN_KMS_KEY` em Key Vault
5. Re-criptografar todos os tokens que ainda estão válidos

### Cenário 4.5 — Senha de admin esquecida (acesso ao Super Admin)

1. Conectar no banco via Azure Cloud Shell + psql:
   ```bash
   az postgres flexible-server connect -n pg-totalcampanha-prod -u tcadmin -d total_campanha_prod
   ```
2. Gerar hash Argon2id da nova senha **dentro do container** (pega o pepper correto):
   ```bash
   az containerapp exec --name tc-api-prod -g rg-totalcampanha-prod --command 'node -e "
     const argon2 = require(\"argon2\");
     argon2.hash(\"NovaSenhaForte!\" + process.env.AUTH_PEPPER, { type: argon2.argon2id }).then(h => console.log(h));
   "'
   ```
3. Update no banco:
   ```sql
   UPDATE users SET password_hash = '<hash>' WHERE email = 'joao@totalutiliti.com.br';
   ```

## 5. Rate limiting da Azure Container Exec (lição da Total IA Contábil)

Azure Container Apps Exec tem rate limit. Em incidente, evitar comandos repetidos rápidos. Se receber HTTP 429:
- Aguardar 60s
- Não tentar paralelizar

## 6. Audit de toda alteração

Toda alteração de schema em PROD entra em uma issue do GitHub com:
- Título: `[PROD-SCHEMA] {descrição}`
- Saída do snapshot, dos counts antes/depois
- SQL exato executado
- Confirmação do João citada literalmente
- Resultado do smoke test

Mantém histórico para auditoria e debug futuro.
