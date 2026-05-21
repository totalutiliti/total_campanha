# instrucao_azure.md — Total Campanha

> Operação Azure: provisionamento, scaling, custos, segurança, naming convention.
> Audiência: Antigravity, João, futuros operadores.

## 1. Subscription, RGs e naming

- **Subscription:** "Assinatura do Azure 1" (ID: `39c8f9b3-7ecd-4e1c-a9cb-6be6b1d2740e`)
- **Região:** Brazil South (`brazilsouth`) para tudo, exceto Azure OpenAI (se vier no futuro, Sweden Central como em Total IA Contábil)
- **Resource Groups:**
  - `rg-totalcampanha-dev`
  - `rg-totalcampanha-prod`
- **Padrão de naming:**
  - PostgreSQL: `pg-totalcampanha-{ambiente}`
  - Redis: `redis-totalcampanha-{ambiente}`
  - Container Apps: `tc-{servico}-{ambiente}` (`tc-api-prod`, `tc-web-prod`, `tc-worker-prod`)
  - ACR: `acrtotalcampanha01` (sem hífen)
  - Key Vault: `kv-totalcampanha-{ambiente}01`
  - Storage Account: `sttotalcampanha{ambiente}01`
  - VNet: `vnet-totalcampanha-{ambiente}`
  - Container Apps Env: `cae-totalcampanha-{ambiente}`
  - Log Analytics: `log-totalcampanha-{ambiente}`
  - App Insights: `appi-totalcampanha-{ambiente}`

## 2. Isolamento entre projetos (lição L03 — incidente Olicon)

> Em abril/2026, o projeto Olicon do sócio do João usou por engano a key do Document Intelligence do Total IA Contábil e gerou R$ 237 de cobrança indevida.

**Regras de saída:**
- Cada projeto tem suas **próprias** keys, secrets, recursos.
- **Nunca** compartilhar API key entre projetos, mesmo "só para testar".
- Naming convention SEMPRE inclui o nome do projeto para evitar confusão.
- Em Key Vault, prefixo `totalcampanha-` em todos os secrets.

## 3. Tags obrigatórias em todos os recursos

```json
{
  "Environment": "dev|prod",
  "Project": "totalcampanha",
  "Owner": "totalutiliti",
  "CentroDeCusto": "totalcampanha-{ambiente}"
}
```

Aplicado automaticamente via Bicep `tags` no resource group + `inheritsTagsFromResourceGroup` nos recursos.

## 4. Quotas e pré-deploy checklist

Antes do primeiro deploy PROD, validar:

- [ ] Subscription tem cotas suficientes:
  - Container Apps: 30 cores reservados na região
  - PostgreSQL Flex: D-series disponível em Brazil South
  - Redis: C-series disponível
- [ ] Domínio `totalcampanha.com.br` registrado e DNS controlado (Registro.br ou Cloudflare)
- [ ] Email institucional `vendas@totalcampanha.com.br` (para SES verification)
- [ ] Conta Asaas (ou Stripe) ativa e webhook URL definida
- [ ] Amazon AWS account com SES em modo produção (sandbox tem limite 200/dia)
- [ ] Service Principal Azure criado para GitHub Actions (com role `Contributor` em `rg-totalcampanha-prod`)

## 5. Configuração de PROD (resumo Bicep)

### PostgreSQL Flexible Server

```bicep
sku: { name: 'Standard_D2ds_v4', tier: 'GeneralPurpose' }
highAvailability: { mode: 'ZoneRedundant' }
storage: { storageSizeGB: 128, autoGrow: 'Enabled' }
backup: { backupRetentionDays: 35, geoRedundantBackup: 'Enabled' }
postgresqlConfigurations: [
  { name: 'pgbouncer.enabled', value: 'true' }
  { name: 'shared_preload_libraries', value: 'pg_stat_statements,pgaudit' }
]
network: { delegatedSubnetResourceId: <vnet-subnet-db>, privateDnsZoneArmResourceId: <zone> }
```

