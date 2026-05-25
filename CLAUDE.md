# CLAUDE.md — Total Campanha

> Este arquivo é lido automaticamente pelo Claude Code ao abrir o projeto. Mantém regras imperativas e contexto mínimo. Detalhes longos vão em `docs/` e `instrucoes/`.

## Identidade do projeto

**Total Campanha** é uma plataforma SaaS B2B multi-tenant para envio de campanhas de **marketing por Email e WhatsApp**, no modelo **BYOA (Bring Your Own Account)** — o tenant conecta a própria conta Meta Cloud API (WhatsApp Business) e o próprio domínio/servidor de email. A plataforma orquestra: contatos, segmentação, templates, agendamento, envio (com throttling e retry), webhooks de status, inbox de respostas, analytics, opt-in/opt-out, billing.

**Mercado-alvo:** PMEs B2B brasileiras (autopeças, distribuidoras, floriculturas, perfumarias, materiais de construção, óticas, papelarias). **Cliente piloto:** Cardans Tencar (autopeças, ~250 contatos B2B).

**Stack:**
- Backend: NestJS (Node 20), Prisma 5, PostgreSQL 16 com RLS, Redis + BullMQ
- Frontend: Next.js 14 (App Router), Tailwind, shadcn/ui
- Infra: Azure Container Apps, PostgreSQL Flexible Server (HA), Azure Cache for Redis, Azure Key Vault, Blob Storage, Application Insights, Bicep para IaC
- Integrações: Meta Cloud API (WhatsApp), Amazon SES ou Resend (Email), Stripe ou Asaas (Billing)

## Regras imperativas que NUNCA são violadas

### Banco de dados em PROD

- **PROIBIDO** rodar `prisma db push` (qualquer variante, com ou sem `--accept-data-loss`) em PROD.
- **PROIBIDO** rodar `prisma migrate reset` em PROD.
- **PROIBIDO** rodar seed que apague dados em PROD.
- Toda alteração de schema em PROD usa `$executeRawUnsafe()` com `ALTER TABLE`, `CREATE INDEX CONCURRENTLY`, etc.
- Antes de qualquer alteração de schema em PROD: executar checklist de `instrucoes/instrucao_recuperacao_producao.md` seção 3 (snapshot, contagem de tabelas críticas, plano de rollback).
- Toda mutação destrutiva (DROP, TRUNCATE, DELETE sem WHERE) em PROD exige **confirmação humana explícita do João** antes da execução.

### Multi-tenancy

- TODA tabela de domínio tem `tenant_id UUID NOT NULL` indexado.
- RLS está ativo em TODAS as tabelas de domínio. Policy força filtro por `current_setting('app.current_tenant')::uuid`.
- Middleware de tenant injeta `SET LOCAL app.current_tenant` em toda transação.
- `tenant_id` **SEMPRE** vem do JWT, **NUNCA** do request body/query.
- Antes de cada PR é obrigatório executar a suíte de **testes de isolamento cross-tenant** (`test/tenant-isolation/`).

### Segurança

- Senhas: **Argon2id + pepper** (variável `AUTH_PEPPER` em Key Vault). Bcrypt é proibido.
- Tokens WhatsApp Cloud API por tenant: armazenados criptografados no banco usando `pgcrypto` (`pgp_sym_encrypt` com chave em Key Vault). **NUNCA** em texto puro.
- Access token JWT: 15 min, HttpOnly cookie.
- Refresh token: 7 dias, HttpOnly + Secure + SameSite, rotation obrigatória.
- Toda mensagem de erro de auth: genérica ("Email ou senha incorretos"). Nunca revelar se email existe.
- Rate limiting em todos os endpoints de auth e de disparo.

### LGPD

