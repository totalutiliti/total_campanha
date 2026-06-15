# memoria.md — Total Campanha

> Memória persistente para o Antigravity/Claude Code. Atualizar sempre que:
> - Uma decisão arquitetural não trivial for tomada
> - Um incidente for resolvido (lição)
> - Uma instrução nova for criada
> - O João disser explicitamente "lembre-se disso"
>
> Formato: data + categoria + resumo. Manter ordem decrescente de data.

---

## 2026-06-15 — Infra de lançamento ENXUTA (main.lean.bicep) + aba Manual

**Categoria:** Infra / Custo / Frontend

Decisão de custo pro go-live: PROD sobe num perfil **enxuto** (~R$ 300/mês), não no HA
do `main.bicep` (~R$ 2.000-3.000/mês). Razão: modelo **BYOA + multi-tenant** → custo é
**fixo e compartilhado** entre todos os tenants (marginal por cliente ~R$ 1-5), então o
limitante é valor/mercado, não custo. Break-even ≈ **4 clientes** a R$ 97.

- **Novo `infra/main.lean.bicep` + `main.parameters.prod-lean.jsonc`** (budget R$ 800):
  Postgres **B1ms Burstable, sem HA**, 32GB, backup 7d local; Redis **Basic C0**; Storage
  **LRS**; **sem VNet/Private Endpoints** (público + firewall + TLS); Container Apps
  api/web **scale-to-zero** (cold start 20-40s aceito), worker min 1, **0.5 vCPU/1Gi**;
  **Key Vault público (RBAC)** — de quebra resolve o blocker do smoke-test em runner
  público. **Sem PgBouncer** (não existe no Burstable) → no lean o `DATABASE_URL` conecta
  direto na **5432**, não em pool.
- `main.bicep` (HA) fica intacto como referência. **Gatilhos pra migrar p/ HA:** ~15-25
  clientes pagantes, CPU>70% sustentada, exigência de SLA ou rede privada/compliance.
- **Bug latente corrigido no `main.bicep`:** `var apps` embutia
  `appApi.identity.principalId` (runtime) usado em `for` → **BCP178**; o deploy HA
  falharia no 1º provisionamento (nunca pego porque PROD nunca subiu). Agora itera nomes
  estáticos e indexa principalIds. Ambos templates validados com `az bicep build` (exit 0).
- **Frontend:** nova **aba Manual** (`/manual`) com passo a passo contextual de cada tela
  (abre filtrada pela aba atual via `?secao=`); slots de captura de tela em
  `apps/web/public/manual/`. No ar no dev (revision `r06151055`).
- **Preços** revisados (não alterados): Starter R$ 97 / Pro R$ 297 / Enterprise R$ 997 —
  alinhados ao mercado BR; recomendação foi adicionar tier grátis + plano anual em vez de
  baixar a régua (custo baixo é vantagem de margem, não motivo p/ cost-plus).

## 2026-06-12 — Prontidão de produção + identidade visual (branch feat/prontidao-producao)

**Categoria:** Produção / UX / Segurança

Mesma sessão da auditoria (entrada abaixo): implementados TODOS os bloqueantes de
código apontados por ela, mais a identidade visual da skill
`.claude/skills/identidade-visual-totalia` aplicada ao app inteiro com UX para
vendedores. `pnpm -r lint/typecheck/build` verdes. **Backend:**

- **Gate de billing no disparo** — `prepararDisparo` bloqueia tenant não-ATIVO/TRIAL
  (e TRIAL vencido); defesa em profundidade nos 2 dispatch processors do worker
  (mensagem CANCELADA com motivo). Custo Meta não vaza mais para inadimplente.
- **SES real** — os dois MailServices (api+worker) enviam via SESv2 `SendEmail`
  quando `MAIL_PROVIDER=ses` (headers custom suportados p/ List-Unsubscribe);
  SMTP autenticado como fallback; validação cruzada no boot (ses exige AWS keys).
- **Opt-out de verdade** — worker emite token HMAC real (OptOutTokenService
  portado), injeta rodapé de descadastro em TODO e-mail de campanha, expõe
  `{{opt_out_url}}` ao template; API ganhou `POST /p/opt-out/:token` (one-click
  RFC 8058). `placeholder-token` morto.
- **Senha fim-a-fim** — forgot envia e-mail real (link `/redefinir-senha?token=`),
  telas `/esqueci-senha` + `/redefinir-senha`, link na tela de login,
  `PATCH /auth/senha` (trocar senha autenticado, Throttle 5/15min).
- **Webhooks endurecidos** — Meta: URL agora é
  `/webhooks/meta/{slug}/{webhookSecret}` (slug é público; secret autentica o
  POST; comparação timing-safe; POST inválido = 200 silencioso, handshake
  inválido = 403 alto) + `@SkipThrottle` no controller (rajada de status);
  Asaas: **fail-closed** sem `ASAAS_WEBHOOK_TOKEN`. `instrucao_whatsapp_byoa.md` §6 atualizada.
- **Vazamento de token corrigido** — erro da Meta não ecoa mais o token digitado
  na resposta HTTP (mensagem limpa; detalhe só em log com maskBearer).
- **Disparo robusto** — transição de status atômica (updateMany-guard) antes de
  criar mensagens (2 cliques concorrentes ≠ envio duplo); `jobId = mensagemId`
  (idempotência BullMQ); retomada de PAUSADA re-enfileira só ENFILEIRADA
  existentes (não duplica); RetryProcessor reconcilia jobs perdidos (re-add com
  mesmo jobId → dedupe preserva delay/throttle) e usa jobId único por tentativa;
  processors com guarda de idempotência (só processam PENDENTE/ENFILEIRADA).
- **Teste-envio WhatsApp real** em produção (sendTemplate + usage_log) — stub 412 removido.
- **tierMeta via webhook** `account_update`/`messaging_limit_update` (LIÇÃO L11).
- **Billing fecha o ciclo** — `AsaasClient.linkPagamento()` (invoiceUrl do 1º
  payment), exposto em `POST /billing/assinar` e `GET /billing/atual`.
- Inbox enriquecido (conversa devolve contato + última mensagem p/ a tela).

**Frontend (identidade total + vendedores):** tokens claro/escuro da skill em
`globals.css`/tailwind.config; kit `components/ui/*` (Button/Card/Input/Label/
Badge/PasswordInput/Dialog/Alerts, CVA + cn); `LogoTotal` (barras verdes +
wordmark CAMPANHA); shell sidebar w-64 com nav por papel (Início, Campanhas,
Contatos, Grupos, Mensagens, **Respostas**, Conexões, **Plano** [admin],
**Minha conta**) + footer usuário/sair/toggle tema (next-themes, claro default)
+ mobile com menu; `BannerConta` (trial acabando/inadimplente com ação);
telas novas: Respostas (inbox 2 colunas + thread + janela 24h explicada),
Plano (cards Starter/Pro/Enterprise + assinar/trocar/cancelar com Dialog +
link de pagamento), Minha conta (trocar senha); login/esqueci/redefinir na
identidade; `lib/erro.ts` reescrito (Zod issues → frases pt-BR, NUNCA JSON cru);
TODAS as ~32 telas existentes (tenant + admin + públicas) reestilizadas com
tokens/kit/lucide e textos de vendedor (2 agentes); `/dev/*` removido;
`campanha-status.ts` com pares dark.

**Pipeline:** guarda de ref `main` nos 3 deploys (workflow_dispatch não builda
mais de feature branch); `prisma generate` antes do CI; smoke também em
web/worker (L08); rollback por `revision activate` (modo Single — runbook §11
atualizado); Bicep: probes live/ready nos apps, ACR **existente** parametrizado
(`acrResourceGroup`, módulo `modules/acr-pull.bicep` — resolve a colisão global
de nome), action group + alertas (api 5xx, PG cpu>80%, Redis mem>90%);
smoke-test-prod.sh: credenciais via env/GitHub Secrets (KV privado é inacessível
do runner) + criação/remoção de campanha de teste (checklist CLAUDE.md);
`infra/dev/deploy-dev-local.ps1` (build+push+update dev).

**Pendências manuais do João para PROD** (não automatizáveis daqui): branch
protection na UI do GitHub; registrar domínio + DNS; conta AWS com SES em modo
produção + keys; conta Asaas + `ASAAS_API_KEY`/`ASAAS_WEBHOOK_TOKEN`; Service
Principals + `AZURE_CREDENTIALS`; provisionar `rg-totalcampanha-prod` (Bicep
fases A/B) + popular Key Vault + wiring env/secrets + KEDA scaler; usuários de
smoke; reativar triggers `push` dos deploys; rotacionar senha SA de dev;
decidir trial do piloto (expira 16/06). Sem UI de 2FA-setup e sem gestão de
usuários adicionais do tenant (débitos conhecidos, API existe).

---

## 2026-06-12 — Auditoria completa do ambiente DEV Azure (2 bugs de env corrigidos)

**Categoria:** Auditoria / Infra

Auditoria funcional + segurança + infra do deploy dev no Azure (UI tela a tela no
Chrome, smoke da API, 3 agentes de código). Tudo que foi criado de teste foi
removido (hard delete LGPD). **Duas correções aplicadas no ambiente (novas revisions):**