### Azure Cache for Redis

```bicep
sku: { name: 'Standard', family: 'C', capacity: 1 }
redisConfiguration: {
  'maxmemory-policy': 'noeviction'   // CRÍTICO para BullMQ
}
publicNetworkAccess: 'Disabled'
```

### Container Apps (cada um)

```bicep
properties: {
  managedEnvironmentId: <cae>
  configuration: {
    ingress: { external: true, targetPort: 3000 }
    secrets: [
      { name: 'database-url', keyVaultUrl: 'https://kv.../secrets/database-url', identity: 'system' }
      // ...
    ]
    registries: [{ server: 'acrtotalcampanha01.azurecr.io', identity: 'system' }]
  }
  template: {
    containers: [{
      name: 'tc-api'
      image: 'acrtotalcampanha01.azurecr.io/tc-api:${imageTag}'
      resources: { cpu: 1, memory: '2Gi' }
      env: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'DATABASE_URL', secretRef: 'database-url' }
        // ...
      ]
      probes: [
        { type: 'Liveness', httpGet: { path: '/health/live', port: 3000 }, periodSeconds: 30 }
        { type: 'Readiness', httpGet: { path: '/health/ready', port: 3000 }, periodSeconds: 10 }
      ]
    }]
    scale: {
      minReplicas: 1                    // NUNCA 0 em PROD (lição L04)
      maxReplicas: 8
      rules: [
        { name: 'http', http: { metadata: { concurrentRequests: '50' } } }
      ]
    }
  }
}
```

### Worker KEDA scaler

```bicep
scale: {
  minReplicas: 1
  maxReplicas: 10
  rules: [{
    name: 'whatsapp-queue'
    custom: {
      type: 'redis'
      metadata: {
        host: 'redis-totalcampanha-prod.redis.cache.windows.net'
        port: '6380'
        enableTLS: 'true'
        listName: 'bull:dispatch:whatsapp:wait'
        listLength: '50'
      }
      auth: [{ secretRef: 'redis-password', triggerParameter: 'password' }]
    }
  }]
}
```

## 6. Sazonalidade — datas comerciais (lição L05)

Para Total Campanha, picos previsíveis:
- **Dia das Mães** (~10 dias antes até a data)
- **Black Friday** (semana toda + Cyber Monday)
- **Natal** (15-25 dezembro)
- **Dia dos Namorados**
- **Páscoa**

**Scripts no repo:**

```bash
# infra/scale-up.sh
#!/bin/bash
# Aumenta limites temporariamente
az containerapp update -g rg-totalcampanha-prod -n tc-worker-prod \
  --scale-rule-name whatsapp-queue --scale-rule-metadata listLength=20 \
  --max-replicas 30 --yes
az containerapp update -g rg-totalcampanha-prod -n tc-api-prod \
  --max-replicas 20 --yes
echo "Escalado para temporada. Lembre de rodar scale-down.sh após a data."
```

```bash
# infra/scale-down.sh
#!/bin/bash
az containerapp update -g rg-totalcampanha-prod -n tc-worker-prod \
  --scale-rule-name whatsapp-queue --scale-rule-metadata listLength=50 \
  --max-replicas 10 --yes
az containerapp update -g rg-totalcampanha-prod -n tc-api-prod \
  --max-replicas 8 --yes
```

Reminder no calendário do João: rodar scale-up 7 dias antes de cada data comercial conhecida.

## 7. Painel de custo (lição L10)

### 7.1. Custo Azure por projeto

Filtros em Azure Cost Management:
- Por tag `Project=totalcampanha`
- Por resource group `rg-totalcampanha-prod`

Dashboard pinado no portal Azure com:
- Custo do mês atual
- Tendência diária
- Top 5 recursos
- Comparação com mês anterior

### 7.2. Custo por tenant (aplicação)

Já implementado desde o dia 1 via tabela `usage_log` (ver `SPECS.md`):
- Painel Super Admin → "Custos por tenant"
- Filtros: período, serviço, tenant
- Export CSV

