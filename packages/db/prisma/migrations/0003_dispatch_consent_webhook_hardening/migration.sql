-- 0003_dispatch_consent_webhook_hardening
-- Mudança exclusivamente aditiva. Em PROD, aplicar somente após o checklist da
-- seção 3 de instrucoes/instrucao_recuperacao_producao.md e confirmação humana.

ALTER TYPE "StatusMensagem" ADD VALUE IF NOT EXISTS 'PROCESSANDO' AFTER 'ENFILEIRADA';
ALTER TYPE "StatusMensagem" ADD VALUE IF NOT EXISTS 'ENVIO_INCERTO' AFTER 'FALHOU';

ALTER TABLE "mensagens"
  ADD COLUMN IF NOT EXISTS "processamento_token" TEXT,
  ADD COLUMN IF NOT EXISTS "processamento_iniciado_em" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tentativas_envio" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "mensagens_tenant_id_status_processamento_iniciado_em_idx"
  ON "mensagens"("tenant_id", "status", "processamento_iniciado_em");

ALTER TABLE "conexoes_whatsapp"
  ADD COLUMN IF NOT EXISTS "app_secret_encrypted" BYTEA;

ALTER TABLE "inbox_mensagens"
  ADD COLUMN IF NOT EXISTS "provider_message_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "inbox_mensagens_tenant_id_provider_message_id_key"
  ON "inbox_mensagens"("tenant_id", "provider_message_id");

CREATE TABLE IF NOT EXISTS "consentimentos_pendentes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "contato_id" UUID NOT NULL,
  "canal" "Canal" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "email" TEXT,
  "ip" TEXT NOT NULL,
  "user_agent" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "versao_termo" TEXT NOT NULL,
  "expira_em" TIMESTAMP(3) NOT NULL,
  "confirmado_em" TIMESTAMP(3),
  "invalidado_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consentimentos_pendentes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "consentimentos_pendentes_tenant_id_token_hash_key"
  ON "consentimentos_pendentes"("tenant_id", "token_hash");
CREATE INDEX IF NOT EXISTS "consentimentos_pendentes_tenant_id_contato_id_canal_idx"
  ON "consentimentos_pendentes"("tenant_id", "contato_id", "canal");
CREATE INDEX IF NOT EXISTS "consentimentos_pendentes_tenant_id_expira_em_idx"
  ON "consentimentos_pendentes"("tenant_id", "expira_em");

CREATE TABLE IF NOT EXISTS "webhook_eventos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "provedor" TEXT NOT NULL,
  "evento_hash" TEXT NOT NULL,
  "recebido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processado_em" TIMESTAMP(3),
  CONSTRAINT "webhook_eventos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_eventos_tenant_id_provedor_evento_hash_key"
  ON "webhook_eventos"("tenant_id", "provedor", "evento_hash");
CREATE INDEX IF NOT EXISTS "webhook_eventos_tenant_id_processado_em_idx"
  ON "webhook_eventos"("tenant_id", "processado_em");

-- RLS explícito para toda nova tabela de domínio.
ALTER TABLE "consentimentos_pendentes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consentimentos_pendentes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "consentimentos_pendentes";
CREATE POLICY tenant_isolation ON "consentimentos_pendentes"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE "webhook_eventos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_eventos" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "webhook_eventos";
CREATE POLICY tenant_isolation ON "webhook_eventos"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "consentimentos_pendentes", "webhook_eventos" TO app_user;

-- Exceção auditável à imutabilidade de opt_in_logs: anonimização LGPD. A
-- função só aceita o mesmo tenant configurado na transação do app_user.
CREATE OR REPLACE FUNCTION tc_lgpd_anonimizar_opt_in(
  p_tenant_id UUID,
  p_contato_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(current_setting('app.current_tenant', true), '')::uuid
       IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'tenant inválido para anonimização LGPD';
  END IF;

  UPDATE opt_in_logs
     SET contato_id = NULL,
         email = NULL,
         telefone_e164 = NULL
   WHERE tenant_id = p_tenant_id
     AND contato_id = p_contato_id;
END;
$$;

REVOKE ALL ON FUNCTION tc_lgpd_anonimizar_opt_in(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tc_lgpd_anonimizar_opt_in(UUID, UUID) TO app_user;
