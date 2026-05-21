# instrucao_deploys.md — Total Campanha

> Pipeline de deploy passo a passo. Baseado na experiência da Total IA Contábil.
> Audiência: Antigravity, João, qualquer pessoa que faça deploy.

## 1. Princípios

1. **Todo deploy é por pipeline GitHub Actions.** Não há `docker push :prod` manual.
2. **Cada deploy gera revision nova.** Rollback é troca de tráfego entre revisions, não rebuild.
3. **Smoke test pós-deploy é obrigatório.** Se falhar, rollback automático.
4. **Health checks bloqueiam revision sem tráfego.** Container que não responde em `/health/ready` em 60s não recebe tráfego.
5. **Versionamento por SHA do commit.** Tag `:prod` é sempre alias para o último SHA aprovado.

## 2. Fluxo de deploy (após repo configurado)

### 2.1. Deploy automático em push para `main`

```
push para main → CI roda → 
  se passou → build imagem com tag :{sha} → push ACR →
  az containerapp update --image acrtotalcampanha01.azurecr.io/tc-api:{sha} →
  Container Apps cria revision nova → health check →
  se OK → tráfego 100% para nova revision →
  smoke test → 
  se OK → notifica Slack "deploy OK {sha}"
  se falhar → rollback para revision anterior + notifica Slack "deploy FALHOU"
```

### 2.2. Disparar manualmente

```bash
gh workflow run deploy-api.yml --ref main
gh workflow run deploy-web.yml --ref main
gh workflow run deploy-worker.yml --ref main
```

### 2.3. Deploy de tag específica (release)

```bash
gh workflow run deploy-api.yml --ref v1.2.3
```

## 3. Pipeline de provisionamento inicial (Fase 1 do BOOTSTRAP)

> Executado uma vez para criar PROD do zero. **Antes**, ler `instrucao_azure.md` na íntegra.

### Passo 1 — Pré-requisitos

```bash
# 1.1 — Login Azure
az login
az account set --subscription "39c8f9b3-7ecd-4e1c-a9cb-6be6b1d2740e"

# 1.2 — Criar resource group
az group create -n rg-totalcampanha-prod -l brazilsouth \
  --tags Project=totalcampanha Environment=prod Owner=totalutiliti

# 1.3 — Verificar quotas (lição L09)
az vm list-usage -l brazilsouth -o table | grep -i 'core\|ddv4'
# Se cota < 30 cores, abrir ticket Azure ANTES de continuar
```

### Passo 2 — Gerar senha PostgreSQL e salvar em local seguro

```bash
PGPASS=$(openssl rand -base64 32 | tr -d '+/=' | head -c 32)
echo "$PGPASS" > ~/.totalcampanha-pgpass-prod  # local, não commitar
chmod 600 ~/.totalcampanha-pgpass-prod
```

### Passo 3 — Deploy Bicep (Fase A — sem domínio custom)

```bash
az deployment group create \
  --resource-group rg-totalcampanha-prod \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.prod.jsonc \
  --parameters postgresAdminPassword="$PGPASS" \
  --parameters baseDomain=""
```

Esperado: 15-25 min. Provisiona VNet, PostgreSQL HA, Redis, Storage, ACR, Key Vault, Container Apps Env, 3 Container Apps (sem domínio custom), Log Analytics + AppInsights.

**Outputs importantes:**
- `customDomainVerificationId` — anotar (usar na Fase B)
- FQDNs Azure de cada app (algo como `tc-api-prod.bravegrass-...azurecontainerapps.io`)
- Key Vault URI

### Passo 4 — Guardar senha PostgreSQL no Key Vault

```bash
az keyvault secret set \
  --vault-name kv-totalcampanha-prod01 \
  --name postgres-admin-password \
  --value "$PGPASS"
```

Outros secrets a popular:
- `database-url` — `postgresql://tcadmin:{PGPASS}@pg-totalcampanha-prod.postgres.database.azure.com:5432/total_campanha_prod?sslmode=require`
- `redis-url` — pegar do output do Bicep
- `auth-pepper` — `openssl rand -base64 64`
- `token-kms-key` — `openssl rand -base64 32` (chave para pgcrypto)
- `jwt-secret` — `openssl rand -base64 64`
- `refresh-secret` — `openssl rand -base64 64`
- `webhook-asaas-secret` — pegar no painel Asaas
- `ses-access-key-id`, `ses-secret-access-key` — pegar AWS console
- `applicationinsights-connection-string` — output Bicep

