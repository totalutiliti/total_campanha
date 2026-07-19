// ============================================================================
// Total Campanha — infraestrutura PROD (Azure).
//
// Deploy (ver instrucoes/instrucao_deploys.md seção 3):
//   az deployment group create -g rg-totalcampanha-prod \
//     --template-file infra/main.bicep \
//     --parameters infra/main.parameters.prod.jsonc \
//     --parameters postgresAdminPassword="$PGPASS" --parameters baseDomain=""
//
// Custom domain é 2 fases: deploy 1x com baseDomain='' (captura
// customDomainVerificationId), configura DNS, redeploy com baseDomain preenchido.
//
// O resource group deve ser criado ANTES (az group create).
// ============================================================================

targetScope = 'resourceGroup'

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------
@description('Região Azure. Brazil South para tudo (instrucao_azure.md seção 1).')
param location string = 'brazilsouth'

@description('Ambiente. Compõe o naming de todos os recursos.')
@allowed(['dev', 'prod'])
param environment string = 'prod'

@description('Senha do admin do PostgreSQL. Passar via --parameters na CLI, nunca commitar.')
@secure()
param postgresAdminPassword string

@description('Domínio base. Vazio na Fase A; "totalcampanha.com.br" na Fase B.')
param baseDomain string = ''

@description('Tag da imagem dos Container Apps. Os workflows de deploy sobrescrevem via az containerapp update.')
param imageTag string = 'prod'

@description('Budget mensal em R$ (BRL). Alerta em 80%, freeze em 100% — RULES 6.4.')
param budgetMensalBrl int = 3000

@description('Email do João para alertas de budget e métricas.')
param alertEmail string = 'joao@totalutiliti.com.br'

// ---------------------------------------------------------------------------
// Variáveis — naming convention (instrucao_azure.md seção 1)
// ---------------------------------------------------------------------------
var sufixo = 'totalcampanha-${environment}'
var tags = {
  Environment: environment
  Project: 'totalcampanha'
  Owner: 'totalutiliti'
  CentroDeCusto: 'totalcampanha-${environment}'
}

var nomes = {
  vnet: 'vnet-${sufixo}'
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

// ---------------------------------------------------------------------------
// Observabilidade — Log Analytics + Application Insights
// ---------------------------------------------------------------------------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: nomes.logAnalytics
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
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
// Rede — VNet + 3 subnets + private DNS zones
// ---------------------------------------------------------------------------
resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: nomes.vnet
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: ['10.20.0.0/16'] }
    subnets: [
      {
        // Container Apps Environment — precisa de /23 dedicado.
        name: 'subnet-cae'
        properties: { addressPrefix: '10.20.0.0/23' }
      }
      {
        // PostgreSQL Flexible — subnet delegada.
        name: 'subnet-db'
        properties: {
          addressPrefix: '10.20.2.0/24'
          delegations: [
            {
              name: 'pgflex'
              properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' }
            }
          ]
        }
      }
      {
        // Private endpoints (Redis, Storage, Key Vault).
        name: 'subnet-pe'
        properties: {
          addressPrefix: '10.20.3.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource subnetCae 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  parent: vnet
  name: 'subnet-cae'
}
resource subnetDb 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  parent: vnet
  name: 'subnet-db'
}
resource subnetPe 'Microsoft.Network/virtualNetworks/subnets@2023-11-01' existing = {
  parent: vnet
  name: 'subnet-pe'
}

// Private DNS zones.
var dnsZonesPe = [
  'privatelink.redis.cache.windows.net'
  'privatelink.blob.core.windows.net'
  'privatelink.vaultcore.azure.net'
]

resource pgDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'private.postgres.database.azure.com'
  location: 'global'
  tags: tags
}
resource pgDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: pgDnsZone
  name: 'link-vnet'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