1. **`tc-web-dev` sem `API_BASE_URL`** → SSR das páginas públicas caía no fallback
   `localhost:3001` e `/p/opt-in/*` + `/p/opt-out/*` retornavam **404** (opt-in LGPD
   fora do ar desde o deploy). Fix: `az containerapp update --set-env-vars API_BASE_URL=<fqdn da api>`.
2. **`tc-worker-dev` com `DATABASE_URL`=app_user** → processors cross-tenant
   (retry, verificar-emails, trial) varriam com RLS ativo e recebiam **0 linhas em
   silêncio** — retry/verificação de domínio/expiração de trial inertes desde o deploy.
   Fix: `DATABASE_URL=secretref:database-migration-url` (migration_user, BYPASSRLS,
   como o código do worker documenta). `infra/dev/README.md` atualizado com os dois ⚠️.

**Funciona (verificado ao vivo):** login/JWT/refresh, RBAC (tenant não acessa /admin),
validação Zod nos DTOs, busca/CRUD/import xlsx-csv de contatos (wizard 4 passos,
E.164 ok), grupos com prévia live, templates email com preview MJML, campanha
rascunho+estimativa com travas corretas (sem opt-in → 0 destinatários; sem conexão →
botão disparar desabilitado), conexão WhatsApp valida na Meta antes de salvar,
conexão email stub com tabela DNS, painel Super Admin completo (custos, tenants,
auditoria registrando cada ação), opt-in público pós-fix, opt-out gracioso com token
inválido, direito ao esquecimento (4 hard deletes), Swagger off em prod, logs pino
com authorization REDACTED.

**Achados pendentes (relatório completo na conversa de 12/06):**
- ALTO: webhook Meta POST sem assinatura (slug é público — forja de opt-out/inbox/DoS).
- ALTO: webhook Asaas fail-open sem `ASAAS_WEBHOOK_TOKEN` (200 anônimo — confirmado ao vivo).
- ALTO: erro da Meta ecoa o **token completo** digitado na resposta HTTP do
  `POST /conexoes/whatsapp` (sanitizar com maskBearer antes de propagar).
- Bloqueantes de PROD (agentes): email sem provider real (SMTP stub, `ses` cai p/ SMTP);
  opt-out `placeholder-token` no List-Unsubscribe; INADIMPLENTE não bloqueia disparo;
  billing sem UI; esqueci-senha inexistente (e onboarding via admin depende dele);
  ACR `acrtotalcampanha01` já existe no RG dev (Bicep PROD vai colidir); smoke-test
  lê Key Vault privado de runner público (falha sempre); branch protection não aplicada.
- Sem UI: Inbox e Billing (APIs existem, nav não tem as telas).
- Trial do tenant piloto expira **16/06/2026** → vira INADIMPLENTE (sem bloqueio de disparo).
- Redis dev com min-replicas=0 (drift vs min=1 documentado; não derrubou nada ainda).
- `.gitignore` com regra `*.local.md` ainda não commitada (protege `acessos-azure-dev.local.md`
  que tem senha real do SA dev — commitar e rotacionar senha no go-live).



**Categoria:** Infra / Deploy

Primeiro deploy real do app no Azure — ambiente **dev/POC** seguindo o padrão dos
projetos irmãos (`rg-kegsafe-dev`): ACR Basic + Postgres Flexible Burstable +
Container Apps Consumption, **sem** VNet/PE/Key Vault (isso é só PROD). Runbook
completo em `infra/dev/README.md`. Segredos em `../.azure-dev-secrets.env` (fora do repo).

- **No ar:** web `https://tc-web-dev.<dom>`, api `.../api/v1`, painel `/admin`.
  `<dom>` = `yellowbeach-5d39f3f8.brazilsouth.azurecontainerapps.io`. Login tenant
  `admin@cardanstencar.dev`/`admin123`; super admin `joao@totalutiliti.com.br`.
- **Scale-to-zero** em api/web (compute ~US$0 ocioso; cold start ~20-40s na 1ª req).
  **Redis ficou min=1** — a API conecta no boot e o cold-start do Redis derrubava a
  ativação. Custo ≈ **US$31/mês** (ACR $5 + PG B1ms $13 + Redis $13). Reduzir: parar
  o Postgres entre demos e/ou Redis min=0.
- **DB:** `migrate deploy` como `tcadmin` (no Flexible Server o admin TEM `bypassrls`+`createrole`,
  então a migration `0002_enable_rls` roda inteira); papéis `app_user`/`migration_user`
  com senha + grants; `seed` + `criar-super-admin` com o mesmo `AUTH_PEPPER` dos apps;
  `azure.extensions=PGCRYPTO,UUID-OSSP`.
- **5 bugs de Dockerfile corrigidos** (valiam p/ PROD também): faltava `pnpm --filter
  @total-campanha/db build`; `deploy --prod` com filtro `...` (3 projetos); Prisma
  Client sumia no `deploy --prod` (runtime passou a usar o estágio de build); faltava
  `apk add openssl` (Alpine 3/OpenSSL 3 vs engine openssl-1.1); `apps/web/public/.gitkeep`.
- **Build:** `az acr build` quebra no cliente Windows (UnicodeEncodeError do colorama
  ao transmitir o log do pnpm) → **build local com Docker + push** (tag `:dev`).
  Contexto via `git archive HEAD` (sem `node_modules`/symlinks que travavam o tar).
- **Ressalva:** cookie de refresh cross-site (SameSite=None) entre api e web em domínios
  diferentes — sessão pode cair em ~15min se o navegador bloquear cookie de terceiro.
  Aceitável p/ POC; em PROD usar domínio próprio (`api.<dominio>` + `app.<dominio>`).
- Deploy automático em push na `main` segue **desabilitado** (PROD Azure não provisionado).

## 2026-06-01 — Frontend Super Admin + criação de tenant pelo painel

**Categoria:** Frontend / Super Admin

Construído o **painel Super Admin** no `apps/web` (`/admin/*`). Antes só existia a
API `/admin/*`; o frontend era débito conhecido (este arquivo o listava como
pendente em "frontend de campanhas/billing/super-admin").

- **Escopo isolado** em `app/admin/`, separado do app do tenant. `lib/admin/context.tsx`
  tem sessão própria: login `POST /admin/auth/login`, token `aud='super-admin'` em
  memória + `sessionStorage`. Não há refresh nesse escopo (token de 15 min); em
  401/expiração a sessão encerra e manda para `/admin/login`. Helpers em
  `lib/admin/format.ts` e `lib/admin/ui.tsx`.
- **Telas:** `/admin/login`, visão geral `/admin` (custos + contagem de tenants),
  `/admin/tenants`, detalhe `/admin/tenants/[id]` (métricas + suspender + impersonar),
  `/admin/custos`, `/admin/auditoria`. Header escuro distinto do app do tenant.
- **Impersonação:** "Entrar como cliente" grava token em `sessionStorage` (`tc:impersonate`);
  o `AuthProvider` do tenant lê no boot de forma **aditiva** (só ativa com token válido —
  zero efeito no fluxo normal) e mostra banner âmbar "vendo como X" + "Sair da visão".
- **Criação de tenant pelo painel** (antes o superadmin NÃO criava tenant): novo
  `POST /admin/tenants` (`SuperAdminGuard`) → `SuperAdminService.criarTenant` reaproveita o
  caminho do signup (Tenant `TRIAL` + 1º user `ADMIN`), **gera senha temporária** devolvida
  uma única vez (só o hash Argon2id fica no banco), audita `superadmin.tenant.criar`. Form em
  `/admin/tenants/novo` com slug auto-sugerido. Tenants criados herdam RLS/RBAC
  automaticamente (a proteção é por tabela, não por tenant).
- **Acesso:** superadmin não está no seed (por design, RULES 1.6). Criar/definir senha via
  `pnpm --filter @total-campanha/db criar-super-admin` (SA_EMAIL/SA_PASSWORD) e entrar em
  `/admin/login`.
- **Limitação herdada:** a criação pelo operador não captura aceite de DPA (o signup público
  captura) — forçar no 1º acesso é follow-up. Não há envio de e-mail ao novo admin (o operador
  repassa a senha temporária).
- **Verificação:** typecheck + lint (web) e `nest build` (api) limpos; fluxo testado no Chrome
  com superadmin descartável de dev (login, todas as telas, suspender + restauração, impersonar +
  sair da visão, criar tenant + login do novo admin retornando 200). Dados de teste removidos.

## 2026-05-22 — Blindagem mergeada, CI verde, deploys manual-only

**Categoria:** Bootstrap / CI

Fechamento do trabalho de blindagem: tudo revisado por PR e mergeado na `main`.

- **Fluxo de PR exercitado de verdade** — 3 PRs, todos passando pelos checks
  de anti-regressão antes do merge:
  - PR #1 `chore/seguranca-e-superadmin → dev`
  - PR #2 `dev → main` (promoção — `anti-regression.yml` validado)
  - PR #3 `chore/deploy-manual-ate-azure → main`
  - Estado: `main` = `dev` = `78af443`. Branches `chore/*` deletadas após merge.

