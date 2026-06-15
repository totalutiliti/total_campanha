// ============================================================================
// Total Campanha — infraestrutura PROD ENXUTA (lançamento / baixo custo).
//
// Objetivo: rodar o produto completo pelo menor custo possível, mantendo
// backup gerenciado, segredos no Key Vault e dados em brazilsouth (LGPD).
// ~R$ 250-400/mês. Quando a demanda crescer, migrar para `main.bicep` (HA).
//
// O que MUDA vs main.bicep (HA):
//   - Postgres B1ms Burstable, SEM HA, 32GB, backup 7d local (era D2ds_v4 GP +
//     ZoneRedundant + 128GB + 35d geo). SEM PgBouncer (não suportado no Burstable).
//   - Redis Basic C0 (era Standard C1).
//   - Storage LRS (era GRS).
//   - SEM VNet / Private Endpoints / DNS privado → endpoints públicos + firewall + TLS.
//   - Container Apps api/web em scale-to-zero (min 0); worker min 1 (processa a fila).
//     CPU 0.5 / 1Gi (era 1 / 2Gi).
//   - Key Vault público (RBAC) → resolve o blocker do smoke-test em runner público.
//
// Deploy:
//   az deployment group create -g rg-totalcampanha-prod \
//     --template-file infra/main.lean.bicep \
//     --parameters infra/main.parameters.prod-lean.jsonc \
//     --parameters postgresAdminPassword="$PGPASS" --parameters baseDomain=""
// ============================================================================

targetScope = 'resourceGroup'

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------
@description('Região Azure. Brazil South para tudo (LGPD: dados no Brasil).')
param location string = 'brazilsouth'

@description('Ambiente. Compõe o naming de todos os recursos.')
@allowed(['dev', 'prod'])
param environment string = 'prod'

@description('Senha do admin do PostgreSQL. Passar via --parameters na CLI, nunca commitar.')
@secure()
param postgresAdminPassword string

@description('Domínio base. Vazio na Fase A; "totalcampanha.com.br" na Fase B.')
param baseDomain string = ''

@description('Budget mensal em R$ (BRL). Teto enxuto para pegar surpresa cedo — RULES 6.4.')
param budgetMensalBrl int = 800

@description('Email do João para alertas de budget e métricas.')
param alertEmail string = 'joao@totalutiliti.com.br'

@description('Resource group onde o ACR compartilhado já existe.')
param acrResourceGroup string = 'rg-totalcampanha-dev'

// ---------------------------------------------------------------------------
// Naming (instrucao_azure.md seção 1)
// ---------------------------------------------------------------------------
var sufixo = 'totalcampanha-${environment}'
var tags = {
  Environment: environment
  Project: 'totalcampanha'
  Owner: 'totalutiliti'
  CentroDeCusto: 'totalcampanha-${environment}'
  Perfil: 'lean'
}

var nomes = {
  postgres: 'pg-${sufixo}'
  redis: 'redis-${sufixo}'
  acr: 'acrtotalcampanha01'
  keyVault: 'kv-${sufixo}01'
  storage: 'st${replace(sufixo, '-', '')}01'
  cae: 'cae-${sufixo}'
  logAnalytics: 'log-${sufixo}'
  appInsights: 'appi-${sufixo}'
}

var dbName = 'total_campanha_${environment}'
var quickstartImage = 'mcr.microsoft.com/k8se/quickstart:latest'

// ---------------------------------------------------------------------------
// Observabilidade — Log Analytics (com cap diário p/ custo) + App Insights
// ---------------------------------------------------------------------------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: nomes.logAnalytics
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    workspaceCapping: { dailyQuotaGb: 1 } // teto de ingestão p/ não estourar custo
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: nomes.appInsights
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL Flexible Server — B1ms Burstable, SEM HA, público + firewall.
// SEM PgBouncer (não suportado no tier Burstable) — app conecta direto na 5432.
// ---------------------------------------------------------------------------
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: nomes.postgres
  location: location
  tags: tags
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: 'tcadmin'
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: dbName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// Libera acesso dos serviços Azure (Container Apps tem IP de saída dinâmico).
resource pgFirewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource pgPreload 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgres
  name: 'shared_preload_libraries'
  properties: { value: 'pg_stat_statements', source: 'user-override' }
  dependsOn: [pgFirewallAzure]
}

// ---------------------------------------------------------------------------
// Redis — Basic C0 (250MB), público + keys, noeviction (CRÍTICO para BullMQ).
// ---------------------------------------------------------------------------
resource redis 'Microsoft.Cache/redis@2024-03-01' = {
  name: nomes.redis
  location: location
  tags: tags
  properties: {
    sku: { name: 'Basic', family: 'C', capacity: 0 }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    redisConfiguration: { 'maxmemory-policy': 'noeviction' }
  }
}

// ---------------------------------------------------------------------------
// Storage Account — LRS, soft delete 14d, público (acesso via keys/SAS).
// ---------------------------------------------------------------------------
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: nomes.storage
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 14 }
    isVersioningEnabled: true
  }
}
resource campanhasContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'campanhas'
  properties: { publicAccess: 'None' }
}

// ---------------------------------------------------------------------------
// ACR — COMPARTILHADO (já existe em rg-totalcampanha-dev). Só referenciado.
// ---------------------------------------------------------------------------
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: nomes.acr
  scope: resourceGroup(acrResourceGroup)
}

// ---------------------------------------------------------------------------
// Key Vault — público (RBAC). Resolve o smoke-test em runner público.
// ---------------------------------------------------------------------------
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: nomes.keyVault
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
  }
}

// ---------------------------------------------------------------------------
// Container Apps Environment — Consumption, SEM VNet, SEM zona redundante.
// ---------------------------------------------------------------------------
resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: nomes.cae
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    zoneRedundant: false
  }
}