### Passo 5 — Configurar DNS (Registro.br ou Cloudflare)

Pegar o `customDomainVerificationId` do output do Bicep.

No Registro.br:
```
Tipo: CNAME
Nome: app
Valor: tc-web-prod.bravegrass-....azurecontainerapps.io
TTL: 3600

Tipo: TXT
Nome: asuid.app
Valor: {customDomainVerificationId}
TTL: 3600
```

Repetir para `api`, `opt-in`. Verificar propagação:

```bash
dig app.totalcampanha.com.br
dig +short TXT asuid.app.totalcampanha.com.br
```

Esperar até retornar os valores configurados (5-30 min).

### Passo 6 — Deploy Bicep (Fase B — com domínio custom)

```bash
az deployment group create \
  --resource-group rg-totalcampanha-prod \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.prod.jsonc \
  --parameters postgresAdminPassword="$PGPASS" \
  --parameters baseDomain="totalcampanha.com.br"
```

Bicep agora vincula domínio + emite certificado Let's Encrypt managed (~5 min).

### Passo 7 — Validar

```bash
curl -I https://api.totalcampanha.com.br/health/live  # esperado 200
curl -I https://app.totalcampanha.com.br              # esperado 200 (ainda placeholder, sem imagem)
curl -I https://opt-in.totalcampanha.com.br           # esperado 200
```

### Passo 8 — Build e push primeira imagem (Fase 2)

```bash
# Login ACR
az acr login --name acrtotalcampanha01

# Build api
docker build -f apps/api/Dockerfile -t acrtotalcampanha01.azurecr.io/tc-api:prod-$(git rev-parse --short HEAD) .
docker tag acrtotalcampanha01.azurecr.io/tc-api:prod-$(git rev-parse --short HEAD) acrtotalcampanha01.azurecr.io/tc-api:prod
docker push acrtotalcampanha01.azurecr.io/tc-api:prod-$(git rev-parse --short HEAD)
docker push acrtotalcampanha01.azurecr.io/tc-api:prod

# Build web (com NEXT_PUBLIC_API_URL injetado em build time)
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.totalcampanha.com.br/api \
  -t acrtotalcampanha01.azurecr.io/tc-web:prod-$(git rev-parse --short HEAD) .
docker tag ...
docker push ...

# Build worker
docker build -f apps/worker/Dockerfile -t acrtotalcampanha01.azurecr.io/tc-worker:prod-... .
docker push ...
```

### Passo 9 — Update Container Apps com a imagem

```bash
az containerapp update -g rg-totalcampanha-prod -n tc-api-prod \
  --image acrtotalcampanha01.azurecr.io/tc-api:prod-$(git rev-parse --short HEAD)

# Espera health check
sleep 60
curl https://api.totalcampanha.com.br/health/ready
```

Repetir para `tc-web-prod` e `tc-worker-prod`.

### Passo 10 — Migration inicial em PROD

Esse passo é CRÍTICO. Seguir `instrucao_recuperacao_producao.md` seção 3 (checklist pré-alteração de schema).

Como é a primeira migration:
- Snapshot não aplica (banco vazio)
- Counts antes não aplica (banco vazio)
- Mas plano e confirmação do João continuam obrigatórios

```bash
# Conectar no container e rodar migrate deploy
az containerapp exec --name tc-api-prod -g rg-totalcampanha-prod \
  --command "pnpm prisma migrate deploy"

# Aplicar SQL de RLS (não vem via migrate, é manual)
az containerapp exec --name tc-api-prod -g rg-totalcampanha-prod \
  --command "psql \$DATABASE_URL -f /app/packages/db/prisma/migrations/0002_enable_rls.sql"

# Validar
az containerapp exec --name tc-api-prod -g rg-totalcampanha-prod \
  --command "psql \$DATABASE_URL -c '\\dt'"
```

### Passo 11 — Smoke test inicial

Ver seção 7.

## 4. Custom domain — 2 fases (lição L06)

**Por que 2 fases?** Azure exige que o `customDomainVerificationId` esteja publicado em registro TXT no DNS **antes** de aceitar vincular o domínio custom ao Container App. Tentar fazer tudo em uma passada só falha.

