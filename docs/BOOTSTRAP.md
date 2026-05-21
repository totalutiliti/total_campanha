# BOOTSTRAP — Total Campanha

> Sequência de prompts para construir o produto do zero usando Antigravity / Claude Code.
> Cada prompt é uma unidade autocontida. Não pule etapas.
> Antes de iniciar, garanta que CLAUDE.md, RULES.md, ARCHITECTURE.md e SPECS.md foram lidos.

## Fase 0 — Setup do repositório (1 dia)

### Prompt 0.1 — Inicializar monorepo

```
Inicialize um monorepo pnpm com a estrutura:

total-campanha/
├── apps/
│   ├── api/          # NestJS 10
│   ├── web/          # Next.js 14 App Router
│   └── worker/       # NestJS standalone (consome filas BullMQ)
├── packages/
│   ├── db/           # Prisma schema + client compartilhado
│   ├── shared/       # types e helpers compartilhados
│   └── tsconfig/     # tsconfig base
├── infra/            # Bicep templates
├── docs/             # já existe
├── instrucoes/       # já existe
├── .github/workflows/
├── docker-compose.yml
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── turbo.json

Versões fixas:
- Node 20
- pnpm 9
- NestJS 10
- Next.js 14
- Prisma 5
- TypeScript 5

NÃO crie nenhum endpoint ainda. Só estrutura, package.json em cada workspace, tsconfig.json,
.gitignore, eslintrc, prettierrc. Verifique que `pnpm install` roda sem erro.

Crie também docker-compose.yml com:
- postgres:16-alpine (com volume nomeado, porta 5432, DB total_campanha_dev)
- redis:7-alpine (porta 6379)
- mailhog (para testar emails localmente, porta 8025 UI, 1025 SMTP)

Crie .env.example com TODAS as variáveis que o projeto vai usar, comentadas.
```

### Prompt 0.2 — Configurar Prisma e migration inicial

```
No package packages/db, configure Prisma 5 com PostgreSQL.

Crie prisma/schema.prisma seguindo EXATAMENTE o schema documentado em
docs/SPECS.md seção 1 (todas as tabelas e enums).

Depois rode `prisma migrate dev --name initial` para gerar a primeira migration.

Crie um arquivo prisma/migrations/0002_enable_rls.sql que:
1. Ativa RLS em TODAS as tabelas com tenant_id
2. Cria policy tenant_isolation em cada uma
3. Cria role de aplicação `app_user` que respeita RLS
4. Cria role `migration_user` com BYPASSRLS para migrations
5. Concede grants apropriados

Crie tests/rls.test.ts em packages/db que verifica que cada tabela tem RLS
ativo e a policy correta. Use testcontainers para subir Postgres em isolamento.

Não esqueça: tabelas globais (Tenant, User, UserTenant, UsageLog) NÃO têm RLS.
```

### Prompt 0.3 — Seed inicial (DEV apenas)

```
Crie packages/db/seed.ts que popula DEV com:
- 1 tenant 'cardanstencar' (CNPJ fictício para dev)
- 1 user admin@cardanstencar.dev (senha 'admin123' hashada com Argon2id+pepper)
- 1 user editor@cardanstencar.dev
- 10 contatos fake (Faker pt-BR) com opt-in para ambos canais
- 2 templates (1 email, 1 WhatsApp)
- 1 segmento "Todos com opt-in WhatsApp"

IMPORTANTE: o script deve abortar com erro se NODE_ENV === 'production'.
```

## Fase 1 — Auth e multi-tenancy (1 semana)

### Prompt 1.1 — Setup NestJS api com módulos base

```
Em apps/api, configure NestJS 10 com:
- ConfigModule (carrega .env)
- PrismaModule (PrismaService como singleton com método runInTenant — ver docs/SKILL.md seção 4)
- Health endpoints /health/live e /health/ready (DB + Redis)
- Logger pino
- Pipe global de validação Zod (nestjs-zod)
- Filter global de exceções
- CORS configurado para app.totalcampanha.com.br e localhost:3000

Crie módulos vazios (só module.ts, controller.ts placeholder):
- AuthModule
- TenantsModule
- UsersModule
- ContatosModule
- SegmentosModule
- TemplatesModule
- CampanhasModule
- ConexoesModule
- InboxModule
- AnalyticsModule
- BillingModule
- WebhooksModule
- SuperAdminModule
- PublicModule

Configure swagger em /api/docs (só em DEV/STAGING).
```