resource peDnsZones 'Microsoft.Network/privateDnsZones@2020-06-01' = [
  for z in dnsZonesPe: {
    name: z
    location: 'global'
    tags: tags
  }
]
resource peDnsLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [
  for (z, i) in dnsZonesPe: {
    name: '${z}/link-vnet'
    location: 'global'
    properties: {
      registrationEnabled: false
      virtualNetwork: { id: vnet.id }
    }
    dependsOn: [peDnsZones]
  }
]

// ---------------------------------------------------------------------------
// PostgreSQL Flexible Server — HA zone-redundant (instrucao_azure.md seção 5)
// ---------------------------------------------------------------------------
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: nomes.postgres
  location: location
  tags: tags
  sku: { name: 'Standard_D2ds_v4', tier: 'GeneralPurpose' }
  properties: {
    version: '16'
    administratorLogin: 'tcadmin'
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 128, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 35, geoRedundantBackup: 'Enabled' }
    highAvailability: { mode: 'ZoneRedundant' }
    network: {
      delegatedSubnetResourceId: subnetDb.id
      privateDnsZoneArmResourceId: pgDnsZone.id
    }
  }
  dependsOn: [pgDnsLink]
}

resource postgresDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: dbName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource pgbouncer 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgres
  name: 'pgbouncer.enabled'
  properties: { value: 'true', source: 'user-override' }
}
resource pgPreload 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgres
  name: 'shared_preload_libraries'
  properties: { value: 'pg_stat_statements,pgaudit', source: 'user-override' }
  dependsOn: [pgbouncer]
}

// ---------------------------------------------------------------------------
// Redis — Standard C1, noeviction (CRÍTICO para BullMQ)
// ---------------------------------------------------------------------------
resource redis 'Microsoft.Cache/redis@2024-03-01' = {
  name: nomes.redis
  location: location
  tags: tags
  properties: {
    sku: { name: 'Standard', family: 'C', capacity: 1 }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
    redisConfiguration: { 'maxmemory-policy': 'noeviction' }
  }
}

resource redisPe 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'pe-${nomes.redis}'
  location: location
  tags: tags
  properties: {
    subnet: { id: subnetPe.id }
    privateLinkServiceConnections: [
      {
        name: 'redis'
        properties: {
          privateLinkServiceId: redis.id
          groupIds: ['redisCache']
        }
      }
    ]
  }
}
resource redisPeDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: redisPe
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'redis'
        properties: { privateDnsZoneId: peDnsZones[0].id }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Storage Account — GRS, soft delete 14d, private endpoint
// ---------------------------------------------------------------------------
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: nomes.storage
  location: location
  tags: tags
  sku: { name: 'Standard_GRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Disabled'
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
resource storagePe 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'pe-${nomes.storage}'
  location: location
  tags: tags
  properties: {
    subnet: { id: subnetPe.id }
    privateLinkServiceConnections: [
      {
        name: 'blob'
        properties: {
          privateLinkServiceId: storage.id
          groupIds: ['blob']
        }
      }
    ]
  }
}
resource storagePeDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: storagePe
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'blob'
        properties: { privateDnsZoneId: peDnsZones[1].id }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Azure Container Registry — COMPARTILHADO entre ambientes (naming sem
// sufixo de ambiente; nome de ACR é globalmente único). O registro
// `acrtotalcampanha01` JÁ EXISTE em rg-totalcampanha-dev desde o deploy dev
// de 06/2026 — este template NÃO o cria; referencia o existente e concede
// AcrPull via módulo no RG dele.
// ---------------------------------------------------------------------------
@description('Resource group onde o ACR compartilhado já existe.')
param acrResourceGroup string = 'rg-totalcampanha-dev'

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: nomes.acr
  scope: resourceGroup(acrResourceGroup)
}

