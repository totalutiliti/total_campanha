-- ============================================================================
-- 0002_enable_rls
--
-- Ativa Row-Level Security em TODAS as tabelas tenant-scoped.
-- Cria 2 roles de aplicação:
--   - app_user        → respeita RLS (usado pela API/Worker)
--   - migration_user  → BYPASSRLS (usado APENAS por `prisma migrate ...`)
--
-- Referências:
--   docs/RULES.md  seção 1 (multi-tenancy)
--   docs/SPECS.md  seção 1 (lista de tabelas)
--   packages/db/src/rls-tables.ts (lista canônica)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Extensões necessárias (idempotente).
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 2) Roles da aplicação.
--    Em PROD as senhas vêm de Key Vault — aqui usamos senhas placeholder que
--    serão sobrescritas por `ALTER ROLE ... PASSWORD '...'` no provisionamento.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'changeme_app_user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_user') THEN
    CREATE ROLE migration_user LOGIN BYPASSRLS PASSWORD 'changeme_migration_user';
  END IF;
END $$;

-- Garante BYPASSRLS no migration_user mesmo se já existia.
ALTER ROLE migration_user BYPASSRLS;

-- ---------------------------------------------------------------------------
-- 3) Helper: ativa RLS + FORCE + policy padrão em uma tabela.
--    FORCE garante que o próprio owner da tabela também obedeça RLS — necessário
--    porque o Prisma cria as tabelas como dono de banco em DEV.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tc_enable_tenant_rls(p_table regclass) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_name text := p_table::text;
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_name);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', v_name);
  EXECUTE format(
    'DROP POLICY IF EXISTS tenant_isolation ON %s', v_name
  );
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s USING (
       tenant_id = current_setting(''app.current_tenant'', true)::uuid
     ) WITH CHECK (
       tenant_id = current_setting(''app.current_tenant'', true)::uuid
     )', v_name
  );
END $$;

-- ---------------------------------------------------------------------------
-- 4) Aplica em todas as tabelas tenant-scoped.
--    Esta lista DEVE bater com packages/db/src/rls-tables.ts (RLS_TENANT_TABLES).
-- ---------------------------------------------------------------------------
SELECT tc_enable_tenant_rls('contatos');
SELECT tc_enable_tenant_rls('segmentos');
SELECT tc_enable_tenant_rls('templates');
SELECT tc_enable_tenant_rls('campanhas');
SELECT tc_enable_tenant_rls('mensagens');
SELECT tc_enable_tenant_rls('conexoes_whatsapp');
SELECT tc_enable_tenant_rls('conexoes_email');
SELECT tc_enable_tenant_rls('opt_in_logs');
SELECT tc_enable_tenant_rls('audit_logs');
SELECT tc_enable_tenant_rls('inbox_conversas');
SELECT tc_enable_tenant_rls('inbox_mensagens');

DROP FUNCTION tc_enable_tenant_rls(regclass);

-- ---------------------------------------------------------------------------
-- 5) Tabela imutável: opt_in_logs (RULES 5.4 — sem UPDATE nem DELETE).
--    Implementado via REVOKE no role app_user.
-- ---------------------------------------------------------------------------
-- (os grants abaixo definem o estado final; nada a fazer aqui se ainda não há grants)

-- ---------------------------------------------------------------------------
-- 6) Grants para os roles da aplicação.
--    app_user: tudo nas tabelas existentes, exceto UPDATE/DELETE em opt_in_logs.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO app_user, migration_user;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO app_user;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Default privileges: futuras tabelas criadas pelo migration_user também
-- já ficam acessíveis ao app_user.
ALTER DEFAULT PRIVILEGES FOR ROLE migration_user IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE migration_user IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- opt_in_logs: imutável (RULES 5.4).
REVOKE UPDATE, DELETE ON opt_in_logs FROM app_user;

-- migration_user só lê — não precisa escrever pela aplicação.
-- (Ele já tem ownership das tabelas porque rodou as migrations.)