- **Operador** dos dados que o tenant carrega (contatos). DPA obrigatório no termo de uso.
- **Controlador** dos dados de identificação do próprio tenant (CNPJ, responsável, faturamento).
- Toda página de opt-in registra: timestamp, IP, user-agent, origem (URL, QR, etc), versão do termo aceito.
- Opt-out é one-click, presente em todo email e template WhatsApp.
- Direito ao esquecimento: endpoint `DELETE /contatos/:id` faz hard delete em cascata + anonimiza logs de mensagens (`destinatario_hash` em vez de telefone/email).

### Custo e cobrança

- Toda chamada a serviços externos pagos (Meta Cloud API, SES, Azure OpenAI futuro) é instrumentada em `usage_log(tenant_id, servico, custo_estimado_brl, created_at)` **no momento da chamada**, não em batch.
- Painel Super Admin tem aba de custos por tenant **desde o dia 1**, não depois.

### Deploys

- Deploy só por pipeline (GitHub Actions). **Proibido** `docker push` manual de imagem `:prod`.
- Toda revisão de Container App fica disponível por 7 dias para rollback.
- Smoke test pós-deploy é obrigatório: health check + login real + criação de campanha test + envio para número/email interno.

### Blindagem contra regressão (Git)

> Esta seção blinda o repositório contra os incidentes vividos em projetos
> anteriores: regressão por deploy de feature branch direto, branches órfãs
> nunca mergeadas, divergência crônica dev↔main, perda de dados por comandos
> Prisma destrutivos. **Nenhuma regra abaixo é flexível.**

**Modelo de branches**

- `main` — produção. Protegida (PR obrigatório, status checks obrigatórios). Todo
  deploy de PROD sai daqui. **Ninguém faz push direto na `main`.**
- `dev` — integração/staging. Recebe os PRs primeiro.
- `feat/*`, `fix/*`, `hotfix/*` — curtas, partem de `dev` atualizado, voltam pra
  `dev` via PR. **NUNCA são deployadas direto.**
- Toda feature branch é deletada após o merge.

**Regras inegociáveis de deploy** (texto literal — não flexibilizar)

- Deploy de PROD só pelo workflow GitHub Actions, disparado por push em `main`
  ou tag `prod-*`. **Proibido** `docker push` de imagem `:prod` manual.
  **Proibido** o workflow de deploy disparar de feature branch.
- Antes de qualquer build pra PROD, rodar e mostrar — se `false`, **ABORTAR** e
  abrir PR pra `main` primeiro:
  ```
  git fetch origin
  git merge-base --is-ancestor HEAD origin/main
  ```
- Antes de buildar, comparar HEAD com o tip atual de PROD — se `false`,
  **ABORTAR** (há trabalho em PROD que seria apagado):
  ```
  PROD_TIP=$(git rev-list -n1 "$(git tag --list 'prod-*' --sort=-creatordate | head -1)")
  git merge-base --is-ancestor "$PROD_TIP" HEAD
  ```
- Antes de buildar, listar arquivos deletados desde a última tag de PROD:
  ```
  git diff --name-status "$PROD_TAG"..HEAD | grep '^D'
  ```
  Qualquer `D` em diretório de código exige confirmação humana explícita
  (`yes`) ou a label `approved-deletion` na PR.
- Após deploy bem-sucedido, criar tag `prod-AAAAMMDD-HHmm` apontando para o
  commit deployado (feito automaticamente pelo workflow).

**Regras inegociáveis de dados** — ver seção "Banco de dados em PROD" acima.
Resumo: proibido em PROD `prisma db push`, `prisma migrate reset`,
`prisma db seed`, `DROP TABLE`, `TRUNCATE TABLE`; schema em PROD só via
`$executeRawUnsafe('ALTER TABLE…')` **precedido de backup**; `prisma generate`
pode ter efeito colateral — anunciar antes de rodar.

**Regras de comunicação**

- SEMPRE logar o comando que vai rodar e o porquê **antes** de executar.
- Se uma guarda (hook ou CI) abortar: **não contornar** — `--no-verify` é
  proibido salvo ordem explícita do João. Avisar e esperar.
- Comandos com rate limit (`az containerapp exec` e similares): no máximo 3 por
  sessão, com espera de 60s entre eles.

