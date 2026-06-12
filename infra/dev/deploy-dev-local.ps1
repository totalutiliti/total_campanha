# Deploy DEV (Azure) — build local + push + update dos 3 apps.
# Segue o runbook infra/dev/README.md: contexto limpo via `git archive HEAD`
# (sem node_modules/symlinks), tags :dev, az containerapp update com
# --revision-suffix para forçar nova revision.
#
# Uso:  pwsh infra/dev/deploy-dev-local.ps1 [-Apps api,worker,web] [-Suffix v9]
param(
  [string[]]$Apps = @('api', 'worker', 'web'),
  [string]$Suffix = (Get-Date -Format 'MMddHHmm')
)

$ErrorActionPreference = 'Stop'
$RG = 'rg-totalcampanha-dev'
$REG = 'acrtotalcampanha01'
$DOM = 'yellowbeach-5d39f3f8.brazilsouth.azurecontainerapps.io'

$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo

# 1) Contexto limpo a partir do HEAD do git (commite antes de deployar!).
$ctx = Join-Path $env:TEMP "tc-deploy-ctx-$Suffix"
if (Test-Path $ctx) { Remove-Item -Recurse -Force $ctx }
New-Item -ItemType Directory -Path $ctx | Out-Null
Write-Host "== Gerando contexto de build em $ctx (git archive HEAD)"
git archive HEAD | tar -x -C $ctx

# 2) Login no ACR.
az acr login -n $REG | Out-Null

# 3) Build + push por app.
if ($Apps -contains 'api') {
  Write-Host '== Build tc-api'
  docker build -f "$ctx/apps/api/Dockerfile" -t "$REG.azurecr.io/tc-api:dev" $ctx
  if ($LASTEXITCODE -ne 0) { throw 'build api falhou' }
  docker push "$REG.azurecr.io/tc-api:dev"
}
if ($Apps -contains 'worker') {
  Write-Host '== Build tc-worker'
  docker build -f "$ctx/apps/worker/Dockerfile" -t "$REG.azurecr.io/tc-worker:dev" $ctx
  if ($LASTEXITCODE -ne 0) { throw 'build worker falhou' }
  docker push "$REG.azurecr.io/tc-worker:dev"
}
if ($Apps -contains 'web') {
  Write-Host '== Build tc-web (NEXT_PUBLIC_* em build-arg)'
  docker build -f "$ctx/apps/web/Dockerfile" `
    --build-arg "NEXT_PUBLIC_API_URL=https://tc-api-dev.$DOM/api/v1" `
    --build-arg "NEXT_PUBLIC_APP_URL=https://tc-web-dev.$DOM" `
    -t "$REG.azurecr.io/tc-web:dev" $ctx
  if ($LASTEXITCODE -ne 0) { throw 'build web falhou' }
  docker push "$REG.azurecr.io/tc-web:dev"
}

# 4) Nova revision em cada app (mesma tag :dev → revision-suffix força rollout).
foreach ($app in $Apps) {
  $name = "tc-$app-dev"
  Write-Host "== az containerapp update $name (suffix $Suffix)"
  az containerapp update -n $name -g $RG `
    --image "$REG.azurecr.io/tc-${app}:dev" `
    --revision-suffix "r$Suffix" --query 'properties.provisioningState' -o tsv
}

# 5) Smoke rápido.
Write-Host '== Smoke'
$api = Invoke-WebRequest -UseBasicParsing -TimeoutSec 90 "https://tc-api-dev.$DOM/api/v1/health/ready"
Write-Host "api/health/ready -> $($api.StatusCode)"
$web = Invoke-WebRequest -UseBasicParsing -TimeoutSec 90 "https://tc-web-dev.$DOM/login"
Write-Host "web/login -> $($web.StatusCode)"

Remove-Item -Recurse -Force $ctx
Write-Host '== Deploy DEV concluído.'