### Prompt 1.2 — Implementar AuthModule completo

```
Implemente AuthModule seguindo RULES.md seção 3 e SKILL.md.

Endpoints:
- POST /auth/signup (cria Tenant + User admin)
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- POST /auth/forgot
- POST /auth/reset
- POST /auth/2fa/setup
- POST /auth/2fa/verify

Padrão:
- Senha: Argon2id (lib 'argon2'), pepper de env AUTH_PEPPER
- Email guardado como hash (sha256 + pepper) + cleartext
- Access JWT 15min, refresh 7d
- Refresh rotation OBRIGATÓRIA
- Cookies HttpOnly+Secure+SameSite=Lax em prod
- Rate limit 5 tentativas/15min/IP+email (use @nestjs/throttler com Redis)
- Mensagens de erro sempre genéricas
- 2FA TOTP com otplib

Crie JwtAuthGuard. Não implemente TenantRoleGuard ainda — só no Prompt 1.3.

Testes:
- Unit: argon2 verify, jwt sign/verify, email hash
- Integration: signup flow completo, login OK, login senha errada (mensagem genérica),
  refresh rotation, 2FA flow

Lembre-se: signup CRIA o tenant e o primeiro user admin. Não permita signup
em tenant existente — para isso usa-se /tenants/atual/usuarios (convite, fase futura).
```

### Prompt 1.3 — Multi-tenancy com RLS

```
Implemente o sistema de tenant:

1. JWT payload inclui: { sub: userId, tid: tenantId, role: 'ADMIN'|'EDITOR_CAMPANHA'|'VISUALIZADOR' }
   Após login, se o user tem múltiplos tenants, retornar lista para escolha
   e gerar JWT após escolha (endpoint POST /auth/select-tenant).

2. Decorator @TenantId() — ver SKILL.md seção 9
3. Decorator @Roles() + TenantRoleGuard que valida role do JWT contra @Roles
4. Interceptor TenantInterceptor que faz SET LOCAL app.current_tenant em toda
   request autenticada — implementado como middleware no PrismaService.runInTenant()

5. Suíte de testes em test/tenant-isolation/ (ver SKILL.md seção 7):
   - Crie 2 tenants, popule cada um com 5 contatos
   - 4 testes por entidade (leitura, list, update, delete cross-tenant)
   - Entidades cobertas: Contato, Segmento, Template, Campanha, Mensagem,
     ConexaoWhatsapp, ConexaoEmail

   Esta suíte é GATE no CI. Sem ela passando, não merge.
```

## Fase 2 — Contatos e opt-in (1 semana)

### Prompt 2.1 — CRUD Contatos + Importação CSV

```
Implemente ContatosModule completo:

- CRUD (POST, GET list com paginação e filtros, GET id, PATCH, DELETE soft)
- DELETE com ?lgpd=true → hard delete + anonimização em mensagens (RULES.md 5.3)
- POST /contatos/importar — multipart com CSV até 10MB
- GET /contatos/exportar — retorna CSV

Importação:
- Use 'papaparse' para parsing
- Detectar duplicatas por email OU telefone dentro do tenant
- Upsert por padrão (config ?modo=ignorar para pular duplicatas)
- Linhas inválidas vão para um relatório (devolvido na resposta)
- Telefones normalizados E.164 via libphonenumber-js (default Brasil)
- Emails lowercased
- Campos custom: qualquer coluna além das fixas vai pro JSONB extras

Performance: importação >1000 linhas vai para fila BullMQ (job em background),
devolve job_id e usuário acompanha via GET /contatos/importacoes/:jobId.

Testes:
- Unit do parser
- Integration: import 100 linhas, valida duplicatas, valida telefone inválido
- e2e com Playwright: upload via UI

NÃO esqueça do test/tenant-isolation para Contatos.
```

### Prompt 2.2 — Páginas públicas de opt-in/opt-out