**Protocolo de hotfix urgente (exceção controlada)**

- Saiu de uma branch `hotfix/*` direto pra PROD? OK — mas o **próximo passo
  obrigatório**, antes de fechar a sessão, é abrir PR dessa branch pra `main`
  **e** pra `dev`. Sem isso a branch vira órfã e o fix se perde no próximo deploy.

**Higiene de branches**

- Toda branch feature é deletada após o merge.
- Toda sexta: triagem de branches stale (>14 dias sem commit).
- `dev` e `main` devem estar sincronizadas; se divergirem mais de 5 commits,
  abrir PR de sync.

**Histórico de incidentes** (append-only — toda regressão futura vira entrada aqui)

- _(vazio — nenhum incidente de regressão registrado neste repositório.)_

### Antigravity (Claude Code) — regras de execução

- Antes de QUALQUER comando destrutivo em PROD: confirmação humana explícita. Se em dúvida se algo é destrutivo, perguntar.
- Antes de alterar schema: ler `instrucoes/instrucao_recuperacao_producao.md` na íntegra.
- Antes de tocar em infra Azure: ler `instrucoes/instrucao_azure.md`.
- Antes de deploy: ler `instrucoes/instrucao_deploys.md` e executar o checklist pós-deploy.
- Antes de mexer em integração WhatsApp: ler `instrucoes/instrucao_whatsapp_byoa.md`.
- Nunca commitar segredo. `.env` está no `.gitignore`. Variáveis sensíveis ficam em Key Vault, referenciadas como `secretref:` nos Container Apps.
- Quando criar arquivo de instrução nova ou atualizar memória: **atualizar `instrucoes/memoria.md`** com data e resumo.
- Português brasileiro em toda documentação, comentários e nomenclatura de domínio (variáveis técnicas podem permanecer em inglês para padrão da indústria).

## Comandos rápidos

```bash
# Desenvolvimento local
pnpm install
pnpm db:up                       # docker-compose up postgres redis
pnpm db:migrate                  # prisma migrate dev
pnpm db:seed                     # APENAS dev/staging
pnpm dev:api                     # backend NestJS
pnpm dev:web                     # frontend Next.js
pnpm dev:worker                  # worker BullMQ

# Testes
pnpm test                        # unit
pnpm test:e2e                    # e2e
pnpm test:tenant-isolation       # OBRIGATÓRIO antes de cada PR

# Lint / type-check
pnpm lint
pnpm typecheck

# Deploy (só pipeline)
gh workflow run deploy-api.yml --ref main
```

## Onde achar mais detalhes

| Pergunta | Documento |
|---|---|
| O que o produto faz e roadmap | `docs/PRD.md` |
| Arquitetura técnica | `docs/ARCHITECTURE.md` |
| Schema, rotas, contratos | `docs/SPECS.md` |
| Regras de negócio e segurança | `docs/RULES.md` |
| Padrões de código com exemplos | `docs/SKILL.md` |
| Princípios de UX (perenes, regem todo design) | `docs/UX_PRINCIPLES.md` |
| Backlog de UX priorizado por sprint | `docs/UX_BACKLOG.md` |
| Como construir do zero (passo a passo) | `docs/BOOTSTRAP.md` |
| Memória de contexto do Antigravity | `instrucoes/memoria.md` |
| Azure (deploy, scaling, custos) | `instrucoes/instrucao_azure.md` |
| Pipeline de deploy | `instrucoes/instrucao_deploys.md` |
| Recuperação de incidentes | `instrucoes/instrucao_recuperacao_producao.md` |
| Onboarding WhatsApp BYOA | `instrucoes/instrucao_whatsapp_byoa.md` |
| LGPD operador/controlador | `instrucoes/instrucao_lgpd_dpa.md` |
| Runbook de deploy PROD (passo a passo) | `docs/runbooks/deploy-prod.md` |
| Como usar Claude Code neste projeto | `docs/working-with-claude-code.md` |
