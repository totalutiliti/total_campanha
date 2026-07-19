# ARCHITECTURE — Total Campanha

> Documento de arquitetura técnica do Total Campanha.
> Audiência: Antigravity, desenvolvedores, revisores técnicos.

## 1. Visão geral

Total Campanha é um SaaS multi-tenant com isolamento por **PostgreSQL Row-Level Security (RLS)**, hospedado em **Azure Container Apps** no Brasil. A arquitetura é monolito modular no MVP (NestJS com módulos bem separados) com workers desacoplados via fila (BullMQ + Redis) para os disparos, que são o ponto de carga variável.

```
┌─────────────────────────────────────────────────────────────────┐
│  Cliente (Tenant Admin)                                         │
│  Browser → app.totalcampanha.com.br (Next.js)                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────────────┐
│  Azure Container Apps Environment (zone-redundant)              │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ tc-web-prod    │  │ tc-api-prod    │  │ tc-worker-prod   │  │
│  │ Next.js 15     │  │ NestJS         │  │ NestJS+BullMQ    │  │
│  │ min=1 max=3    │  │ min=1 max=8    │  │ min=1 max=10     │  │
│  └────────┬───────┘  └───┬─────┬──────┘  └────────┬─────────┘  │
│           │              │     │                   │            │
└───────────┼──────────────┼─────┼───────────────────┼────────────┘
            │              │     │                   │
   ┌────────▼──────┐ ┌─────▼─────┴───┐  ┌───────────▼──────────┐
   │ Public página │ │  PostgreSQL    │  │  Azure Cache Redis   │
   │ de opt-in     │ │  Flex HA GP    │  │  C1 Standard         │
   │ (mesma web)   │ │  D2ds_v4       │  │  (BullMQ, RLS hint)  │
   └───────────────┘ └────────────────┘  └──────────────────────┘
                              │                      │
                              │                      │
                     ┌────────▼─────┐       ┌────────▼──────┐
                     │ Blob Storage │       │ Key Vault     │
                     │ uploads,     │       │ AUTH_PEPPER,  │
                     │ templates    │       │ TOKEN_KMS,    │
                     │ MJML, fotos  │       │ TOKEN_KMS     │
                     └──────────────┘       └───────────────┘

   Externos (BYOA):
   ┌─────────────────────────┐  ┌──────────────────────────┐
   │ Meta Cloud API          │  │ Amazon SES / Resend      │
   │ (WhatsApp do tenant)    │  │ (Email com domínio tenant)│
   └─────────────────────────┘  └──────────────────────────┘
```

## 2. Stack tecnológico (versões fixas)

| Camada | Tech | Versão |
|---|---|---|
| Linguagem | TypeScript | 5.x |
| Runtime | Node.js | 20 LTS |
| Backend | NestJS | 10 |
| Frontend | Next.js | 14 (App Router) |
| ORM | Prisma | 5 |
| Banco | PostgreSQL | 16 |
| Cache/Fila | Redis | 7 |
| Fila JS | BullMQ | 5 |
| UI | Tailwind + shadcn/ui | latest |
| Auth | Argon2id + JWT | argon2 v0.31, jsonwebtoken v9 |
| Validação | Zod | 3 |
| Email MJML | mjml | 4 |
| Telefone | libphonenumber-js | 1.x |
| Container | Docker | 24+ |
| IaC | Bicep | latest |
| CI/CD | GitHub Actions | - |
| Observabilidade | Application Insights | - |

## 3. Modelo de dados (visão alto nível, detalhe em SPECS.md)

Tabelas principais (todas com `tenant_id` exceto as marcadas com 🌐):

- 🌐 `tenants(id, slug, cnpj, razao_social, plano, status, created_at)`
- 🌐 `users(id, email_hash, password_hash, ...)` — login global, vínculos via `user_tenants`
- 🌐 `user_tenants(user_id, tenant_id, role)` — n:m, define RBAC
- 🌐 `usage_log(tenant_id, servico, custo_estimado_brl, metadados, created_at)` — custo unificado
- `contatos(id, tenant_id, nome, email, telefone_e164, tags[], extras_jsonb, opt_in_email, opt_in_whatsapp, opt_in_meta, ...)`
- `segmentos(id, tenant_id, nome, filtros_jsonb)`
- `templates(id, tenant_id, canal, nome, meta_template_name, mjml, variaveis[], ...)`
- `campanhas(id, tenant_id, segmento_id, template_id, canal, status, agendado_para, janela_envio_jsonb, ...)`
- `mensagens(id, tenant_id, campanha_id, contato_id, canal, status, processamento_token, processamento_iniciado_em, tentativas_envio, provider_message_id, ...)`
- `inbox_conversas(id, tenant_id, contato_id, ultimo_msg_at, janela_24h_expira_em, status)`
- `inbox_mensagens(id, tenant_id, conversa_id, direcao, conteudo, ...)`
- `conexoes_whatsapp(id, tenant_id, waba_id, phone_number_id, token_encrypted, app_secret_encrypted, webhook_secret, tier_meta, status)`
- `conexoes_email(id, tenant_id, dominio, remetente, dkim_status, spf_status, status)`
- `opt_in_log(id, tenant_id, contato_id, canal, ip, user_agent, origem, versao_termo, created_at)` — imutável
- `consentimentos_pendentes(id, tenant_id, contato_id, canal, token_hash, expira_em, confirmado_em, ...)`
- `webhook_eventos(id, tenant_id, provedor, evento_hash, recebido_em, processado_em)`
- `audit_log(id, tenant_id, user_id, acao, recurso, dados_jsonb, created_at)` — imutável