**Fase A:** Bicep deploya sem `baseDomain` → captura `customDomainVerificationId` no output.
**Passo intermediário (humano):** Configurar CNAMEs e TXTs no Registro.br.
**Fase B:** Bicep deploya com `baseDomain` preenchido → vincula domínio + emite cert.

Em deploys subsequentes, sempre passar `baseDomain="totalcampanha.com.br"` — é idempotente.

## 5. Deploy contínuo (após primeira vez)

Em `main`:

```yaml
# .github/workflows/deploy-api.yml
name: Deploy API
on:
  push:
    branches: [main]
    paths: ['apps/api/**', 'packages/**']
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with: { version: 9 }

      - name: Setup Node
        uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint, typecheck, test
        run: |
          pnpm lint
          pnpm typecheck
          pnpm test
          pnpm test:tenant-isolation

      - name: Login Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Login ACR
        run: az acr login --name acrtotalcampanha01

      - name: Build & push
        run: |
          IMAGE_TAG=prod-${GITHUB_SHA::7}
          docker build -f apps/api/Dockerfile \
            -t acrtotalcampanha01.azurecr.io/tc-api:$IMAGE_TAG .
          docker push acrtotalcampanha01.azurecr.io/tc-api:$IMAGE_TAG
          echo "IMAGE_TAG=$IMAGE_TAG" >> $GITHUB_ENV

      - name: Deploy Container App
        run: |
          az containerapp update -g rg-totalcampanha-prod -n tc-api-prod \
            --image acrtotalcampanha01.azurecr.io/tc-api:$IMAGE_TAG

      - name: Wait health check
        run: |
          for i in {1..30}; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.totalcampanha.com.br/health/ready)
            if [ "$STATUS" = "200" ]; then echo "OK"; exit 0; fi
            echo "Try $i: $STATUS, waiting..."
            sleep 10
          done
          echo "Health check failed"
          exit 1

      - name: Smoke test
        run: ./scripts/smoke-test-prod.sh

      - name: Rollback on failure
        if: failure()
        run: |
          PREV=$(az containerapp revision list -g rg-totalcampanha-prod -n tc-api-prod \
            --query "[?properties.active && name != 'tc-api-prod--$IMAGE_TAG'] | sort_by(@, &properties.createdTime) | [-1].name" -o tsv)
          az containerapp ingress traffic set -g rg-totalcampanha-prod -n tc-api-prod \
            --revision-weight "$PREV=100"

      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Deploy tc-api ${{ job.status }}: $IMAGE_TAG"
            }
```

## 6. Rollback manual

Se algo der errado após o deploy (ex.: bug que só apareceu em produção real):

```bash
# Listar revisions ativas
az containerapp revision list -g rg-totalcampanha-prod -n tc-api-prod \
  --query "[].{name:name, created:properties.createdTime, active:properties.active}" -o table

# Trocar tráfego para revision anterior
az containerapp ingress traffic set -g rg-totalcampanha-prod -n tc-api-prod \
  --revision-weight "tc-api-prod--<revision-anterior>=100"

# Confirmar
curl https://api.totalcampanha.com.br/health/ready

# Investigar problema na revision ruim antes de tentar de novo
```

Container Apps mantém revisions por padrão por 7 dias com tráfego desativado. Rollback é instantâneo.

## 7. Smoke test pós-deploy (lição L08)

> Em Total IA Contábil, a aba de Custos IA do Super Admin sumiu após uma série de deploys e ninguém percebeu até o João abrir o painel. Smoke test pega esse tipo de regressão visual.

`scripts/smoke-test-prod.sh`:

