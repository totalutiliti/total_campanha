// Concede AcrPull às identidades dos Container Apps num ACR que vive em OUTRO
// resource group (o ACR acrtotalcampanha01 é compartilhado dev/prod por design
// — naming sem ambiente, instrucao_azure.md seção 1). Deployado pelo main.bicep
// com scope no RG do ACR.

param acrName string

@description('Identidades (principalId) dos Container Apps que fazem pull.')
param principalIds array

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull (built-in)

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: acrName
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (principalId, i) in principalIds: {
    name: guid(acr.id, principalId, 'acrpull')
    scope: acr
    properties: {
      roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
      principalId: principalId
      principalType: 'ServicePrincipal'
    }
  }
]

output acrLoginServer string = acr.properties.loginServer