- **CI loop — correções para deixar o `lint-typecheck-test` verde:**
  - `packages/db/prisma/migrations/0001_init/migration.sql` — **faltava**;
    gerada via `prisma migrate diff --from-empty`. Sem ela `migrate deploy`
    (usado pelos testes RLS/tenant-isolation e pelo deploy PROD) só tinha a
    `0002_enable_rls` e falhava. Débito de migration history → resolvido.
  - `apps/api/jest.config.cjs` + `apps/worker/jest.config.cjs` — sem config,
    `jest` varria `test/**/*.spec.ts` com babel (sem TS) → SyntaxError em
    `import type`. Configs escopam `pnpm test` a `src/**/*.spec.ts` com ts-jest.
  - `moduleNameMapper '^(\.{1,2}/.*)\.js$' → '$1'` nos 5 configs jest —
    imports ESM com sufixo `.js` não resolviam no jest-resolve.
  - `apps/web` `test` virou no-op (web não tem jest; e2e é Playwright).
  - `rls.test.ts` — cast `::uuid` nos parâmetros de `$executeRawUnsafe`
    (Prisma envia params como text → erro 42804 em coluna uuid).
  - 2 erros de lint reais (var não usada em `analytics.service`, `while(true)`
    em `exportar-contatos.service`).

