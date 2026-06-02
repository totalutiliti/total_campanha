# Deploy DEV (Azure) — Total Campanha

> Ambiente **dev/POC** de menor custo, com **scale-to-zero** nos apps. Segue o
> padrão dos projetos irmãos (ex.: `rg-kegsafe-dev`): ACR + Postgres Flexible +
> Container Apps (Consumption), **sem** VNet/private-endpoints/Key Vault (isso é
> só no PROD — ver `infra/main.bicep` + `instrucoes/instrucao_azure.md`).
>
> **Não é o PROD.** Deploy de PROD continua pelo pipeline (GitHub Actions) a
> partir da `main`, com a topologia robusta do `main.bicep`.

## Recursos (RG `rg-totalcampanha-dev`, `brazilsouth`, tags do projeto)

| Recurso | Nome | SKU / config |
|---|---|---|
| Container Registry | `acrtotalcampanha01` | Basic (admin user habilitado p/ pull no dev) |
| Container Apps Env | `cae-totalcampanha-dev` | Consumption, Log Analytics auto |
| PostgreSQL Flexible | `pg-totalcampanha-dev` | Burstable **Standard_B1ms**, 32GB, v16, `azure.extensions=PGCRYPTO,UUID-OSSP` |
| Redis | `tc-redis-dev` | Container App `redis:7-alpine`, TCP interno :6379, **min=1** (boot confiável da API) |
| API | `tc-api-dev` | ingress 3001, **min=0/max=2** |
| Web | `tc-web-dev` | ingress 3000, **min=0/max=2** |
| Worker | `tc-worker-dev` | sem ingress, **min=0/max=1** |

Domínio do env: `*.<id>.brazilsouth.azurecontainerapps.io`.

## Segredos

Gerados fora do repo em `../.azure-dev-secrets.env` (NUNCA commitar). Contêm:
`PG_ADMIN_*`, `APP_DB_PASSWORD`/`MIG_DB_PASSWORD` (papéis `app_user`/`migration_user`),
`AUTH_PEPPER`, `JWT_*`, `TOKEN_KMS_KEY`, `OPT_OUT_TOKEN_SECRET`, `ACR_*`, `SA_*`.
O `AUTH_PEPPER` usado no `seed`/`criar-super-admin` é o MESMO injetado nos apps.

## Passos (resumo do que foi executado)

```bash
RG=rg-totalcampanha-dev; LOC=brazilsouth; REG=acrtotalcampanha01
# 1) base
az group create -n $RG -l $LOC --tags Environment=dev Project=totalcampanha Owner=totalutiliti
az acr create -n $REG -g $RG --sku Basic
az containerapp env create -n cae-totalcampanha-dev -g $RG -l $LOC   # -> defaultDomain

# 2) postgres (sem --database-name nesta versao do CLI)
az postgres flexible-server create -g $RG -n pg-totalcampanha-dev -l $LOC \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
  --admin-user tcadmin --admin-password "$PG_ADMIN_PASSWORD" --public-access <MEU_IP> --yes
az postgres flexible-server db create -g $RG -s pg-totalcampanha-dev -d total_campanha_dev
az postgres flexible-server firewall-rule create -g $RG -n pg-totalcampanha-dev \
  --rule-name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
az postgres flexible-server parameter set -g $RG -s pg-totalcampanha-dev \
  --name azure.extensions --value PGCRYPTO,UUID-OSSP

# 3) redis (Container App, TCP interno)
az containerapp create -n tc-redis-dev -g $RG --environment cae-totalcampanha-dev \
  --image redis:7-alpine --min-replicas 1 --max-replicas 1 --cpu 0.25 --memory 0.5Gi \
  --ingress internal --transport tcp --target-port 6379 --exposed-port 6379

# 4) imagens — BUILD LOCAL + push (o `az acr build` quebra no cliente Windows:
#    UnicodeEncodeError do colorama ao transmitir o log do pnpm). Contexto limpo
#    via `git archive HEAD` (sem node_modules/symlinks).
az acr login -n $REG
docker build -f apps/api/Dockerfile    -t $REG.azurecr.io/tc-api:dev    <ctx>
docker build -f apps/worker/Dockerfile -t $REG.azurecr.io/tc-worker:dev <ctx>
docker build -f apps/web/Dockerfile -t $REG.azurecr.io/tc-web:dev \
  --build-arg NEXT_PUBLIC_API_URL=https://tc-api-dev.<dom>/api/v1 \
  --build-arg NEXT_PUBLIC_APP_URL=https://tc-web-dev.<dom> <ctx>
docker push ...   # cada uma

# 5) migrations + dados (rodado de dentro de um container com a stack; tcadmin tem BYPASSRLS)
#    prisma migrate deploy  (DATABASE_MIGRATION_URL=tcadmin)
#    ALTER ROLE app_user/migration_user PASSWORD ...; GRANT ... TO migration_user;
#    pnpm --filter @total-campanha/db run seed            (DATABASE_URL=tcadmin, AUTH_PEPPER)
#    pnpm --filter @total-campanha/db run criar-super-admin (SA_EMAIL/SA_PASSWORD/AUTH_PEPPER)

# 6) apps (via YAML em _caapps/, com secrets; ingress habilitado pelo CLI —
#    o bloco ingress no YAML dava erro de schema nesta versao do CLI)
az containerapp create -n tc-api-dev    -g $RG --yaml tc-api.yaml
az containerapp ingress enable -n tc-api-dev -g $RG --type external --target-port 3001 --transport auto
az containerapp create -n tc-web-dev    -g $RG --yaml tc-web.yaml
az containerapp ingress enable -n tc-web-dev -g $RG --type external --target-port 3000 --transport auto
az containerapp create -n tc-worker-dev -g $RG --yaml tc-worker.yaml
```