RLS:
```sql
ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY contatos_tenant_isolation ON contatos
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

API e worker usam `app_user` nas operações de domínio. Jobs recorrentes usam um
cliente de control-plane separado com `migration_user` apenas para descobrir
tenants/IDs; toda mutação retorna a `runInTenant`. O boot do worker rejeita a
role privilegiada em `DATABASE_URL`.

E o middleware NestJS, em toda transação:
```typescript
await prisma.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
```

## 4. Módulos NestJS

```
apps/api/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── prisma/                 # PrismaService com RLS middleware
│   ├── auth/                   # Argon2, JWT, refresh rotation
│   ├── rbac/                   # Guards, decorators @Role()
│   ├── tenant/                 # TenantMiddleware (extrai do JWT)
│   ├── audit/                  # AuditService (escreve audit_log)
│   ├── usage/                  # UsageService (escreve usage_log)
│   └── crypto/                 # pgcrypto wrapper para tokens BYOA
├── modules/
│   ├── tenants/                # CRUD de tenant (Super Admin)
│   ├── users/                  # CRUD usuários, convites
│   ├── contatos/               # Import CSV, CRUD, busca, opt-in/out
│   ├── segmentos/              # Editor de filtros, contagem
│   ├── templates/              # Email MJML + WhatsApp template refs
│   ├── campanhas/              # Criação, agendamento, dispatch
│   ├── conexoes/               # BYOA WhatsApp + Email
│   ├── inbox/                  # Conversas e respostas
│   ├── analytics/              # Métricas agregadas
│   ├── billing/                # Stripe/Asaas webhooks
│   ├── webhooks/               # Receber Meta + SES + Asaas
│   ├── super-admin/            # Painel TotalUtiliti
│   └── public/                 # Opt-in/Opt-out (sem auth)
└── workers/                    # imagem separada tc-worker
    ├── dispatch.processor.ts   # consome fila de envio
    ├── webhook.processor.ts    # processa webhooks recebidos
    └── retry.processor.ts      # retries de mensagens falhas
```

## 5. Filas BullMQ

| Fila | Job | Concorrência | Rate limit |
|---|---|---|---|
| `dispatch:email` | Enviar 1 email via SES | 20 por worker | Dinâmico por tenant |
| `dispatch:whatsapp` | Enviar 1 mensagem WhatsApp | 5 por worker | **Dinâmico por tier do tenant na Meta** (250/d, 1k/d, 10k/d, 100k/d) |
| `webhook:meta` | Processar evento status Meta | 50 | - |
| `webhook:ses` | Processar bounce/complaint | 20 | - |
| `retry` | Reenfileirar com backoff exponencial | 10 | Max 5 tentativas |
| `cleanup` | LGPD direito ao esquecimento | 1 | - |

KEDA scaler no `tc-worker-prod` baseado em `bull:dispatch:whatsapp:wait` (threshold 50 jobs por replica).

## 6. Infraestrutura Azure

### Ambientes

| Ambiente | Resource Group | min-replicas | PostgreSQL SKU | Min cost/mês |
|---|---|---|---|---|
| **dev** | `rg-totalcampanha-dev` | 0 | B1ms | ~R$ 150 |
| **prod** | `rg-totalcampanha-prod` | 1 | GP D2ds_v4 HA | ~R$ 2.500 |

### Recursos PROD (provisionados via Bicep, ver `infra/`)

- VNet + subnets + private DNS zones
- PostgreSQL Flexible Server **GP_Standard_D2ds_v4 Zone-Redundant HA**, 128 GB auto-grow, 35 dias backup geo-redundante, PgBouncer ativo, private endpoint
- Azure Cache for Redis **C1 Standard**, `maxmemory-policy: noeviction` (BullMQ exige), private endpoint
- Storage Account GRS, soft delete 14 dias, private endpoint
- Container Apps Environment zone-redundant
- 3 Container Apps: `tc-web-prod`, `tc-api-prod`, `tc-worker-prod`
- Container Registry Standard `acrtotalcampanha01`
- Key Vault `kv-totalcampanha-prod01`, private endpoint
- Log Analytics workspace + Application Insights
- Budget alerts: R$ 3.000/mês warning, R$ 4.000 stop (não real stop, só alerta + freeze de novos tenants)

### Custom domains

- `app.totalcampanha.com.br` → `tc-web-prod`
- `api.totalcampanha.com.br` → `tc-api-prod`
- `opt-in.totalcampanha.com.br` → `tc-web-prod` (mesma app, rota pública)

Managed Certificates (Let's Encrypt) via Azure Container Apps. Setup em duas fases (verifyId → DNS Registro.br → vincular) documentado em `instrucoes/instrucao_deploys.md`.

### Min-replicas = 1 desde o dia 1 em PROD

**Lição da Total IA Contábil:** scale-to-zero causou cold start na UI e quebrou demos. Em PROD nunca usar min=0.

## 7. Integrações externas

### Meta WhatsApp Cloud API (BYOA)

- Tenant cria conta Meta Business Manager + WABA + Phone Number (responsabilidade dele).
- Tenant gera **System User Token permanente** com escopos `whatsapp_business_messaging`, `whatsapp_business_management`.
- Tenant cola na plataforma: `WABA ID`, `Phone Number ID`, `Token` e `App Secret`.
- Plataforma criptografa token e App Secret com `pgcrypto` (chave em Key Vault) e armazena.
- Plataforma testa a conexão chamando `GET /v18.0/{phone_number_id}` — se 200, salva; se 401/403, mostra erro.
- Webhook aponta para `https://api.totalcampanha.com.br/api/v1/webhooks/meta/{tenant_slug}/{webhook_secret}`. POST exige `X-Hub-Signature-256` válido sobre o corpo bruto e ledger único contra replay.