```
Implemente PublicModule (sem auth):

- GET /p/opt-in/:tenantSlug — Next.js page que renderiza form do tenant
  (logo do tenant, copy customizado, campos email/telefone, checkbox canais)
- POST /p/opt-in/:tenantSlug — submit
- GET /p/opt-out/:token — opt-out one-click (token criptografado com tenant+contato+canal)

Em POST /p/opt-in:
- Validar Zod
- Verificar reCAPTCHA v3 (env RECAPTCHA_SECRET)
- Upsert contato (se já existe, só atualiza opt_in_*)
- Inserir em opt_in_log com ação OPT_IN
- Capturar: ip, user-agent, origem, versão do termo (env CURRENT_OPT_IN_TERM_VERSION)
- Enviar email de confirmação (via SES) — double opt-in
- Resposta: tela de obrigado

Opt-out:
- Endpoint não exige login
- Token assinado HMAC (chave em env)
- Decodifica → atualiza Contato → grava em opt_in_log com OPT_OUT
- Tela: "Você foi removido da lista de [tenant]. Pronto!"

Frontend Next.js:
- Tema customizável por tenant (logo, cor primária)
- Mobile-first
- Sem rastreadores (analytics zero — é página pública sensível LGPD)
```

## Fase 3 — Templates e segmentos (1 semana)

### Prompt 3.1 — Segmentos com filtros AND/OR

```
Implemente SegmentosModule:

Estrutura de filtros (JSONB):
{
  "modo": "and",
  "condicoes": [
    { "campo": "tags", "operador": "contains", "valor": "cliente-ativo" },
    { "campo": "extras.regiao", "operador": "equals", "valor": "oeste" },
    { "modo": "or", "condicoes": [...] }  // aninhado
  ]
}

Operadores suportados:
- equals, not_equals
- contains, not_contains (para arrays e strings)
- gt, lt, gte, lte (datas e números)
- in, not_in (array)
- has_opt_in_email, has_opt_in_whatsapp (booleano)

Service:
- traduzFiltrosParaPrismaWhere(filtros) — recursivo
- contar(segmentoId) — retorna apenas count
- listar(segmentoId, paginação) — retorna contatos
- previsao(segmentoId, canal) — count APENAS com opt-in válido para o canal

UI Next.js:
- Componente <FiltroBuilder /> que renderiza recursivamente
- Botão "+ E" / "+ OU" / "+ Grupo"
- Preview de contagem em tempo real (debounced 500ms)
```

### Prompt 3.2 — Templates Email (MJML) e WhatsApp

```
Implemente TemplatesModule:

Email:
- CRUD com campo mjml (string)
- POST /templates/:id/preview — renderiza para HTML com Mustache para variáveis fake
- POST /templates/:id/teste-envio — envia o template para um email/celular do próprio tenant

WhatsApp:
- CRUD apenas com campos: metaTemplateName, metaLanguage, variaveis
- GET /templates/whatsapp/aprovados-na-meta — chama Meta API para listar templates aprovados
  na conta do tenant (usa token da ConexaoWhatsapp). Retorna lista para o user importar.
- Validação: ao salvar, chama Meta para verificar que o template existe e está APPROVED.

Biblioteca pré-aprovada:
- Pasta apps/api/src/modules/templates/biblioteca/{vertical}/*.json
- Verticais iniciais: autopecas, floricultura, perfumaria, materiais_construcao
- Endpoint GET /templates/biblioteca?vertical=autopecas

Frontend:
- Editor MJML usando biblioteca 'react-email' OU 'mjml-react' (pesquisar e decidir)
- Preview desktop/mobile lado a lado
- Para WhatsApp: tela de seleção da biblioteca + tela de importação da conta Meta
```

## Fase 4 — Conexões BYOA (1 semana)

### Prompt 4.1 — ConexaoWhatsapp (Meta Cloud API)