```bash
#!/bin/bash
set -e

API=https://api.totalcampanha.com.br
WEB=https://app.totalcampanha.com.br

echo "=== Health checks ==="
curl -fs $API/health/live > /dev/null && echo "✅ api live"
curl -fs $API/health/ready > /dev/null && echo "✅ api ready"
curl -fs $WEB > /dev/null && echo "✅ web up"
curl -fs https://opt-in.totalcampanha.com.br/p/opt-in/teste > /dev/null && echo "✅ opt-in up"

echo "=== Auth flow ==="
# Login com user de smoke test (criado uma vez, senha em Key Vault)
SMOKE_PASS=$(az keyvault secret show --vault-name kv-totalcampanha-prod01 --name smoke-test-password --query value -o tsv)
TOKEN=$(curl -fs -X POST $API/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"smoke@totalcampanha.com.br\",\"password\":\"$SMOKE_PASS\"}" \
  | jq -r .accessToken)
[ -n "$TOKEN" ] && echo "✅ login"

echo "=== Endpoints críticos autenticados ==="
curl -fs $API/api/v1/me -H "Authorization: Bearer $TOKEN" > /dev/null && echo "✅ /me"
curl -fs $API/api/v1/contatos -H "Authorization: Bearer $TOKEN" > /dev/null && echo "✅ /contatos"
curl -fs $API/api/v1/campanhas -H "Authorization: Bearer $TOKEN" > /dev/null && echo "✅ /campanhas"
curl -fs $API/api/v1/conexoes/whatsapp -H "Authorization: Bearer $TOKEN" > /dev/null && echo "✅ /conexoes/whatsapp"

echo "=== Super Admin (lição L08) ==="
SUPER_TOKEN=$(curl -fs -X POST $API/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"superadmin@totalcampanha.com.br\",\"password\":\"$(az keyvault secret show --vault-name kv-totalcampanha-prod01 --name superadmin-smoke-password --query value -o tsv)\"}" \
  | jq -r .accessToken)

# Verificar que as ABAS críticas do Super Admin não sumiram
curl -fs $API/api/v1/admin/tenants -H "Authorization: Bearer $SUPER_TOKEN" > /dev/null && echo "✅ admin/tenants"
curl -fs $API/api/v1/admin/usage -H "Authorization: Bearer $SUPER_TOKEN" > /dev/null && echo "✅ admin/usage (custos por tenant)"
curl -fs $API/api/v1/admin/usage/por-tenant -H "Authorization: Bearer $SUPER_TOKEN" > /dev/null && echo "✅ admin/usage/por-tenant"
curl -fs $API/api/v1/admin/audit -H "Authorization: Bearer $SUPER_TOKEN" > /dev/null && echo "✅ admin/audit"

echo "=== Dispatch end-to-end (opcional, evitar em horário de pico) ==="
if [ "$SMOKE_DISPATCH" = "true" ]; then
  # Criar campanha de teste para 1 destinatário interno
  # ... (implementação completa em scripts/smoke-test-dispatch.sh)
  echo "✅ dispatch test enviado (verificar inbox manualmente)"
fi

echo ""
echo "=== ✅ Smoke test passou ==="
```

Falha em qualquer ponto → exit code != 0 → pipeline aciona rollback.

## 8. Investigando "sumiu funcionalidade após deploy" (lição L08)

Se algo sumiu da UI:

```bash
# 1. NÃO recriar do zero
# 2. Listar commits da janela do deploy
git log --since="2 days ago" --oneline

# 3. Procurar commits que tocaram o arquivo/componente sumido
git log --since="2 days ago" -- apps/web/components/SuperAdmin/CustosIA.tsx

# 4. Olhar o diff
git show <sha>

# 5. Se foi removido sem intenção, revert ou cherry-pick correção
git revert <sha>

# 6. Se foi removido com intenção mas regressão acidental, recriar com cuidado e
#    adicionar teste e2e que pega esse caso
```

## 9. Versionamento de releases

- Branches: `main` (protegida), `feat/*`, `fix/*`, `hotfix/*`
- Tags: `vMAJOR.MINOR.PATCH` (semver)
- Cada tag tem release no GitHub com changelog gerado por `release-please`
- Tag → imagem versionada permanente no ACR (`tc-api:v1.2.3`)
- Política de retenção ACR: imagens `prod-{sha}` por 30 dias, `v*` para sempre

## 10. Checklist de deploy seguro

Antes de mergear PR que vai para PROD:
- [ ] CI passou (lint, typecheck, test, tenant-isolation)
- [ ] Houve review de pelo menos 1 humano
- [ ] PR descreve mudanças e riscos
- [ ] Se tem migration: passou pelo checklist de `instrucao_recuperacao_producao.md` seção 3
- [ ] Se mudou env vars: novas vars criadas em Key Vault ANTES do deploy
- [ ] Se quebra contrato API: versão `/api/v2/` em paralelo, depreciar `v1` por 30 dias

Pós-deploy:
- [ ] Smoke test passou
- [ ] Application Insights sem erros novos nas 1h seguintes
- [ ] Health check estável
- [ ] Slack notificado