**Versão API Meta:** fixar em `v22.0` (atual em maio/2026 — verificar antes de deploy).

### Email (BYOA via Amazon SES)

- Tenant adiciona o domínio no painel.
- Plataforma mostra registros DNS (DKIM CNAMEs gerados pelo SES, SPF include, DMARC sugerido).
- Tenant configura DNS.
- Plataforma chama `VerifyDomainDkim` no SES e fica polling.
- Quando verificado, libera disparo.

Alternativa: Resend para tenants que não querem mexer com SES.

### Billing

- **Asaas** preferencial: aceita Pix, boleto, cartão; bom para PMEs.
- Webhooks `payment_confirmed`, `subscription_overdue` → atualiza status do tenant.
- 14 dias trial sem cartão. Após trial, freeze (não deleta).

## 8. Autoscaling

| App | min | max | Trigger |
|---|---|---|---|
| `tc-web-prod` | 1 | 3 | HTTP concurrent requests > 50 por replica |
| `tc-api-prod` | 1 | 8 | HTTP concurrent requests > 50 por replica |
| `tc-worker-prod` | 1 | 10 | KEDA Redis: `bull:dispatch:whatsapp:wait` > 50 |

Sazonalidade (datas comerciais — Dia das Mães, Black Friday, Natal): script `infra/scale-up.sh` aumenta max temporariamente.

## 9. Observabilidade

- **Logs:** Application Insights, retenção 30 dias.
- **Métricas custom:**
  - `campaign.dispatched.total{tenant_id, canal}`
  - `campaign.failed.total{tenant_id, canal, reason}`
  - `meta.api.latency_ms{tenant_id}`
  - `queue.dispatch.length{queue}`
- **Alertas:**
  - Erro 5xx > 1%/5min → Slack
  - Fila > 5000 jobs por 10min → Slack
  - PostgreSQL CPU > 80% por 15min → Slack
  - Budget > 80% do mensal → Email
- **Healthchecks:**
  - `/health/live` (basic)
  - `/health/ready` (DB + Redis + Key Vault)

## 10. Segurança (resumo, detalhes em RULES.md)

- TLS 1.2+ everywhere (Azure Container Apps default).
- Tokens BYOA criptografados em repouso com `pgcrypto` (chave em Key Vault, rotação anual).
- JWT 15min access + 7d refresh com rotation, HttpOnly cookies.
- Rate limit: auth 5/min/IP, dispatch 100/min/tenant.
- Audit log imutável para ações sensíveis (criar campanha, deletar contatos, mudar conexão WhatsApp, impersonate, alterações de billing).
- CSP, HSTS, X-Frame-Options no Next.js.
- Validação Zod em todo DTO.
- RLS + middleware tenant em toda query.
- Suíte de testes de isolamento cross-tenant obrigatória no CI.

## 11. Decisões em aberto (para ADRs futuros)

- Vamos suportar SMS no futuro? (provavelmente sim em Fase 3, via Zenvia/Twilio BYOA)
- Webhooks para o tenant (sair dados): só Fase 2.
- Multi-região: por ora só Brazil South. Considerar South Brazil (RS) só se houver demanda regulatória.