### Contrato de env dos apps (ver `apps/api/src/config/env.ts`)
Obrigatórias na API/worker: `DATABASE_URL` (app_user), `DATABASE_MIGRATION_URL`
(migration_user, BYPASSRLS — necessário p/ o painel Super Admin cross-tenant),
`REDIS_URL=redis://tc-redis-dev:6379`, `AUTH_PEPPER`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `TOKEN_KMS_KEY`. API ainda: `CORS_ORIGINS` (FQDN do web),
`API_PUBLIC_URL`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, `COOKIE_DOMAIN`
(host da API), URLs públicas de opt-in/out e webhook. Web (runtime): `PORT=3000`,
`HOSTNAME=0.0.0.0` (Next standalone bind), `NODE_ENV=production`.

## Custo (ordem de grandeza)
ACR Basic ~US$5 + Postgres B1ms ~US$13 + Redis min=1 ~US$13 + api/web scale-to-zero
~US$0 ocioso ≈ **~US$31/mês**. Reduzir: parar o Postgres entre demos
(`az postgres flexible-server stop`), e/ou Redis `--min-replicas 0` (cold-start na 1ª request).

## Operação
- Acordar/cold start: 1ª request a `tc-api-dev`/`tc-web-dev` sobe a réplica (~20-40s).
- Parar Postgres: `az postgres flexible-server stop -g rg-totalcampanha-dev -n pg-totalcampanha-dev`.
- Logs: `az containerapp logs show -n tc-api-dev -g rg-totalcampanha-dev --type console --tail 50`.
- Redeploy de imagem (mesma tag): `az containerapp update -n tc-api-dev -g rg-totalcampanha-dev --image acrtotalcampanha01.azurecr.io/tc-api:dev --revision-suffix vN`.

## Bugs de Dockerfile corrigidos junto deste deploy (valem p/ PROD também)
- api/worker: faltava `pnpm --filter @total-campanha/db build` (só `generate`).
- `pnpm deploy --prod` com filtro `...` (3 projetos) → `ERR_PNPM_CANNOT_DEPLOY_MANY`.
- Prisma Client sumia no `deploy --prod` → runtime passou a usar o estágio de build.
- Faltava `apk add openssl` (Alpine 3/OpenSSL 3) → Prisma caía no engine openssl-1.1.
- `apps/web/public/.gitkeep` (a pasta não existia no git e o `COPY public` quebrava).
