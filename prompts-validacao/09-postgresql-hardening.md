# 🐘 09 — PostgreSQL Hardening

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto usa PostgreSQL?
  → SIM → Aplicar INTEGRALMENTE.
  → NÃO → Pular este prompt.

O projeto é multi-tenant (SaaS)?
  → SIM → Aplicar também seções [MULTI-TENANT].
```

---

## 📋 CONTEÚDO

### 1. Roles e Menor Privilégio `[UNIVERSAL]`

```sql
-- O usuário da aplicação NÃO é superuser
-- Criar role específica com permissões mínimas

CREATE ROLE app_user WITH LOGIN PASSWORD 'do-key-vault';
GRANT CONNECT ON DATABASE mydb TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- NÃO conceder:
-- ❌ SUPERUSER
-- ❌ CREATEDB
-- ❌ CREATEROLE
-- ❌ DROP em tabelas
-- ❌ TRUNCATE
```

### 2. SSL Obrigatório `[UNIVERSAL]`

```bash
# Verificar
az postgres flexible-server parameter show \
  --server-name PG-NAME --resource-group RG \
  --name require_secure_transport --query value
# Deve ser: ON

# password_encryption deve ser scram-sha-256 (não md5)
az postgres flexible-server parameter show \
  --server-name PG-NAME --resource-group RG \
  --name password_encryption --query value
```

### 3. RLS (Row Level Security) `[MULTI-TENANT]`

```sql
-- Para CADA tabela que contém dados de tenant:

-- 1. Habilitar
ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

-- 2. Forçar (mesmo para owner)
ALTER TABLE nome_tabela FORCE ROW LEVEL SECURITY;

-- 3. Criar política
CREATE POLICY tenant_isolation ON nome_tabela
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- 4. Verificar que TODAS as tabelas com tenant_id têm RLS
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  SELECT table_name FROM information_schema.columns
  WHERE column_name = 'tenant_id'
);
-- rowsecurity deve ser TRUE para todas
```

### 4. Firewall e Acesso `[UNIVERSAL]`

```bash
# Apenas Container Apps devem acessar o banco
# Desabilitar acesso público se usando VNet integration

az postgres flexible-server firewall-rule list \
  --server-name PG-NAME --resource-group RG -o table

# Em produção: sem firewall rules abertas
# Usar Private Endpoint ou VNet integration
```

### 5. Parâmetros de Auditoria `[UNIVERSAL]`

```bash
# Habilitar logging de conexões e DDL
az postgres flexible-server parameter set --server-name PG-NAME --resource-group RG \
  --name log_connections --value ON
az postgres flexible-server parameter set --server-name PG-NAME --resource-group RG \
  --name log_disconnections --value ON
az postgres flexible-server parameter set --server-name PG-NAME --resource-group RG \
  --name log_statement --value ddl
```

### 6. Connection Pooling `[UNIVERSAL]`

```
Para projetos com muitas conexões simultâneas:
  → Azure PostgreSQL Flexible Server tem PgBouncer built-in
  → Habilitar via parâmetro: pgbouncer.enabled = true
  → Pool mode: transaction (recomendado para NestJS/TypeORM)
  → Reduz overhead de conexões e protege contra connection exhaustion
```

### 7. Checklist

```
  □ App user NÃO é superuser (role com permissões mínimas)
  □ require_secure_transport = ON
  □ password_encryption = scram-sha-256
  □ log_connections = ON, log_disconnections = ON
  □ log_statement = ddl
  □ RLS habilitado em todas as tabelas com tenant_id [MULTI-TENANT]
  □ FORCE ROW LEVEL SECURITY em todas [MULTI-TENANT]
  □ Firewall: apenas Container Apps acessam (sem 0.0.0.0/0)
  □ Backup automático habilitado (ver prompt 17)
  □ Connection pooling avaliado/habilitado
```

````markdown
## PostgreSQL — Regras para Antigravity

- Ao criar tabela com tenant_id: SEMPRE adicionar RLS + FORCE + policy
- Ao criar migration: NUNCA usar SUPERUSER, NUNCA usar DROP sem confirmação
- Connection string SEMPRE com sslmode=require
- App user tem SELECT/INSERT/UPDATE/DELETE, NUNCA SUPERUSER/DROP/TRUNCATE
- CREATE INDEX CONCURRENTLY requer migration especial (-- CreateIndex comment)
````

---

> **Próximo prompt:** `10-azure-container-apps.md`