// ---------------------------------------------------------------------------
// Container Apps — api, web, worker. Imagem quickstart; deploy real via workflow.
// api/web: scale-to-zero (min 0) — cold start ~20-40s aceitável no lançamento.
// worker: min 1 (sempre processa a fila BullMQ). CPU 0.5 / 1Gi.
// ---------------------------------------------------------------------------
resource appApi 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'tc-api-${environment}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: cae.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3001
        transport: 'auto'
        customDomains: empty(baseDomain) ? [] : [
          { name: 'api.${baseDomain}', bindingType: 'SniEnabled' }
        ]
      }
      registries: [
        { server: '${nomes.acr}.azurecr.io', identity: 'system' }
      ]
    }
    template: {
      containers: [
        {
          name: 'tc-api'
          image: quickstartImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/api/v1/health/live', port: 3001 }
              periodSeconds: 30
              initialDelaySeconds: 10
            }
            {
              type: 'Readiness'
              httpGet: { path: '/api/v1/health/ready', port: 3001 }
              periodSeconds: 10
              initialDelaySeconds: 5
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 4
        rules: [
          { name: 'http', http: { metadata: { concurrentRequests: '50' } } }
        ]
      }
    }
  }
}

resource appWeb 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'tc-web-${environment}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: cae.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        customDomains: empty(baseDomain) ? [] : [
          { name: 'app.${baseDomain}', bindingType: 'SniEnabled' }
        ]
      }
      registries: [
        { server: '${nomes.acr}.azurecr.io', identity: 'system' }
      ]
    }
    template: {
      containers: [
        {
          name: 'tc-web'
          image: quickstartImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/login', port: 3000 }
              periodSeconds: 30
              initialDelaySeconds: 10
            }
            {
              type: 'Readiness'
              httpGet: { path: '/login', port: 3000 }
              periodSeconds: 10
              initialDelaySeconds: 5
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 4
        rules: [
          { name: 'http', http: { metadata: { concurrentRequests: '80' } } }
        ]
      }
    }
  }
}

resource appWorker 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'tc-worker-${environment}'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: cae.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        { server: '${nomes.acr}.azurecr.io', identity: 'system' }
      ]
    }
    template: {
      containers: [
        {
          name: 'tc-worker'
          image: quickstartImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 4
      }
    }
  }
}

// ---------------------------------------------------------------------------
// RBAC — cada Container App lê ACR (pull) e Key Vault (secrets)
// ---------------------------------------------------------------------------
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User

// Itera sobre nomes ESTÁTICOS (length conhecido no início) e indexa os
// principalIds de runtime no corpo — evita BCP178.
var appNames = ['api', 'web', 'worker']
var appPrincipals = [
  appApi.identity.principalId
  appWeb.identity.principalId
  appWorker.identity.principalId
]

module acrPull 'modules/acr-pull.bicep' = {
  name: 'acr-pull-lean-${environment}'
  scope: resourceGroup(acrResourceGroup)
  params: {
    acrName: nomes.acr
    principalIds: appPrincipals
  }
}

resource kvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (nome, i) in appNames: {
    name: guid(keyVault.id, nome, 'kvsecrets')
    scope: keyVault
    properties: {
      roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
      principalId: appPrincipals[i]
      principalType: 'ServicePrincipal'
    }
  }
]

// ---------------------------------------------------------------------------
// Budget — alerta 80% / 100% (teto enxuto)
// ---------------------------------------------------------------------------
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'budget-totalcampanha-${environment}'
  properties: {
    category: 'Cost'
    amount: budgetMensalBrl
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: '2026-06-01'
      endDate: '2030-01-01'
    }
    notifications: {
      aviso80: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        contactEmails: [alertEmail]
      }
      critico100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        contactEmails: [alertEmail]
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Alertas de métrica + Action Group
// ---------------------------------------------------------------------------
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-totalcampanha-${environment}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'tc-${environment}'
    enabled: true
    emailReceivers: [
      { name: 'operacao', emailAddress: alertEmail, useCommonAlertSchema: true }
    ]
  }
}

resource alertApi5xx 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-tc-api-5xx-${environment}'
  location: 'global'
  tags: tags
  properties: {
    severity: 1
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          name: 'falhas5xx'
          metricName: 'requests/failed'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Count'
        }
      ]
    }
    actions: [{ actionGroupId: actionGroup.id }]
  }
}

resource alertPgCpu 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-pg-cpu-${environment}'
  location: 'global'
  tags: tags
  properties: {
    severity: 2
    enabled: true
    scopes: [postgres.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          name: 'cpuAlta'
          metricName: 'cpu_percent'
          operator: 'GreaterThan'
          threshold: 80
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [{ actionGroupId: actionGroup.id }]
  }
}

resource alertRedisMem 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-redis-mem-${environment}'
  location: 'global'
  tags: tags
  properties: {
    severity: 1
    enabled: true
    scopes: [redis.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          name: 'memoriaAlta'
          metricName: 'usedmemorypercentage'
          operator: 'GreaterThan'
          threshold: 90
          timeAggregation: 'Maximum'
        }
      ]
    }
    actions: [{ actionGroupId: actionGroup.id }]
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
output apiFqdn string = appApi.properties.configuration.ingress.fqdn
output webFqdn string = appWeb.properties.configuration.ingress.fqdn
output apiCustomDomainVerificationId string = appApi.properties.customDomainVerificationId
output webCustomDomainVerificationId string = appWeb.properties.customDomainVerificationId
output keyVaultUri string = keyVault.properties.vaultUri
output keyVaultName string = keyVault.name
output acrLoginServer string = acr.properties.loginServer
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output redisHostName string = redis.properties.hostName
output appInsightsConnectionString string = appInsights.properties.ConnectionString