```
Implemente ConexoesModule (parte WhatsApp):

- POST /conexoes/whatsapp { wabaId, phoneNumberId, token }
  - Criptografa token com pgcrypto (use env TOKEN_KMS_KEY)
  - Chama GET https://graph.facebook.com/v22.0/{phone_number_id} com Bearer token
  - Se 200 e retorna display_phone_number, salva como ATIVA
  - Gera webhook_secret (32 bytes hex)
  - Mostra ao user a URL completa do webhook + secret para configurar na Meta
- PATCH /conexoes/whatsapp — atualiza token (criptografa de novo)
- DELETE /conexoes/whatsapp — soft delete
- POST /conexoes/whatsapp/testar — refaz a chamada GET para validar saúde
- POST /conexoes/whatsapp/enviar-teste { telefone } — envia mensagem template "hello_world" para validar end-to-end

CryptoService:
- encryptToken(plain): chama pgcrypto.pgp_sym_encrypt via $queryRaw
- decryptToken(encrypted): chama pgp_sym_decrypt
- Chave vem de Key Vault em PROD, de env em DEV

NUNCA logar o token decriptado. Em logs de chamada Meta, mascarar como Bearer...{last4}.

Frontend:
- Wizard de 4 passos:
  1. Pré-requisitos (CNPJ, Meta Business Manager verificado, número dedicado)
  2. Como obter token permanente (tutorial com prints + vídeo)
  3. Cola dados → testa
  4. Configura webhook na Meta (mostra URL + secret)
```

### Prompt 4.2 — ConexaoEmail (Amazon SES)

```
Implemente ConexoesModule (parte Email):

- POST /conexoes/email { dominio, remetente }
  - Chama SES CreateEmailIdentity (com DKIM signing)
  - Retorna os 3 CNAMEs DKIM + SPF include + DMARC sugerido
  - Salva como PENDENTE_VERIFICACAO
- POST /conexoes/email/verificar — re-checa SES GetEmailIdentity. Se DKIM verified, ATIVA.
- Job BullMQ recorrente: a cada 1h, re-checa conexões PENDENTE_VERIFICACAO. Auto-ativa quando verified.

UI:
- Mostrar registros DNS com botão "copiar" individual
- Status visual (pendente / verificando / ativo / erro)
- Alternativa: link para Resend para tenants que preferem SaaS de email
```

## Fase 5 — Campanhas e disparo (2 semanas)

### Prompt 5.1 — CampanhasModule

```
Implemente CampanhasModule:

CRUD + endpoints especiais:
- POST /campanhas — cria rascunho
- POST /campanhas/:id/calcular-estimativa — count contatos + custo estimado
- POST /campanhas/:id/disparar — valida e move para AGENDADA ou DISPARANDO
- POST /campanhas/:id/pausar
- POST /campanhas/:id/cancelar
- GET /campanhas/:id/analytics

Lógica de disparo:
1. Valida conexão ativa (WhatsApp ou Email conforme canal)
2. Valida template existe e está válido
3. Resolve segmento → lista de contatos com opt-in para o canal
4. Cria registros Mensagem com status PENDENTE
5. Enfileira jobs em dispatch:{canal} respeitando janela_envio e agendado_para
6. Worker consome com rate limit por tenant (ver tier Meta em ConexaoWhatsapp)

Throttling por tier (RULES.md 7.1):
- Implementar BullMQ rate limiter dinâmico — recalcular a cada job baseado no tier
  do tenant. Lib 'rate-limiter-flexible' como apoio se preciso.

Falha em massa (>10% das mensagens em 5min):
- Worker periódico observa contadores. Se ultrapassar, pausa a campanha + alerta Slack.
```

### Prompt 5.2 — Workers de dispatch

```
Em apps/worker, implemente:

DispatchEmailProcessor:
- Lê Mensagem.id
- Renderiza MJML → HTML com Mustache
- Chama SES SendEmail com unsubscribe header + tracking pixel
- Atualiza Mensagem.status para ENVIADA
- Log usage_log

DispatchWhatsappProcessor (ver SKILL.md seção 5):
- Já implementado no exemplo
- Atenção a códigos de erro Meta: 131026 (mensagem indeliverable),
  131047 (24h window passed), 131051 (unsupported message type)
- Mapear códigos para falhaMotivo legível

WebhookMetaProcessor:
- Consome fila webhook:meta
- Para cada status, atualiza Mensagem correspondente (lookup por providerMessageId)
- Atualiza contadores agregados em Campanha
- Se status='failed', incrementar Campanha.totalFalhas

RetryProcessor:
- Mensagens em FALHOU com falhaMotivo retryable (rate limit, 5xx Meta) → reenfileira
  com backoff exponencial. Max 5 retries.
```