### 7.3. Budgets e alertas

Bicep cria budgets:
- 80% do mensal (`R$ 2.400 de R$ 3.000`) → email João
- 100% → email João + Slack + flag `FREEZE_NEW_TENANTS=true` na app (variável em Key Vault)

## 8. Backup e DR

### PostgreSQL
- Backup automatizado 35 dias, geo-redundante
- PITR habilitado (5 min granularity)
- Teste de restore mensal (rodar restore para servidor temporário em DEV, validar, deletar)

### Storage Account
- Soft delete 14 dias
- Versioning ativado para uploads críticos

### Container Apps revisions
- Mantém últimas 100 revisions (default)
- Rollback instantâneo:
  ```bash
  az containerapp ingress traffic set \
    --name tc-api-prod -g rg-totalcampanha-prod \
    --revision-weight tc-api-prod--<previous>=100
  ```

### Key Vault
- Soft delete 90 dias + purge protection
- RBAC: só João + Service Principal do GH Actions têm `Key Vault Secrets Officer`

## 9. Segurança de rede

- VNet com 3 subnets: `subnet-cae`, `subnet-db`, `subnet-pe` (private endpoints)
- Private endpoints para: PostgreSQL, Redis, Storage, Key Vault
- Container Apps Environment com VNet integration
- Public ingress apenas via Container Apps (com TLS managed)
- Outbound: NAT Gateway opcional (depende de IP estático para Meta — verificar se Meta exige)

## 10. Observabilidade

### Application Insights

Connection string em env var em todos os Container Apps. SDK auto-instrumenta:
- HTTP requests
- Database queries
- Redis
- Custom metrics (campaign.dispatched, queue.length, etc.)

### Alertas (Bicep)

```bicep
// Erro 5xx > 1% em 5 min
resource alert500 'Microsoft.Insights/metricAlerts@...' = {
  name: 'alert-tc-api-5xx'
  properties: {
    criteria: { allOf: [{ metricName: 'requests/failed', operator: 'GreaterThan', threshold: 5 }] }
    actions: [{ actionGroupId: <action-group-slack> }]
  }
}

// Fila > 5000 jobs por 10 min
// PostgreSQL CPU > 80% por 15 min
// Budget > 80% mensal
```

### Logs query úteis (KQL)

```kusto
// Mensagens enviadas por tenant na última hora
customMetrics
| where name == "campaign.dispatched.total"
| where timestamp > ago(1h)
| summarize sum(value) by tostring(customDimensions.tenant_id)
| order by sum_value desc

// Erros de Meta API
traces
| where customDimensions.event == "meta_api_error"
| where timestamp > ago(24h)
| project timestamp, customDimensions.tenant_id, customDimensions.error_code, message
```

## 11. CI/CD Service Principal

```bash
az ad sp create-for-rbac \
  --name "github-totalcampanha-deployer" \
  --role contributor \
  --scopes /subscriptions/<sub>/resourceGroups/rg-totalcampanha-prod \
  --sdk-auth
```

Salvar JSON output em GitHub Secrets como `AZURE_CREDENTIALS`.

Outro SP para ACR push:
```bash
az ad sp create-for-rbac \
  --name "github-totalcampanha-acr" \
  --role acrpush \
  --scopes <acr-id>
```

## 12. Checklist mensal de operação

- [ ] Custo do mês ficou dentro do budget?
- [ ] Restore PITR testado em DEV?
- [ ] Alertas firmes ou flapping?
- [ ] Há tenants com fila acumulando? (lookup `bull:dispatch:*:wait`)
- [ ] Versões de imagem ACR antigas (>30 dias) podem ser purgadas?
- [ ] Key Vault: algum secret expirando?
- [ ] PostgreSQL: storage > 80%? (deveria autogrow, mas confirmar)
- [ ] Container Apps revisions > 100? (purga manual se sim)
