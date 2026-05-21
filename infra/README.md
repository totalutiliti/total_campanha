# infra/

Infraestrutura Azure (Bicep) de **Total Campanha**.

> Antes de qualquer deploy: ler `instrucoes/instrucao_azure.md` e
> `instrucoes/instrucao_deploys.md` na íntegra.

## Arquivos

| Arquivo | O quê |
|---|---|
| `main.bicep` | Template completo de PROD |
| `main.parameters.prod.jsonc` | Parâmetros do deploy PROD |
| `scale-up.sh` / `scale-down.sh` | Scaling sazonal (datas comerciais) |

## O que o `main.bicep` provisiona

- Log Analytics + Application Insights
- VNet (`10.20.0.0/16`) + 3 subnets (`cae`, `db` delegada, `pe`) + private DNS zones
- PostgreSQL Flexible Server 16 — `Standard_D2ds_v4`, HA zone-redundant, 128GB autogrow, backup 35d geo-redundante, PgBouncer
- Azure Cache for Redis — Standard C1, `maxmemory-policy=noeviction`, private endpoint
- Storage Account — GRS, soft delete 14d, versioning, private endpoint
- ACR `acrtotalcampanha01` — Standard
- Key Vault — soft delete 90d + purge protection, private endpoint, RBAC
- Container Apps Environment — VNet integrado, zone-redundant
- 3 Container Apps (`tc-api/web/worker-prod`) — **min-replicas=1** (nunca 0), system identity
- RBAC: cada app lê ACR (AcrPull) e Key Vault (Secrets User)
- Budget mensal com alertas 80% / 100%

## Deploy (resumo — detalhes em `instrucao_deploys.md` seção 3)

```bash
az group create -n rg-totalcampanha-prod -l brazilsouth \
  --tags Project=totalcampanha Environment=prod Owner=totalutiliti

PGPASS=$(openssl rand -base64 32 | tr -d '+/=' | head -c 32)

# Fase A — sem domínio custom (captura customDomainVerificationId)
az deployment group create -g rg-totalcampanha-prod \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.prod.jsonc \
  --parameters postgresAdminPassword="$PGPASS" --parameters baseDomain=""

# → configurar CNAMEs + TXT asuid.* no Registro.br com os outputs

# Fase B — com domínio custom (vincula + emite cert managed)
az deployment group create -g rg-totalcampanha-prod \
  --template-file infra/main.bicep \
  --parameters infra/main.parameters.prod.jsonc \
  --parameters postgresAdminPassword="$PGPASS" \
  --parameters baseDomain="totalcampanha.com.br"
```

## Notas importantes

- **Container Apps sobem com a imagem quickstart da Microsoft.** Os workflows
  `.github/workflows/deploy-*.yml` trocam para a imagem real via
  `az containerapp update`.
- **Env vars e secrets** dos apps são configurados pós-infra: popular o Key
  Vault (`instrucao_deploys.md` Passo 4) e então
  `az containerapp update --set-env-vars ... --secrets ...` referenciando os
  segredos via `keyvaultref:`.
- **KEDA Redis scaler** do worker é configurado via `az containerapp update`
  após o worker ter o secret `redis-password` (`instrucao_azure.md` seção 5).
- O `main.bicep` é **idempotente** — em deploys subsequentes sempre passar
  `baseDomain="totalcampanha.com.br"`.