### Prompt 5.3 — Inbox de respostas

```
Implemente InboxModule:

Webhook recebe mensagem in → cria/atualiza InboxConversa + InboxMensagem.
- Atualiza ultimoMsgAt
- janela24hExpiraEm = now + 24h (renova a cada msg in)
- Se conteúdo == 'SAIR'/'STOP'/'CANCELAR'/'PARAR' (case insensitive, trim):
  - Aciona opt-out automático
  - Responde com template "opt_out_confirmacao" se existir, senão mensagem livre dentro da janela

Endpoints:
- GET /inbox/conversas?status=aberta
- GET /inbox/conversas/:id/mensagens
- POST /inbox/conversas/:id/responder { conteudo }
  - Verifica janela24hExpiraEm > now (senão erro: precisa template)
  - Envia mensagem livre WhatsApp
  - Cria InboxMensagem direcao=out

Notificação: ao receber msg in, envia email para o tenant (configurável).

UI:
- Página /inbox com lista de conversas e detalhes lado a lado (WhatsApp-like)
- Indicador de janela 24h (countdown)
- Sino com badge no header
```

## Fase 6 — Super Admin, Billing e Analytics (1 semana)

### Prompt 6.1 — Super Admin (TotalUtiliti)

```
Implemente SuperAdminModule SEPARADO em rota /admin.

Auth:
- Coluna User.isSuperAdmin (boolean, default false)
- Set true só via SQL manual (não há endpoint para criar super admin)
- JWT separado (audience='super-admin', tenant=null)

Endpoints (RULES.md 1.6):
- GET /admin/tenants — lista, com MRR, último login, último disparo, status
- GET /admin/tenants/:id — detalhes
- POST /admin/tenants/:id/suspender — muda status SUSPENSO + audit
- POST /admin/tenants/:id/impersonate — gera JWT temporário do tenant (15min) com audit log
- GET /admin/usage — dashboard global de custos
- GET /admin/usage/por-tenant — agrupado, com filtro de período
- GET /admin/usage/por-servico
- GET /admin/audit — log auditoria

UI /admin separado do painel do tenant. Visual mais sóbrio. Sem branding.

Aba de custos por tenant (LIÇÃO DA TOTAL IA CONTÁBIL): existe DESDE O DIA 1, com:
- Custo hoje / semana / mês
- Breakdown por serviço
- Tabela por tenant
- Alertas configuráveis
```

### Prompt 6.2 — Billing com Asaas

```
Implemente BillingModule:

- POST /billing/assinar — cria subscription Asaas
- GET /billing/atual — retorna plano, status, vencimento
- POST /billing/atualizar-plano
- POST /billing/cancelar
- Webhook POST /webhooks/asaas:
  - payment_confirmed → ativa tenant
  - subscription_overdue → status INADIMPLENTE
  - subscription_canceled → status CANCELADO + freeze de envios

Trial:
- Signup cria tenant TRIAL com trialAteEm = now + 14d
- Job diário: tenants TRIAL com trialAteEm < now → status INADIMPLENTE (freeze envios)
- Email lembrete 7d, 3d, 1d antes do fim do trial

UI:
- Página /billing com plano atual, próxima cobrança, histórico
- Botão "Adicionar pagamento" → redirect Asaas checkout
```

### Prompt 6.3 — Analytics

```
Implemente AnalyticsModule:

GET /campanhas/:id/analytics — retorna:
- total_enviadas, total_entregues, total_lidas, total_respondidas, total_falhas
- taxa_entrega, taxa_leitura, taxa_resposta, taxa_falha
- custo_estimado_brl, custo_real_brl
- timeline (gráfico ao longo do tempo)
- por_motivo_falha (breakdown)

GET /analytics/comparativo?campanhaIds=a,b,c
GET /analytics/dashboard — visão geral do tenant (últimos 30d)

Materialização: criar view materializada em PostgreSQL para queries pesadas,
refresh a cada 5min via cron job.

UI:
- Recharts no frontend
- Export CSV
```

## Fase 7 — Infra PROD e deploy (1 semana)

### Prompt 7.1 — Bicep para PROD