// ---------------------------------------------------------------------------
// Key Vault — soft delete 90d + purge protection + private endpoint
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
    publicNetworkAccess: 'Disabled'
  }
}
resource kvPe 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'pe-${nomes.keyVault}'
  location: location
  tags: tags
  properties: {
    subnet: { id: subnetPe.id }
    privateLinkServiceConnections: [
      {
        name: 'vault'
        properties: {
          privateLinkServiceId: keyVault.id
          groupIds: ['vault']
        }
      }
    ]
  }
}
resource kvPeDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: kvPe
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'vault'
        properties: { privateDnsZoneId: peDnsZones[2].id }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Container Apps Environment — VNet integrado, zone-redundant
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
    vnetConfiguration: {
      infrastructureSubnetId: subnetCae.id
      internal: false
    }
    zoneRedundant: true
  }
}

// ---------------------------------------------------------------------------
// Container Apps — api, web, worker.
//
// Criados com a imagem quickstart da Microsoft. Os workflows de deploy
// (deploy-*.yml) trocam para a imagem real via `az containerapp update`.
// Env vars e secrets são configurados pós-infra (instrucao_deploys.md Passo 4/9).
// min-replicas = 1 SEMPRE (lição L04 — nunca scale-to-zero em PROD).
// ---------------------------------------------------------------------------
var quickstartImage = 'mcr.microsoft.com/k8se/quickstart:latest'

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
          {
            name: 'api.${baseDomain}'
            bindingType: 'SniEnabled'
          }
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
          resources: { cpu: 1, memory: '2Gi' }
          // Probes apontam para a app real (instrucao_azure.md seção 5). Com a
          // imagem quickstart inicial elas falham — esperado; a 1ª revision
          // saudável é a do deploy real via workflow.
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
        minReplicas: 1
        maxReplicas: 8
        rules: [
          {
            name: 'http'
            http: { metadata: { concurrentRequests: '50' } }
          }
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
          resources: { cpu: 1, memory: '2Gi' }
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
        minReplicas: 1
        maxReplicas: 8
        rules: [
          {
            name: 'http'
            http: { metadata: { concurrentRequests: '80' } }
          }
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
      // Worker não tem ingress (não expõe HTTP).
      registries: [
        { server: '${nomes.acr}.azurecr.io', identity: 'system' }
      ]
    }
    template: {
      containers: [
        {
          name: 'tc-worker'
          image: quickstartImage
          resources: { cpu: 1, memory: '2Gi' }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
        // KEDA Redis scaler — configurado via az containerapp update após
        // o worker ter o secret redis-password (instrucao_azure.md seção 5).
      }
    }
  }
}

// ---------------------------------------------------------------------------
// RBAC — identidade de cada Container App lê ACR (pull) e Key Vault (secrets)
// ---------------------------------------------------------------------------
// IDs públicos de role definitions built-in do Azure (constantes documentadas
// pela Microsoft — NÃO são segredos).
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User

// Itera sobre nomes ESTÁTICOS (length conhecido no início) e indexa os
// principalIds de runtime no corpo — evita BCP178 (coleção de for não pode
// depender de valores de runtime como appApi.identity.principalId).
var appNames = ['api', 'web', 'worker']
var appPrincipals = [
  appApi.identity.principalId
  appWeb.identity.principalId
  appWorker.identity.principalId
]

// AcrPull no RG do ACR compartilhado (cross-RG exige module com scope lá).
module acrPull 'modules/acr-pull.bicep' = {
  name: 'acr-pull-${environment}'
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
// Budget — alerta 80%, freeze 100% (RULES 6.4 / instrucao_azure.md seção 7.3)
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
// Alertas de métrica + Action Group (instrucao_azure.md seção 10)
// ---------------------------------------------------------------------------
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-totalcampanha-${environment}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'tc-${environment}'
    enabled: true
    emailReceivers: [
      {
        name: 'operacao'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// Erros 5xx na API (App Insights requests/failed) > 5 em 5 min.
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

// PostgreSQL CPU > 80% por 15 min.
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

// Redis memória > 90% (noeviction: estouro de memória = jobs BullMQ travando).
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
// Outputs — usados nos passos manuais de DNS + Key Vault (instrucao_deploys.md)
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
