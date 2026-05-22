-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ATIVO', 'INADIMPLENTE', 'SUSPENSO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR_CAMPANHA', 'VISUALIZADOR');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "StatusCampanha" AS ENUM ('RASCUNHO', 'AGENDADA', 'DISPARANDO', 'PAUSADA', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusMensagem" AS ENUM ('PENDENTE', 'ENFILEIRADA', 'ENVIADA', 'ENTREGUE', 'LIDA', 'RESPONDIDA', 'FALHOU', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TierMeta" AS ENUM ('TIER_250', 'TIER_1K', 'TIER_10K', 'TIER_100K', 'TIER_UNLIMITED');

-- CreateEnum
CREATE TYPE "StatusConexao" AS ENUM ('PENDENTE_VERIFICACAO', 'ATIVA', 'SUSPENSA', 'ERRO');

-- CreateEnum
CREATE TYPE "OptInAcao" AS ENUM ('OPT_IN', 'OPT_OUT');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razao_social" TEXT NOT NULL,
    "plano" "Plano" NOT NULL DEFAULT 'STARTER',
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "trial_ate_em" TIMESTAMP(3),
    "asaas_subscription_id" TEXT,
    "trial_lembretes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tenants" (
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "user_tenants_pkey" PRIMARY KEY ("user_id","tenant_id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "servico" TEXT NOT NULL,
    "custo_estimado_brl" DECIMAL(10,4) NOT NULL,
    "metadados" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT,
    "email" TEXT,
    "telefone_e164" TEXT,
    "tags" TEXT[],
    "extras" JSONB NOT NULL DEFAULT '{}',
    "opt_in_email" BOOLEAN NOT NULL DEFAULT false,
    "opt_in_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "opt_in_meta" JSONB,
    "excluido_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segmentos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "filtros" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segmentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "canal" "Canal" NOT NULL,
    "nome" TEXT NOT NULL,
    "mjml" TEXT,
    "assunto" TEXT,
    "meta_template_name" TEXT,
    "meta_language" TEXT,
    "variaveis" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "segmento_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "canal" "Canal" NOT NULL,
    "status" "StatusCampanha" NOT NULL DEFAULT 'RASCUNHO',
    "agendado_para" TIMESTAMP(3),
    "janela_envio" JSONB,
    "total_destinatarios" INTEGER NOT NULL DEFAULT 0,
    "total_enviados" INTEGER NOT NULL DEFAULT 0,
    "total_entregues" INTEGER NOT NULL DEFAULT 0,
    "total_lidos" INTEGER NOT NULL DEFAULT 0,
    "total_respondidos" INTEGER NOT NULL DEFAULT 0,
    "total_falhas" INTEGER NOT NULL DEFAULT 0,
    "custo_estimado_brl" DECIMAL(10,4),
    "custo_real_brl" DECIMAL(10,4),
    "iniciada_em" TIMESTAMP(3),
    "finalizada_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campanha_id" UUID NOT NULL,
    "contato_id" UUID,
    "destinatario_hash" TEXT,
    "canal" "Canal" NOT NULL,
    "status" "StatusMensagem" NOT NULL DEFAULT 'PENDENTE',
    "status_history" JSONB NOT NULL DEFAULT '[]',
    "provider_message_id" TEXT,
    "custo_estimado_brl" DECIMAL(10,4),
    "enviada_em" TIMESTAMP(3),
    "entregue_em" TIMESTAMP(3),
    "lida_em" TIMESTAMP(3),
    "falha_motivo" TEXT,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conexoes_whatsapp" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "waba_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "token_encrypted" BYTEA NOT NULL,
    "webhook_secret" TEXT NOT NULL,
    "tier_meta" "TierMeta" NOT NULL DEFAULT 'TIER_250',
    "quality_rating" TEXT,
    "status" "StatusConexao" NOT NULL DEFAULT 'PENDENTE_VERIFICACAO',
    "ultimo_teste" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conexoes_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conexoes_email" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "dominio" TEXT NOT NULL,
    "remetente" TEXT NOT NULL,
    "dkim_status" TEXT NOT NULL,
    "spf_status" TEXT NOT NULL,
    "status" "StatusConexao" NOT NULL DEFAULT 'PENDENTE_VERIFICACAO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conexoes_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opt_in_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contato_id" UUID,
    "email" TEXT,
    "telefone_e164" TEXT,
    "canal" "Canal" NOT NULL,
    "acao" "OptInAcao" NOT NULL,
    "ip" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "versao_termo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opt_in_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "acao" TEXT NOT NULL,
    "recurso" TEXT,
    "dados" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_conversas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contato_id" UUID NOT NULL,
    "ultimo_msg_at" TIMESTAMP(3) NOT NULL,
    "janela_24h_expira_em" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "inbox_conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_mensagens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversa_id" UUID NOT NULL,
    "direcao" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_cnpj_key" ON "tenants"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_hash_key" ON "users"("email_hash");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_tenants_tenant_id_idx" ON "user_tenants"("tenant_id");

-- CreateIndex
CREATE INDEX "usage_logs_tenant_id_created_at_idx" ON "usage_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "usage_logs_servico_created_at_idx" ON "usage_logs"("servico", "created_at");

-- CreateIndex
CREATE INDEX "contatos_tenant_id_idx" ON "contatos"("tenant_id");

-- CreateIndex
CREATE INDEX "contatos_tenant_id_email_idx" ON "contatos"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "contatos_tenant_id_telefone_e164_idx" ON "contatos"("tenant_id", "telefone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_tenant_id_email_key" ON "contatos"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_tenant_id_telefone_e164_key" ON "contatos"("tenant_id", "telefone_e164");

-- CreateIndex
CREATE INDEX "segmentos_tenant_id_idx" ON "segmentos"("tenant_id");

-- CreateIndex
CREATE INDEX "templates_tenant_id_canal_idx" ON "templates"("tenant_id", "canal");

-- CreateIndex
CREATE INDEX "campanhas_tenant_id_status_idx" ON "campanhas"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "mensagens_tenant_id_campanha_id_idx" ON "mensagens"("tenant_id", "campanha_id");

-- CreateIndex
CREATE INDEX "mensagens_tenant_id_status_idx" ON "mensagens"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "mensagens_provider_message_id_idx" ON "mensagens"("provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "conexoes_whatsapp_tenant_id_key" ON "conexoes_whatsapp"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "conexoes_email_tenant_id_dominio_key" ON "conexoes_email"("tenant_id", "dominio");

-- CreateIndex
CREATE INDEX "opt_in_logs_tenant_id_created_at_idx" ON "opt_in_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "opt_in_logs_contato_id_idx" ON "opt_in_logs"("contato_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "inbox_conversas_tenant_id_status_idx" ON "inbox_conversas"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "inbox_mensagens_tenant_id_conversa_id_idx" ON "inbox_mensagens"("tenant_id", "conversa_id");

-- AddForeignKey
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