- **Deploy workflows manual-only** (PR #3) — `deploy-api/web/worker.yml` tinham
  trigger `push: main` e falhavam em todo push (sem `AZURE_CREDENTIALS` /
  infra Azure). Trigger `push` comentado; só `workflow_dispatch`. **Reativar
  ao provisionar o Azure.**

- **Verificado**: `tag-prod.yml` pulou corretamente (nenhum deploy com
  sucesso → não criou tag `prod-*` falsa). A blindagem funciona como projetada.

**Pendência única**: configurar branch protection na UI do GitHub
(`docs/branch-protection.md`) — os checks de anti-regressão existem mas só
*bloqueiam* merge depois disso.

---

## 2026-05-21 — Repo git + blindagem + segurança + super admin

**Categoria:** Bootstrap / Segurança

- **Repositório git criado** e pushed: `github.com/totalutiliti/total_campanha`.
  Branches `main` (genesis) e `dev`. `core.hooksPath=.githooks` ativo.
- **Blindagem contra regressão** (prompt 23 — `0000_passos_antes_da_producao/`):
  - `CLAUDE.md` ganhou a seção "Blindagem contra regressão (Git)" — modelo de
    branches, gates de deploy literais, hotfix, higiene, histórico de incidentes.
  - `.githooks/pre-commit` + `.githooks/pre-push` versionados (instala via
    script `prepare` no `pnpm install`).
  - `.github/workflows/anti-regression.yml` (3 checks de PR) + `tag-prod.yml`
    (tag `prod-AAAAMMDD-HHmm` após deploy).
  - `docs/runbooks/deploy-prod.md` (§0-§11) + `docs/working-with-claude-code.md`
    + `docs/branch-protection.md`.
- **Guia de segurança** (`00_prompt-seguranca-senhas.md`) — escopo "lacunas no
  repo" (Managed Identity NÃO migrado — decisão: Azure ainda não provisionado):
  - `.gitleaks.toml` + gitleaks no `pre-commit` (se instalado) + workflow
    `gitleaks.yml` (PR/push/semanal).
  - `.gitignore` alinhado ao padrão `.env` / `.env.*` / `!.env.example`.
  - Auditoria: o projeto já cumpria Argon2id+pepper, RBAC, rate limit, Helmet,
    CORS, audit log, Key Vault no Bicep.
- **Super admin** (`packages/db/prisma/criar-super-admin.ts` + script
  `pnpm --filter @total-campanha/db criar-super-admin`):
  - Criado `joao@totalutiliti.com.br` com `isSuperAdmin=true` no DB de dev.
  - Login: `POST /api/v1/admin/auth/login` (escopo `/admin`, cross-tenant).
  - ⚠️ `pnpm db:seed` faz TRUNCATE em `users` — após re-seed, re-rodar o
    `criar-super-admin`. Super admin NÃO está no seed (por design — RULES 1.6).

**Pendências:**
- Configurar branch protection na UI do GitHub (`docs/branch-protection.md`).
- Migração Managed Identity (PG/Redis/Storage) — adiada até Azure provisionado.

---

## 2026-05-21 — Primeiro build + run real (8 fixes)

**Categoria:** Bootstrap / Lições

Build e execução validados via containers `node:20-alpine` (pnpm não está no host —
usamos Docker como runtime). Stack sobe na rede `projeto_default` do docker-compose.
Os 5 workspaces compilam (typecheck + build) e os 3 apps rodam.

**8 problemas encontrados e corrigidos (todos viram lição):**

1. **tsconfig `rootDir` vs `include`** — `packages/db/tsconfig.json` incluía `prisma/`
   e `tests/` fora do `rootDir: ./src`. Fix: `include` só `src/**/*` (seed roda via
   ts-node, tests via jest — não precisam estar no build do pacote).

2. **`extends` resolve paths relativo ao arquivo-base** — `packages/tsconfig/nestjs.json`
   tinha `rootDir/outDir` que resolviam para `packages/tsconfig/src`. Fix: configs-base
   NUNCA fixam `rootDir`/`outDir` — isso é por-projeto. Cada app define o seu.

3. **TS2742 (`@prisma/client` não-portável)** — controllers da API retornavam tipos
   Prisma inferidos (`Decimal`, `JsonValue`) de `packages/db/node_modules/@prisma/client`.
   `nest build` emite `.d.ts` e não conseguia nomear o tipo. Fix: anotar retorno
   explícito `Promise<unknown>` nos 20 métodos de controller (CRUD). DÉBITO: refinar
   para tipos nomeados quando o client Prisma virar saída custom (`output` no schema).

4. **Next `typedRoutes`** (experimental) rejeitava `<Link href={string}>`. Fix: removido
   de `next.config.mjs` — atrito sem ganho no MVP.

5. **`.tsbuildinfo` stale** — `incremental: true` herdado + `nest build` com
   `deleteOutDir` apaga `dist` mas NÃO o `tsconfig.tsbuildinfo` (fica fora do dist).
   tsc achava "já emitido" e pulava o emit → `dist/` só com assets, sem `main.js`.
   Fix: `incremental: false` no `nestjs.json` (apps não se beneficiam de incremental).

6. **BullMQ proíbe `:` em nome de fila** (usa `:` como separador no Redis). Todas as
   filas foram renomeadas `x:y` → `x-y` (`dispatch-email`, `dispatch-whatsapp`,
   `dispatch-retry`, `webhook-meta`, `contatos-importar`, `conexoes-verificar-email`,
   `billing-trial`). **Regra:** nome de fila BullMQ sempre kebab-case sem `:`.

7. **Helper `env()` lançava erro para var opcional** — qualquer `.optional()` do Zod
   não-setada (ex. `SES_CONFIGURATION_SET`) derrubava o boot. Fix: `env()` não lança;
   o Zod já valida obrigatórias no boot.

8. **Prisma engine no Alpine** — `node:20-alpine` (musl) precisa de `apk add openssl`
   e do `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` no `generator`.
   A 1ª geração (sem openssl) pegou o target errado. Fix aplicado no `schema.prisma`
   (vale também para os Dockerfiles de PROD, que são alpine).

**Estado da instância DEV em execução:**
- Infra via `docker compose`: `tc-postgres`, `tc-redis`, `tc-mailhog`.
- Apps via `docker run` na rede `projeto_default`: `tc-api-dev` (:3001),
  `tc-worker-dev`, `tc-web-dev` (:3000).
- `.env` (não commitado) com hostnames de serviço (`tc-postgres`, `tc-redis`, `tc-mailhog`).
- Schema aplicado via `prisma db push` (DEV) + RLS via `0002_enable_rls/migration.sql`
  manual + seed (`cardanstencar`, `admin@cardanstencar.dev`/`admin123`).
- App conecta como superuser `postgres` em DEV → **RLS é bypassado** (superuser ignora
  RLS mesmo com FORCE). Aceitável em dev single-tenant; isolamento real testa-se com
  a suíte `test:tenant-isolation` (role `app_user`).

**Débitos abertos:**
- Migration history: a `0002_enable_rls` precisa ser renomeada para ordenar DEPOIS
  da `0001_init` (gerar a init com `prisma migrate dev` e renomear a RLS com prefixo
  de timestamp posterior). Hoje DEV usa `db push`.
- `Promise<unknown>` nos 20 controllers (ver fix #3).
- `packages/db/tsconfig.seed.json` — tsconfig autocontido criado porque ts-node
  quebra ao resolver `extends` via symlink do pnpm.
- Conexões WhatsApp/SES/Asaas em modo stub (sem credenciais — esperado).
- Duplicação API↔worker (Crypto/Meta/Mail/Usage/Prisma/render) — extrair para package.

**Como rodar de novo (resumo):**
```
docker compose up -d postgres redis mailhog
# build via container: docker run --rm -v <proj>:/app -w /app node:20-alpine \
#   sh -c "corepack enable && pnpm install && pnpm -r build"
# apps: docker run -d --network projeto_default --env-file .env ... pnpm --filter <x> start
```
Acesso: web http://localhost:3000 · API http://localhost:3001/api/v1 ·
Swagger /api/docs · MailHog http://localhost:8025.

---

## 2026-05-19 — Fase 7 executada (infra Azure + pipeline)

**Categoria:** Bootstrap

Concluída a Fase 7 do `docs/BOOTSTRAP.md` (Prompts 7.1, 7.2, 7.3).

- **Dockerfiles** — `apps/{api,worker,web}/Dockerfile`, multi-stage Node 20 alpine + pnpm 9. `api`/`worker` usam `pnpm deploy --prod`; `web` usa `output: 'standalone'` (adicionado ao `next.config.mjs`). `.dockerignore` na raiz. Build a partir da raiz do monorepo (`-f apps/X/Dockerfile .`).

- **F7.1 — `infra/main.bicep`** — template PROD completo: Log Analytics + App Insights, VNet `10.20.0.0/16` (3 subnets: cae /23, db /24 delegada, pe /24), private DNS zones, PostgreSQL Flexible 16 HA zone-redundant (`Standard_D2ds_v4`, 128GB, backup 35d geo, PgBouncer), Redis Standard C1 noeviction (private endpoint), Storage GRS soft-delete 14d (private endpoint), ACR Standard, Key Vault soft-delete 90d + purge protection (private endpoint, RBAC), Container Apps Env VNet zone-redundant, 3 Container Apps (min-replicas=1, system identity), RBAC AcrPull + KV Secrets User por app, budget 80%/100%. `main.parameters.prod.jsonc` + `scale-up.sh`/`scale-down.sh`.

- **F7.2 — Workflows** — `.github/workflows/deploy-{api,web,worker}.yml`: CI (lint/typecheck/test/tenant-isolation) → build/push ACR (`prod-{sha}`) → `az containerapp update` → health check (api: `/health/ready`; web: `200`; worker: revision `Running`) → smoke test → rollback on failure → Slack. `scripts/smoke-test-prod.sh` (ajustado aos endpoints reais: `senha` no body, `/admin/auth/login` para super admin).

- **F7.3 — Custom domain** — implementado via parâmetro `baseDomain` do `main.bicep` (2 fases): vazio captura `customDomainVerificationId`, preenchido vincula domínio + cert managed. Outputs do Bicep entregam FQDNs, verification IDs, KV URI, ACR login server, etc.

**Decisões F7:**
- Container Apps sobem com imagem **quickstart da Microsoft**; os workflows trocam para a imagem real via `az containerapp update`. Bicep entrega "infra + skeleton apps".
- Env vars e secrets dos apps NÃO são wirados no Bicep — configurados pós-infra (`az containerapp update --set-env-vars/--secrets` com `keyvaultref:`). Mantém o Bicep simples e evita chicken-egg com Key Vault vazio no primeiro deploy. Documentado no `infra/README.md` e nas instruções.
- KEDA Redis scaler do worker fica como passo `az containerapp update` pós-infra (precisa do secret `redis-password`).
- Worker sem ingress → health check do workflow valida `runningState=Running` da revision, não HTTP.

**Estado:** Fases 1-7 completas — backend MVP + infra + pipeline. Falta Fase 8 (onboarding Cardans Tencar / go-live), frontend de campanhas/billing/super-admin, e os débitos acumulados (duplicação API↔worker, materialized view de analytics, testes das Fases 5-7, wiring de env/secrets nos Container Apps).

⚠️ **Nada foi compilado ou executado ainda** — `pnpm install` não rodou neste ambiente. Build real vai exigir correção de erros de tipo/import.

---

## 2026-05-19 — Fase 6 executada (super admin + billing + analytics)

**Categoria:** Bootstrap

Concluída a Fase 6 do `docs/BOOTSTRAP.md` (Prompts 6.1, 6.2, 6.3).

- **F6.1 — SuperAdminModule** (`apps/api/src/modules/super-admin/`):
  - `SuperAdminGuard` — exige JWT `aud='super-admin'` E `isSuperAdmin=true` no DB (revogação imediata).
  - `SuperAdminPrismaService` — PrismaClient dedicado conectando com `DATABASE_MIGRATION_URL` (role `migration_user`, BYPASSRLS). **Necessário** porque Super Admin é cross-tenant e grava `audit_logs` com `tenant_id=NULL` — o `app_user` normal seria bloqueado pela RLS+FORCE.
  - `POST /admin/auth/login` (público, Throttle auth) → JWT super-admin. Endpoints: `GET /admin/tenants` (+MRR por plano), `/admin/tenants/:id`, `POST suspender`, `POST impersonate` (JWT tenant 15min + audit), `GET /admin/usage` (hoje/semana/mês), `/usage/por-tenant`, `/usage/por-servico`, `/admin/audit`.

- **F6.2 — BillingModule** (`apps/api/src/modules/billing/`):
  - `AsaasClient` (`common/integrations/`) — modo stub sem `ASAAS_API_KEY` (cria/cancela assinaturas fake em dev).
  - `BillingService` — `assinar`, `atual`, `atualizarPlano`, `cancelar`. Preços: STARTER R$97 / PRO R$297 / ENTERPRISE R$997.
  - `AsaasWebhookController` (`/webhooks/asaas`, `@Public()`) — valida header `asaas-access-token`; PAYMENT_CONFIRMED→ATIVO, OVERDUE→INADIMPLENTE, CANCELLED→CANCELADO.
  - `TrialProcessor` (worker, recorrente 6h) — TRIAL expirado → INADIMPLENTE; lembretes 7d/3d/1d por email (dedup via `trialLembretes`).
  - **Schema**: adicionados `Tenant.asaasSubscriptionId` e `Tenant.trialLembretes String[]`. Migration `0001_init` ainda não gerada → entram nela.

- **F6.3 — AnalyticsModule** — `GET /analytics/dashboard` (30d), `GET /analytics/comparativo`. Agregações live (sem materialized view — débito).

**Decisões F6:**
- Super Admin usa PrismaClient separado BYPASSRLS (RULES 1.6) — corrige bug de `auditLog.create` com `tenant_id=NULL` bloqueado pela RLS. Também corrigido `BillingService.processarWebhook` para usar `AuditService.log` (runInTenant).
- MRR de tabela de preços fixa por plano — trocar por dado real do Asaas depois.
- AsaasClient stub mode (padrão SES) — dev sem conta Asaas.
- `is_super_admin` só via SQL manual (BOOTSTRAP 6.1) — sem endpoint de criação.

**Estado do MVP:** backend funcionalmente completo (Fases 1-6). Pendente: Fase 7 (infra Bicep + pipeline), frontend de campanhas/billing/super-admin (Recharts), materialized view de analytics, e refatorar duplicação API↔worker.

---

## 2026-05-19 — Fase 5 executada (campanhas + disparo + inbox)

**Categoria:** Bootstrap

Concluída a Fase 5 do `docs/BOOTSTRAP.md` (Prompts 5.1, 5.2, 5.3).

- **UsageService** (API + worker, cópias) — grava `usage_log` no momento da chamada paga (RULES 6.1). `usage_log` é tabela GLOBAL (sem RLS) → PrismaService direto. `CUSTO_REFERENCIA`: whatsapp R$0,25 / email R$0,0006.

- **F5.1 — CampanhasModule** (`apps/api/src/modules/campanhas/`):
  - `CampanhasService` — CRUD (editar só RASCUNHO), `calcularEstimativa` (previsao × custo, persiste), `pausar`/`cancelar` (state machine), `analytics` básico (totais + taxas + porMotivoFalha via groupBy).
  - `CampanhasDispatchService.disparar` — valida status/conexão/template, resolve segmento → contatos com opt-in, cria `Mensagem` com **UUID explícito** (createMany não retorna IDs), enfileira em `dispatch:{canal}` via `addBulk` chunks de 500, com `delay` por mensagem.
  - `throttle.ts` — rate por tier Meta (TIER_250=10/min … UNLIMITED=10000/min); email fixo 120/min. `ajustarParaJanela` empurra envios para dentro de `janelaEnvio`.
  - Status: AGENDADA se 1º envio futuro, senão DISPARANDO.

- **F5.2 — Worker dispatch**:
  - Cópias worker: `CryptoService` (decrypt), `MetaWhatsappClient` (sendTemplate + MetaApiError.retryable), `MailService` (SMTP), `render.ts` (mjml+mustache), `UsageService`, `slack.ts`.
  - `DispatchEmailProcessor` — MJML→HTML, envia SMTP com header `List-Unsubscribe`, status ENVIADA, usage log. Pausa/cancela checados via campanha.status.
  - `DispatchWhatsappProcessor` — decrypt token, `sendTemplate`, mapeia erros Meta 131026/131047/131051/131056, marca FALHOU com flag `retryable` no statusHistory.
  - `RetryProcessor` — repeatable 1min, backoff [1m,5m,30m,2h,12h], MAX 5, reenfileira FALHOU-retryable de campanhas ativas. **Também finaliza** campanhas DISPARANDO sem mensagens PENDENTE/ENFILEIRADA → FINALIZADA.

- **F5.2 — WebhookMeta**:
  - `MetaWebhookController` (API, `@Public()`) — GET handshake valida `verify_token` contra `ConexaoWhatsapp.webhookSecret`; POST enfileira em `webhook:meta` e responde 200 imediato (timeout Meta 5s).
  - `WebhookMetaProcessor` (worker) — statuses delivered/read/failed → atualiza Mensagem por `providerMessageId` + contadores Campanha (sem regredir status); falha em massa >10% em campanha DISPARANDO com ≥20 processadas → PAUSADA + alerta Slack (RULES 7.4); mensagens inbound → cria/atualiza InboxConversa+Mensagem, opt-out automático SAIR/STOP/CANCELAR/PARAR, marca última Mensagem como RESPONDIDA.

- **F5.3 — InboxModule** (`apps/api/src/modules/inbox/`):
  - `GET /inbox/conversas`, `GET /inbox/conversas/:id/mensagens`, `POST /inbox/conversas/:id/responder`.
  - `responder` bloqueia se `janela24hExpiraEm` expirou (412 — precisa template), envia texto livre via `MetaWhatsappClient.sendText`.

**Decisões F5:**
- Throttle por `delay` no job (computado no enqueue), não por BullMQ rate-limiter dinâmico — mais simples e determinístico. Cada mensagem recebe `delay` = posição × intervalo do tier, ajustado pela janela.
- Mensagens criadas com UUID gerado em código (`crypto.randomUUID`) — permite enfileirar logo após o `createMany` sem query de volta.
- Retry é processo separado (scan periódico de FALHOU-retryable), não BullMQ `attempts` — dá controle de backoff longo (até 12h) e visibilidade no banco. Jobs de dispatch usam `attempts: 1`.
- Contagem de retries vem do `statusHistory` (entradas FALHOU). Sem coluna `tentativas` no schema — evita migration.
- Pausar/cancelar campanha = só muda `status` no DB; os processors checam `campanha.status` e no-op. Não removemos jobs do BullMQ (mais simples, robusto).
- WebhookMeta NÃO valida assinatura `X-Hub-Signature-256` — exigiria App Secret por tenant (não temos). Tech-debt registrado. Mitigação: a URL tem `tenantSlug` + a Meta só envia para URLs configuradas pelo próprio tenant.
- "Respondida" é heurística: inbound marca a última Mensagem ENVIADA/ENTREGUE/LIDA do contato como RESPONDIDA. Impreciso se o contato participa de várias campanhas — aceitável no MVP.
- Worker acumula muita duplicação de infra (Crypto/Meta/Mail/Usage/Prisma). **Dívida real agora** — recomendar mover para `packages/` (ex: `packages/integrations`, `packages/db` expandido) antes da Fase 6.

**Pendências para Fase 6 (Super Admin + Billing + Analytics):**
1. `pnpm install` — deps novas no worker (mjml, mustache, nodemailer).
2. Smoke E2E: criar campanha → estimativa → disparar → ver mensagens processadas (worker) → simular webhook de status.
3. Tracking pixel de email + token de opt-out real no `List-Unsubscribe` (hoje usa `placeholder-token`).
4. Frontend de campanhas (criar/disparar/analytics) — não foi feito nesta fase, só backend.
5. Refatorar duplicação API↔worker para packages compartilhados.

---

## 2026-05-19 — Fase 4.5 executada (auth frontend Next.js)

**Categoria:** Bootstrap

Implementado o contexto de autenticação no Next.js para destravar as próximas fases de UI.

- **Backend** — `apps/api/src/modules/tenants/tenants.controller.ts`:
  - `GET /me` retorna `{ id, email, has2fa, isSuperAdmin, role, tenantAtual, tenants[] }`.
  - `GET /tenants/atual` retorna o tenant selecionado.

- **Frontend lib auth** (`apps/web/src/lib/auth/`):
  - `jwt.ts` — `decodeJwt` (não-verify, só leitura do payload).
  - `api-client.ts` — `apiFetch` wrapper que injeta Bearer, **refresh pre-emptive** quando JWT está perto de expirar (margem 30s), **refresh on-401** com retry único. Em falha de refresh chama `onSessionPerdida`.
  - `context.tsx` — `AuthProvider` com estado `{ carregando | anonimo | precisa-escolher-tenant | autenticado }`. No mount tenta `/auth/refresh` (cookie HttpOnly) → `/me`. `tokenRef` mantém access token em memória + ref para evitar closure stale no api wrapper.

- **Páginas**:
  - `/login` — login form + 2FA + select-tenant em fluxo único (modo controlado por `precisa2fa` / `precisaEscolherTenant` da resposta).
  - `/(auth)/layout.tsx` + `guardiao-auth.tsx` — wraps com `AuthProvider`, redireciona pra `/login` se anônimo, mostra chrome (header com tenant + nav + sair).
  - `/(auth)/page.tsx` — dashboard com cards.
  - `/(auth)/contatos/page.tsx` — lista paginada.
  - `/(auth)/segmentos/page.tsx` + `/novo` — lista + criar (reusa `FiltroBuilderComPreview` com fetchPreview real).
  - `/(auth)/templates/page.tsx` — lista por canal.
  - `/(auth)/conexoes/page.tsx` — WhatsApp único + lista de domínios email com status visual.
  - `/(auth)/conexoes/whatsapp/novo/page.tsx` — wrap do `WhatsappWizard` com `salvar` injetado.
  - `/(auth)/conexoes/email/novo/page.tsx` — form + tabela de DNS retornados pelo SES.

**Decisões F4.5:**
- Access token em memória (não localStorage) — XSS-safe. Refresh via cookie HttpOnly.
- Pre-emptive refresh com margem 30s — evita 401 + retry quando o JWT está prestes a expirar no momento da chamada.
- `tokenRef` ref + state — ref serve para `apiFetch` ler valor atual sem stale closure; state força re-render quando muda.
- `(auth)` route group sem path — `/` é o dashboard autenticado. `app/page.tsx` foi removido (era placeholder Fase 0 + conflitava com `(auth)/page.tsx`).
- Páginas `/dev/*` mantidas (FiltroBuilder + WhatsappWizard) como fallback para teste rápido sem login — não bloqueiam nada. Considerar limpeza pós-MVP.
- Sem signup page no frontend (signup é admin onboarding raro — usar swagger ou linha de comando).
- Sem reset-password page — handler `/auth/forgot` retorna o token em dev (Fase 1), só faltam telas. Adicionar quando o MailService SES estiver real.

**Pendências para Fase 5:**
1. `pnpm install` (sem deps novas no frontend — só código).
2. Smoke test do fluxo completo: signup via swagger → login pelo painel → ver dashboard → criar segmento → ver conexões.
3. Decidir se o tipo `Grupo` migra para `packages/shared` na Fase 5 ou fica em débito.

---

## 2026-05-19 — Fase 4 executada (conexões BYOA)

**Categoria:** Bootstrap

Concluída a Fase 4 do `docs/BOOTSTRAP.md` (Prompts 4.1 e 4.2). Estado:

- **`apps/api/src/common/integrations/`** — novo `IntegrationsModule` global:
  - `meta-whatsapp.client.ts` — `MetaWhatsappClient` com `getPhoneNumber`, `sendTemplate`, `sendHelloWorld`. Lança `MetaApiError` com `status` + `body` preservado. Logs com `maskBearer(token)`.
  - `ses-identity.client.ts` — `SesIdentityClient` usando `@aws-sdk/client-sesv2` com **modo stub** quando AWS_ACCESS_KEY_ID/SECRET ausentes. `criarIdentidadeDominio`, `verificarIdentidade`, `excluirIdentidade`. Em stub retorna CNAMEs fake.

- **F4.1 — ConexaoWhatsapp** (`apps/api/src/modules/conexoes/`):
  - `conexao-whatsapp.service.ts` — `criar` valida via Meta GET phone_number ANTES de salvar (RULES 4.3), cifra token via `CryptoService`, gera `webhook_secret` com `crypto.randomBytes(32).hex`. Endpoints: POST/GET/PATCH/DELETE + `POST /conexoes/whatsapp/testar` + `POST /enviar-teste` (template hello_world).
  - Delete é soft: muda `status=SUSPENSA` e sobrescreve `tokenEncrypted` com Buffer vazio (preserva audit trail).
  - `materializarPublica` injeta `webhook.url = ${WEBHOOK_META_BASE_URL}/${tenantSlug}` + secret cleartext (retornado UMA vez para o user copiar; salva cifrado nada — webhook secret fica em texto pois é validador, não credencial — pode ser rotacionado por DELETE+CREATE).

- **F4.2 — ConexaoEmail** (`apps/api/src/modules/conexoes/`):
  - `conexao-email.service.ts` — `criar` chama SES `CreateEmailIdentity`, retorna 3 CNAMEs DKIM + SPF + DMARC sugeridos. Status PENDENTE_VERIFICACAO até DKIM SUCCESS. Validação: remetente deve estar dentro do dominio.
  - `POST /conexoes/email/:id/verificar` força recheck contra SES.
  - Suporta múltiplos domínios por tenant (`@@unique([tenantId, dominio])`).

- **Worker — job recorrente** (`apps/worker/src/processors/verificar-emails.processor.ts`):
  - Registra repeatable job em `onModuleInit` (idempotente — checa `getRepeatableJobs` antes).
  - Roda a cada 1h, lista todas conexoes PENDENTE_VERIFICACAO **cross-tenant** via `migration_user` (BYPASSRLS), reverifica via `WorkerSesIdentityClient`, ativa quando DKIM SUCCESS.
  - Audita em `audit_logs` do tenant (com `runInTenant`) em mudança de status.
  - `WorkerSesIdentityClient` — versão enxuta apenas com `verificar`, com modo stub idêntico ao da API.

- **Wizard frontend** (`apps/web/src/components/conexoes/whatsapp-wizard.tsx`):
  - 4 passos: Pré-requisitos → Como obter token Meta → Validação → Webhook configurado.
  - Stepper visual no topo, navegação para frente/trás, botão "copiar" com feedback inline.
  - `salvar` injetado pelo caller (não acopla com auth context).
  - Página de demo em `apps/web/src/app/dev/conexoes/whatsapp/page.tsx`.

**Decisões F4:**
- `webhook_secret` **não é cifrado no banco** — é um verify_token do Meta (validador HMAC do payload), não uma credencial de acesso. Compromisso aceito: leak via DB requer acesso elevado, e o secret é rotacionável (DELETE+CREATE).
- Mode stub no SES — em DEV sem AWS configurada, retorna CNAMEs com prefixo `stub1abcdef.` e nunca contacta AWS. Logs avisam claramente. Em PROD/staging, a falta de creds quebra o boot via env Zod (AWS_ACCESS_KEY_ID/SECRET ficam opcionais no schema, mas `MAIL_PROVIDER=ses` em PROD exige — adicionar essa validação cruzada quando configurar staging).
- `MetaApiError` preservado para Fase 5 (RetryProcessor precisa mapear códigos 131xxx para "retryable" vs "permanente").
- Worker que reverifica é **cross-tenant** mas audit log é por tenant — escolha consciente para não criar uma escala separada de visibilidade.
- Wizard frontend deliberadamente sem fetch hard-coded — espera função `salvar`. Mesmo padrão do `FiltroBuilderComPreview`.
- `meta-templates.service.ts` (da Fase 3) ainda usa fetch direto, não o `MetaWhatsappClient`. Tech-debt menor; refatorar quando passar pelo arquivo de novo.

**Pendências para Fase 5 (Campanhas e disparo):**
1. `pnpm install` (adicionado `@aws-sdk/client-sesv2` na API e no worker).
2. Smoke: criar conexão WhatsApp via swagger (precisa credenciais reais Meta para passar — em DEV sem credenciais, o POST vai falhar no `validarTokenContraMeta`); criar conexão Email em modo stub.
3. Job recorrente do worker — fica ativo sozinho ao subir `pnpm dev:worker`. Verificar primeira execução nos logs.
4. **Auth context Next.js** — agora 3 wizards/painéis precisam (FiltroBuilder, WhatsappWizard, próximo painel Campanha). É hora de implementar antes da Fase 5.

---

## 2026-05-19 — Fase 3 executada (segmentos + templates + crypto)

**Categoria:** Bootstrap

Concluída a Fase 3 do `docs/BOOTSTRAP.md` (Prompts 3.1 e 3.2 + CryptoService adiantado da Fase 4). Estado:

- **CryptoService** (`apps/api/src/common/crypto/`) — wrapper pgcrypto via `$queryRaw`. Métodos:
  - `encryptToken(plain) → Buffer` via `pgp_sym_encrypt(plain, TOKEN_KMS_KEY)`.
  - `decryptToken(buf) → string` via `pgp_sym_decrypt`.
  - `maskBearer(token)` para logs (RULES 4.4).
  - Global module — usado pelo MetaTemplatesService agora e pelo ConexoesModule na Fase 4.

- **F3.1 — SegmentosModule** (`apps/api/src/modules/segmentos/`):
  - `filtros/filtros-schema.ts` — Zod recursivo (Grupo containing Grupo|Condicao) com `z.lazy`.
  - `filtros/traduz-filtros.ts` — tradutor recursivo → `Prisma.ContatoWhereInput`. Allow-list de campos (impede acesso a passwordHash etc). Suporte especial para `tags` (array) e `extras.*` (JSONB path).
  - `segmentos.service.ts` — CRUD, `contar`, `previsao(canal)` (filtra opt-in válido), `listarContatos`, `previaAdHoc` (sem persistir, para FiltroBuilder).
  - Endpoints: `POST/GET/PATCH/DELETE /segmentos`, `GET /segmentos/:id/contatos/contagem`, `GET /segmentos/:id/previsao?canal=`, `GET /segmentos/:id/contatos` (paginado), `POST /segmentos/previa` (ad hoc).

- **F3.2 — TemplatesModule** (`apps/api/src/modules/templates/`):
  - `render/mjml-render.service.ts` — Mustache (escape HTML auto, anti-XSS) → mjml2html. Retorna `{ html, warnings }`.
  - `whatsapp/meta-templates.service.ts` — `GET /v22.0/{wabaId}/message_templates` via Graph API. Lança 412 se ConexaoWhatsapp não ATIVA. Logs com `maskBearer(token)`. Validação opcional na criação (apenas em PROD).
  - `biblioteca/biblioteca.service.ts` — lê JSONs por vertical. 4 seeds em `biblioteca/{autopecas,floricultura,perfumaria,materiais_construcao}/*.json`. `nest-cli.json` atualizado para copiar `**/*.json` em `assets`.
  - `templates.service.ts` — CRUD com discriminated union (EMAIL vs WHATSAPP), preview com aplicação de exemplos default, teste-envio (Email funciona; WhatsApp stub até Fase 5).
  - Endpoints: `POST/GET/PATCH/DELETE /templates`, `GET /templates?canal=`, `GET /templates/biblioteca?vertical=`, `GET /templates/whatsapp/aprovados-na-meta`, `POST /templates/:id/preview`, `POST /templates/:id/teste-envio`.

- **Frontend FiltroBuilder** (`apps/web/src/components/segmentos/`):
  - `filtros-tipos.ts` — espelho de tipos do backend (duplicado por enquanto; ideal mover para `packages/shared` em refactor).
  - `filtro-builder.tsx` — `FiltroBuilder` recursivo (toggle E/OU, +Condição/+Grupo) + `FiltroBuilderComPreview` (debounce 500ms manual com setTimeout).
  - `apps/web/src/app/dev/segmentos/page.tsx` — página de demo. Preview vai dar 401 sem auth (esperado).

**Decisões F3:**
- CryptoService usa `$queryRaw` com binding pro nome da chave (defesa em profundidade contra SQL injection mesmo que o env seja confiável).
- Allow-list de campos no tradutor de filtros — Zod sozinho não basta (`z.string()` aceita `passwordHash`).
- Tradutor trata `tags` (String[] no Prisma) com `has`/`hasSome` e não `contains`, porque `contains` em array string não existe no Prisma WhereInput.
- `extras.*` via JSONB `path` — suporta dotpath aninhado (`extras.endereco.cidade`).
- MJML render aplica Mustache PRIMEIRO (mesmo escapando HTML), depois mjml2html — variáveis em atributos `href` precisam estar interpoladas para o mjml validar.
- Biblioteca: arquivos JSON são *referência* (descrição + variáveis + textoExemplo). O tenant clona, edita, submete na Meta, e cadastra a referência no nosso CRUD. Não criamos templates na Meta automaticamente.
- "aprovados-na-meta" lança 412 (não 404) se sem conexão — semanticamente mais correto para "pré-condição".
- Frontend ainda sem auth context — `/dev/segmentos` é a primeira página que precisa de auth e fica como placeholder visual.

**Pendências para Fase 4 (Conexões BYOA):**
1. `pnpm install` (mjml, mustache, @types/mjml, @types/mustache adicionados).
2. Validar smoke da Fase 3: criar segmento via swagger, criar template MJML, preview retorna HTML válido.
3. Considerar mover `filtros-schema.ts` + `filtros-tipos.ts` para `packages/shared` antes da Fase 4.
4. Auth context no Next.js — não é blocker para Fase 4 mas vai precisar para qualquer painel além de `/p/*`.

---

## 2026-05-19 — Fase 2 executada (contatos + opt-in público)

**Categoria:** Bootstrap

Concluída a Fase 2 do `docs/BOOTSTRAP.md` (Prompts 2.1 e 2.2). Estado:

- **Common F2** — `AuditService` global em `src/common/audit/` (audit_logs via runInTenant — respeita RLS), `MailService` em `src/common/mail/` (nodemailer SMTP para dev/MailHog, stub para SES/Resend), `AppQueueModule` em `src/common/queue/` (BullMQ root config + registra fila `contatos:importar`). Helpers de telefone E.164 e Canal enum movidos para `packages/shared/src/telefone.ts`.
- **F2.1 — ContatosModule** (`src/modules/contatos/`):
  - `ContatosService` — CRUD com `runInTenant`, conflict-check por email/telefone, soft delete por padrão; `?lgpd=true` → hard delete + anonimização (mensagens recebem `destinatarioHash = sha256(canal|valor|pepper)`, `contatoId → NULL`, opt_in_log registra OPT_OUT origem `lgpd-direito-esquecimento`).
  - `ImportarContatosService` — `parser-csv.ts` (papaparse + normalização E.164 + extras JSONB), modo `upsert` (default) ou `ignorar`, sync ≤ `CONTATOS_IMPORTAR_SYNC_LIMITE` (1000), >1000 enfileira em `contatos:importar`. Devolve `{ modo: 'sync', ... }` ou `{ modo: 'async', jobId }`.
  - `ExportarContatosService` — CSV stream paginado (500 por lote, cursor).
  - `ContatosController` — upload multipart 10MB via `FileInterceptor`, `?lgpd=true` no DELETE, Roles ADMIN para import/export.
- **F2.2 — PublicModule** (`src/modules/public/`):
  - `OptOutTokenService` — tokens HMAC-SHA256 base64url `<payload>.<sig>` para opt-out one-click (não usa JWT — URLs mais curtas em rodapé de email). Verificação `timingSafeEqual`.
  - `RecaptchaService` — v3 verify (no-op se RECAPTCHA_SECRET vazio em dev), score ≥ 0.5.
  - `OptInService` — `dadosLanding` (rejeita tenant SUSPENSO/CANCELADO), `submeter` faz upsert do contato + opt_in_log por canal (RULES 5.4 — 1 row por canal) + envia email double-opt-in via MailService.
  - `OptOutService` — verifica token HMAC, atualiza `optInEmail`/`optInWhatsapp`, registra opt_in_log OPT_OUT idempotente.
  - `PublicController` — endpoints `GET/POST /p/opt-in/:tenantSlug` e `GET /p/opt-out/:token`, todos `@Public()`, throttle 30/min/IP. Captura `X-Forwarded-For` para IP correto atrás de proxy Azure.
- **Worker** — `apps/worker` real: `NestFactory.createApplicationContext` (sem HTTP), `BullModule.forRootAsync` com config validada por Zod, `ImportarContatosProcessor` consome `contatos:importar` em chunks de 200, atualiza progresso, audita ao final.
- **Next.js** — páginas `apps/web/src/app/p/opt-in/[tenantSlug]/page.tsx` (server component busca tema + client form Tailwind mobile-first) e `apps/web/src/app/p/opt-out/[token]/page.tsx`. Sem rastreador, sem cookies.

**Decisões F2:**
- AuditService inicializa transação própria via `runInTenant` em vez de receber `tx` — chamadores não precisam pensar em transação. Pode ser otimizado depois (atomicidade dentro da mesma transação) com método `logInTransaction(tx, ...)`.
- Hash de anonimização LGPD usa `AUTH_PEPPER` como sal — evita gerenciar mais uma chave. Stable entre execuções.
- opt-out token NÃO usa JWT — URLs ficam ~120 chars (cabem em rodapé de email/template WhatsApp sem quebra), sem dependência de @nestjs/jwt aqui.
- Frontend Next.js minimalista (Tailwind only, sem shadcn ainda) — branding por tenant entra quando schema ganhar campos (Fase 4+).
- Worker tem PrismaService próprio (duplicado, não shared package) — evita acoplamento prematuro. Refatorar quando padrões estabilizarem.

**Pendências para Fase 3:**
1. `pnpm install` para baixar deps novas (papaparse, libphonenumber-js, nodemailer, ioredis no shared).
2. Validar smoke: `pnpm dev:api` + `pnpm dev:worker` + `pnpm dev:web`, fluxo opt-in completo no browser.
3. Adicionar testes de parser CSV (unit) — pulei pra acelerar; recomendo cobrir antes da Fase 3.

---

## 2026-05-19 — Fase 1 executada (auth + multi-tenancy)

**Categoria:** Bootstrap

Concluída a Fase 1 do `docs/BOOTSTRAP.md` (Prompts 1.1, 1.2 e 1.3). Estado:

- **1.1** — `apps/api` real: `main.ts` (helmet + cookie-parser + pino + swagger dev), `AppConfigModule` (env validado por Zod em `src/config/env.ts`), `PrismaService` com `runInTenant`/`runUnscoped` (`src/common/prisma/`), `RedisService` (`src/common/redis/`), `HealthModule` (`/health/live` + `/health/ready` checando DB+Redis), `AllExceptionsFilter`, `AppThrottlerModule` com storage Redis (rate limit nomeado `auth` = 5/15min). Stubs vazios para os 13 outros módulos.
- **1.2** — `AuthModule` completo em `src/modules/auth/`:
  - `PasswordService` — Argon2id+pepper (timeCost 3, 64MB, parallelism 4), com `needsRehash` para upgrades silenciosos.
  - `EmailHashService` — sha256(email lowercased + pepper).
  - `TotpService` — otplib + QR code data URL.
  - `TokenService` — JWT access 15m / refresh 7d com **rotation em Redis** (jti+family), detecção de reuse invalida a família inteira, reset tokens 1h single-use, `invalidarTodasSessoes` para reset/2FA.
  - `JwtAuthGuard` + `@Public()` para opt-out por handler.
  - `@CurrentUser()` decorator.
  - Endpoints: `POST /auth/{signup,login,refresh,logout,forgot,reset,select-tenant,2fa/setup,2fa/verify}` com Throttle nomeado `auth`.
  - Cookies refresh: HttpOnly + Secure(prod) + SameSite + path `/api/v1/auth`.
  - Erros de login sempre genéricos (`"Email ou senha incorretos."`).
- **1.3** — Multi-tenancy:
  - `@TenantId()` em `src/common/tenant/` — lança 403 se JWT for "pending" (sem tid).
  - `@Roles(...)` + `TenantRoleGuard` em `src/common/rbac/` — sem default permissivo.
  - `POST /auth/select-tenant` para users multi-tenant.
  - Suíte `apps/api/test/tenant-isolation/entidades.spec.ts` cobrindo 7 entidades × 4 violações + write-guard (WITH CHECK).
  - Suíte usa testcontainers + role `app_user` (sem BYPASSRLS) → testa o RLS real do Postgres, não um mock.

**Dependências adicionadas** em `apps/api/package.json`:
`@nestjs/jwt`, `@nest-lab/throttler-storage-redis`, `ioredis`, `argon2`, `otplib`, `qrcode`, `helmet`, `cookie-parser`, `@types/cookie-parser`, `@types/qrcode`.

**Pendências para destravar Fase 2:**
1. `pnpm install` (deps de Fase 1 ainda não baixadas).
2. Validar que `pnpm --filter @total-campanha/api test:tenant-isolation` passa.
3. Validar que `pnpm dev:api` sobe sem erro com `.env` válido.

---

## 2026-05-19 — Fase 0 executada (setup do monorepo)

**Categoria:** Bootstrap

Concluída a Fase 0 do `docs/BOOTSTRAP.md` (Prompts 0.1, 0.2 e 0.3 — parte estrutural). Estado:

- Docs reorganizados: `docs/{PRD,ARCHITECTURE,SPECS,RULES,SKILL,BOOTSTRAP}.md` e `instrucoes/instrucao_*.md + memoria.md`. `CLAUDE.md` e `README.md` permanecem na raiz.
- Monorepo pnpm criado: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.prettierrc`, `.prettierignore`, `.eslintrc.cjs`, `.nvmrc` (Node 20), `.npmrc`.
- Stack local: `docker-compose.yml` (postgres:16-alpine + redis:7-alpine com `maxmemory-policy=noeviction` + mailhog) e `.env.example` com TODAS as variáveis comentadas.
- Workspaces:
  - `apps/api` (NestJS 10) — só `main.ts`/`app.module.ts` placeholder. Implementação na Fase 1.
  - `apps/worker` (NestJS standalone + BullMQ) — placeholder. Implementação na Fase 5.
  - `apps/web` (Next.js 14 App Router + Tailwind) — `app/layout.tsx` + `app/page.tsx` mínimos.
  - `packages/db` — schema Prisma completo replicando `docs/SPECS.md` seção 1; migration `0002_enable_rls/migration.sql` ativa RLS + cria roles `app_user`/`migration_user`; `tests/rls.test.ts` com testcontainers; `prisma/seed.ts` (aborta em PROD).
  - `packages/shared` — enums tipados (Plano, TenantStatus, Role, Canal, etc.).
  - `packages/tsconfig` — base/nestjs/nextjs/library.
- `infra/README.md` placeholder (Bicep real na Fase 7).
- `.github/workflows/ci.yml` — lint + typecheck + build + test + **test:tenant-isolation** como gate.

**Pendências para destravar a Fase 1:**
1. Instalar `pnpm@9` no host (`npm i -g pnpm@9.12.0`) e Node 20 (atual é 24).
2. Rodar `pnpm install` na raiz.
3. Rodar `pnpm db:up` (sobe docker-compose) e gerar a migration inicial com `pnpm db:migrate -- --name initial` — a `0002_enable_rls` já existe no repo e roda em sequência.
4. Validar `pnpm db:seed` e `pnpm --filter @total-campanha/db test:rls`.

---

## 2026-05-19 — Bootstrap do projeto

**Categoria:** Decisão arquitetural

Criação inicial do projeto Total Campanha incorporando aprendizados acumulados da Total IA Contábil:
- Multi-tenant com PostgreSQL RLS (mesmo padrão de Total IA Contábil, Total Talent, KegSafe, VidroSaaS).
- Azure Container Apps em Brazil South, min-replicas=1 em PROD desde o dia 1.
- BullMQ + Redis para disparos (necessário pelo volume e necessidade de throttling por tenant).
- Argon2id + pepper para senhas (lição: bcrypt nunca; AUTH_PEPPER em Key Vault).
- pgcrypto para tokens BYOA WhatsApp (token nunca em texto puro).
- Painel de custo por tenant **desde o dia 1** (lição: na Total IA Contábil veio tarde e atrapalhou).
- Suíte de testes de tenant-isolation **obrigatória no CI desde a primeira PR**.

---

## Lições da Total IA Contábil aplicadas como regra desde o dia 1

### LIÇÃO L01 — `prisma db push --accept-data-loss` apagou tabela users em PROD

**Data do incidente original:** abril/2026
**Aplicado em:** `RULES.md` seção 2.1, `instrucao_recuperacao_producao.md`, `CLAUDE.md`

Em Total IA Contábil, o Antigravity rodou `prisma db push --accept-data-loss` em PROD para sincronizar schema. O Prisma fez DROP+CREATE da tabela `users` e mesmo com erro de permissão no meio, a tabela ficou vazia. Todos os usuários ficaram trancados fora do sistema.

**Regra aplicada de saída:** PROIBIDO `prisma db push` em PROD. Schema em PROD só via `$executeRawUnsafe` com `ALTER TABLE`. Checklist pré-alteração obrigatório (snapshot, count, plano de rollback, confirmação humana).

### LIÇÃO L02 — Bcrypt vs Argon2 inconsistente entre seed e auth

**Aplicado em:** `RULES.md` seção 3, `BOOTSTRAP.md` Prompt 0.3 e 1.2

Em Total IA Contábil havia um seed que hashava senha com bcrypt, mas o auth service validava com Argon2 + pepper. Quando precisou recriar usuário em PROD, o login falhou silenciosamente.

**Regra aplicada de saída:** Argon2id+pepper em TUDO. Seed também. Sem bcrypt em lugar nenhum.

### LIÇÃO L03 — API key compartilhada entre projetos causou R$237 de cobrança indevida

**Data do incidente:** abril/2026 (incidente Olicon)
**Aplicado em:** `instrucao_azure.md` seção 2

O projeto Olicon do sócio do João usou por engano a key Document Intelligence do Total IA Contábil. Processou 3.847 PDFs durante a madrugada e R$ 237 caíram na conta errada.

**Regra aplicada de saída:** Cada projeto tem suas próprias keys, naming `{projeto}-{recurso}-{ambiente}`. Nunca compartilhar entre projetos. Monitor de custo por projeto/tenant desde o dia 1.

### LIÇÃO L04 — Cold start de min-replicas=0 quebrou demos

**Aplicado em:** `ARCHITECTURE.md` seção 6, Bicep

Em Total IA Contábil em DEV o scale-to-zero era usado para economizar. Quando migrou para PROD, alguém setou min=0 e a primeira request da manhã levava 8s para responder.

**Regra aplicada de saída:** Em PROD, min-replicas=1 sempre, em todos os Container Apps. Bicep parametrizado por ambiente; nunca confiar em default.

### LIÇÃO L05 — Auto-scaling sazonal foi manual e atrasou

**Aplicado em:** `instrucao_azure.md` seção 6

Total IA Contábil escala PostgreSQL para D4ds_v4 durante temporada IRPF (jan-abr). Foi feito manualmente e em uma temporada esqueceram, gerou latência. Script `scale-db.sh` veio depois.

**Regra aplicada de saída:** Scripts `infra/scale-up.sh` e `infra/scale-down.sh` no bootstrap. Para Total Campanha, datas comerciais (Dia das Mães, Black Friday, Natal) prevêem scale-up de Container Apps e workers.

### LIÇÃO L06 — Domínio custom precisa de 2 fases (verifyId → DNS → setup)

**Aplicado em:** `instrucao_deploys.md` seção 4

Em Total IA Contábil tentaram configurar domínio custom em uma única passada do Bicep e o deploy falhou — Azure precisa do verifyId no DNS antes de aceitar vincular.

**Regra aplicada de saída:** Pipeline de domínio custom documentado em 2 fases explícitas. Primeira fase deploya infra básica e expõe customDomainVerificationId; segunda fase, após DNS configurado, vincula.

### LIÇÃO L07 — Antigravity executou comando destrutivo sem confirmação

**Aplicado em:** `CLAUDE.md`, `RULES.md` seção 9

O incidente do `prisma db push` foi agravado porque o agente executou sem confirmação humana explícita do João.

**Regra aplicada de saída:** Lista explícita de comandos proibidos em PROD. Para comandos destrutivos, exige confirmação humana **em mensagem separada** (não basta o prompt original mencionar; precisa de "ok, pode rodar X em PROD agora").

### LIÇÃO L08 — Sumiu aba de Custos IA após deploys

**Aplicado em:** `instrucao_deploys.md` seção 7 (smoke test pós-deploy)

Em Total IA Contábil, após uma série de deploys, a aba de Custos IA do Super Admin sumiu. Antigravity teria que recriar do zero se não fosse a investigação do git log.

**Regra aplicada de saída:** Smoke test pós-deploy obrigatório inclui checklist visual das telas principais. Se algo sumiu, primeiro investigar `git log` e `git diff` da janela do deploy, depois recriar.

### LIÇÃO L09 — Quota Azure OpenAI TPM precisa de pedido manual

**Aplicado em:** `instrucao_azure.md` seção 4

Em Total IA Contábil, na primeira temporada, o GPT começou a recusar requests por falta de TPM. Pedido de aumento de quota leva 1-3 dias úteis.

**Regra aplicada de saída:** Para Total Campanha (que não usa OpenAI no MVP), guardar para Fase 3. Se chegar lá, fazer pedido de quota com antecedência.

### LIÇÃO L10 — Monitoramento de custo por tenant veio tarde

**Aplicado em:** `SPECS.md` (tabela usage_log), `RULES.md` 6.1, `BOOTSTRAP.md` Prompt 0.2

Em Total IA Contábil a tabela `extraction_log` foi criada cedo mas a agregação por tenant em painel veio meses depois.

**Regra aplicada de saída:** Tabela `usage_log` no schema inicial. Toda chamada paga grava na hora. Painel Super Admin mostra desde o dia 1.

### LIÇÃO L11 — Quota Meta e tier WhatsApp varia por tenant

**Aplicado em:** `RULES.md` 7.1, dispatch processor

Conhecimento prévio do BM Vagas: o tier Meta começa em 250 mensagens/dia e cresce com volume + quality rating. Cada tenant tem seu próprio tier.

**Regra aplicada de saída:** `ConexaoWhatsapp.tierMeta` armazenado e atualizado via webhook Meta (campo `account_update`). Rate limiter BullMQ dinâmico por tenant.

### LIÇÃO L12 — LGPD do operador é tão sério quanto do controlador

**Aplicado em:** `instrucao_lgpd_dpa.md`

O João identificou no chat com Claude que TotalUtiliti é **operador** dos dados que o tenant carrega (contatos) — não só o tenant é responsável.

**Regra aplicada de saída:** DPA obrigatório no termo de uso. DPO designado. Procedimento de incidente. Direito ao esquecimento em <24h.

---

## Glossário de termos do projeto (vai crescendo)

- **BYOA:** Bring Your Own Account. Tenant pluga a própria conta Meta Cloud API ou domínio de email.
- **Tier Meta:** classificação da WABA na Meta para volume diário (250/1k/10k/100k/unlimited).
- **Quality Rating:** verde/amarelo/vermelho atribuído pela Meta ao número WhatsApp baseado em comportamento dos destinatários (bloqueios, denúncias).
- **WABA:** WhatsApp Business Account.
- **Marketing template:** template categoria MARKETING, sujeito a cobrança Meta + opt-in obrigatório.
- **Janela 24h:** período após mensagem in do contato em que tenant pode enviar mensagem livre (não-template).
- **opt-in log:** registro imutável de consentimento, com IP, UA, origem, versão do termo.

---

## Padrões de nomenclatura

- Recursos Azure: `{tipo}-{projeto}-{ambiente}` (ex.: `pg-totalcampanha-prod`, `kv-totalcampanha-prod01`).
- Container Apps: `tc-{servico}-{ambiente}` (`tc-api-prod`, `tc-web-prod`, `tc-worker-prod`).
- Resource Group: `rg-totalcampanha-{ambiente}`.
- ACR: `acrtotalcampanha01` (sem hífen por restrição Azure).
- Database: `total_campanha_{ambiente}`.
- Branches Git: `feat/{descricao}`, `fix/{descricao}`, `hotfix/{descricao}`.
- Tags release: `vMAJOR.MINOR.PATCH`.