```
Em infra/, crie main.bicep + main.parameters.prod.jsonc baseado em
docs/ARCHITECTURE.md seção 6 e na referência do Bicep do Total IA Contábil
(documentado em instrucoes/instrucao_azure.md).

Recursos:
- Resource Group rg-totalcampanha-prod (criar via az group create antes)
- VNet + subnets + private DNS zones
- PostgreSQL Flexible Server GP_Standard_D2ds_v4 Zone-Redundant HA, 128GB,
  backup 35d geo-redundante, PgBouncer ativo, private endpoint
- Azure Cache Redis C1 Standard com maxmemory-policy=noeviction, private endpoint
- Storage Account GRS, soft delete 14d, private endpoint
- Container Apps Environment zone-redundant
- 3 Container Apps: tc-web-prod, tc-api-prod, tc-worker-prod (min-replicas=1!)
- ACR Standard acrtotalcampanha01
- Key Vault kv-totalcampanha-prod01, private endpoint
- Log Analytics + Application Insights
- Budget alerts (R$ 3000 warning, R$ 4000 stop-freeze)

Não use min-replicas=0 em prod NUNCA (lição da Total IA Contábil).

Não esqueça de model versions explícitas se incluir Azure OpenAI (não precisa no MVP).

Outputs do Bicep: FQDNs, customDomainVerificationId, Key Vault URI.
```

### Prompt 7.2 — Pipeline GitHub Actions

```
Crie .github/workflows/:

ci.yml — em todo PR:
- pnpm install
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm test:tenant-isolation
- pnpm build

deploy-api.yml — em push para main, paths: apps/api/**:
- CI steps
- docker build + push acrtotalcampanha01.azurecr.io/tc-api:${{ github.sha }}
- az containerapp update --name tc-api-prod --image ...
- Health check
- Notify Slack

Similar para deploy-web.yml e deploy-worker.yml.

Cada deploy mantém revision anterior por 7 dias (auto-rollback se health falhar).
```

### Prompt 7.3 — Configurar custom domain

```
Seguir instrucoes/instrucao_deploys.md seção 4 (custom domain em 2 fases):

Fase A:
1. Bicep deploy SEM baseDomain → obter customDomainVerificationId
2. Mostrar registros DNS necessários (CNAME + TXT) para configurar no Registro.br

Fase B (após DNS propagar):
3. Vincular domínio + certificado managed (Let's Encrypt)
4. Validar HTTPS funcionando em app.totalcampanha.com.br, api.totalcampanha.com.br,
   opt-in.totalcampanha.com.br
```

## Fase 8 — Onboarding e go-live (3 dias)

### Prompt 8.1 — Onboarding tenant + Cardans Tencar

```
Configurar primeiro tenant em PROD:
1. Cardans Tencar (CNPJ real)
2. Hamilton como admin
3. Importar ~250 contatos do relatório do Claudinei (validar opt-in primeiro!)
4. Cardans Tencar configura própria Meta Cloud API (apoio TotalUtiliti)
5. Aprovar 1 template "promocao_barras_direcao" na conta Meta da Cardans
6. Primeira campanha piloto para 20 contatos selecionados (não toda a base)
7. Acompanhar métricas

Critério de sucesso piloto:
- 70%+ delivery rate
- 50%+ leitura
- 0 reports de spam
- <5% opt-out
- Pelo menos 1 resposta convertida em venda
```

---

## Checklist meta (antes de declarar "MVP pronto")

- [ ] CLAUDE.md, README.md, todos os docs/ atualizados
- [ ] Testes unitários cobrindo > 70% das services
- [ ] Suíte tenant-isolation passando 100%
- [ ] e2e Playwright cobrindo: signup, login, criar campanha, disparar, ver analytics
- [ ] Bicep deploya PROD do zero sem intervenção (idempotente)
- [ ] PostgreSQL HA validado (failover manual testado)
- [ ] Webhook Meta validado end-to-end (mensagem real entregue + status recebido)
- [ ] Página de opt-in renderiza para 3 tenants diferentes com branding
- [ ] Painel super admin mostra custo por tenant em tempo real
- [ ] DPA + Política de privacidade públicas
- [ ] Documentação de onboarding WhatsApp em vídeo + PDF
- [ ] Cardans Tencar fez primeira campanha real com sucesso
