#!/bin/bash
# Smoke test pós-deploy (instrucao_deploys.md seção 7).
# Falha em qualquer ponto → exit != 0 → pipeline aciona rollback.
#
# Pré-requisitos: az CLI logado, jq instalado, usuários de smoke test criados
# (smoke@ e superadmin-smoke@) com senhas no Key Vault.
set -euo pipefail

API=${API:-https://api.totalcampanha.com.br}
WEB=${WEB:-https://app.totalcampanha.com.br}
OPTIN=${OPTIN:-https://opt-in.totalcampanha.com.br}
KV=${KV:-kv-totalcampanha-prod01}

echo "=== Health checks ==="
curl -fs "$API/api/v1/health/live" > /dev/null && echo "OK api live"
curl -fs "$API/api/v1/health/ready" > /dev/null && echo "OK api ready"
curl -fs "$WEB" > /dev/null && echo "OK web up"
curl -fs "$OPTIN/p/opt-in/cardanstencar" > /dev/null && echo "OK opt-in up" || echo "AVISO opt-in (tenant pode não existir ainda)"

echo "=== Auth flow ==="
SMOKE_PASS=$(az keyvault secret show --vault-name "$KV" --name smoke-test-password --query value -o tsv)
TOKEN=$(curl -fs -X POST "$API/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"smoke@totalcampanha.com.br\",\"senha\":\"$SMOKE_PASS\"}" \
  | jq -r .accessToken)
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && echo "OK login" || { echo "FALHA login"; exit 1; }

echo "=== Endpoints autenticados ==="
for path in /me /contatos /segmentos /templates /campanhas /conexoes/whatsapp; do
  curl -fs "$API/api/v1$path" -H "Authorization: Bearer $TOKEN" > /dev/null \
    && echo "OK $path" || { echo "FALHA $path"; exit 1; }
done

echo "=== Super Admin (lição L08 — abas críticas não podem sumir) ==="
SUPER_PASS=$(az keyvault secret show --vault-name "$KV" --name superadmin-smoke-password --query value -o tsv)
SUPER_TOKEN=$(curl -fs -X POST "$API/api/v1/admin/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"superadmin-smoke@totalcampanha.com.br\",\"senha\":\"$SUPER_PASS\"}" \
  | jq -r .accessToken)
[ -n "$SUPER_TOKEN" ] && [ "$SUPER_TOKEN" != "null" ] && echo "OK admin login" || { echo "FALHA admin login"; exit 1; }

for path in /admin/tenants /admin/usage /admin/usage/por-tenant /admin/audit; do
  curl -fs "$API/api/v1$path" -H "Authorization: Bearer $SUPER_TOKEN" > /dev/null \
    && echo "OK $path" || { echo "FALHA $path"; exit 1; }
done

echo ""
echo "=== Smoke test passou ==="
