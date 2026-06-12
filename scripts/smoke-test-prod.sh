#!/bin/bash
# Smoke test pós-deploy (instrucao_deploys.md seção 7 + CLAUDE.md "Deploys").
# Falha em qualquer ponto → exit != 0 → pipeline aciona rollback.
#
# Credenciais (em ordem de preferência):
#   1. Env vars SMOKE_PASS / SUPER_PASS — recomendado no GitHub Actions
#      (GitHub Secrets), pois o Key Vault de PROD é private-endpoint-only e o
#      runner hosted NÃO o alcança.
#   2. Fallback: az keyvault (para execução manual de dentro da rede/VPN).
#
# Pré-requisitos: jq instalado; usuários de smoke criados (smoke@ com role
# ADMIN num tenant interno e superadmin-smoke@).
set -euo pipefail

API=${API:-https://api.totalcampanha.com.br}
WEB=${WEB:-https://app.totalcampanha.com.br}
OPTIN=${OPTIN:-https://app.totalcampanha.com.br}
KV=${KV:-kv-totalcampanha-prod01}
# Cria campanha de teste (rascunho) durante o smoke? 1 = sim (default).
SMOKE_CAMPANHA=${SMOKE_CAMPANHA:-1}

echo "=== Health checks ==="
curl -fs "$API/api/v1/health/live" > /dev/null && echo "OK api live"
curl -fs "$API/api/v1/health/ready" > /dev/null && echo "OK api ready"
curl -fs "$WEB" > /dev/null && echo "OK web up"
curl -fs "$OPTIN/p/opt-in/cardanstencar" > /dev/null && echo "OK opt-in up" || echo "AVISO opt-in (tenant pode não existir ainda)"

echo "=== Credenciais ==="
if [ -z "${SMOKE_PASS:-}" ]; then
  echo "SMOKE_PASS não setado — tentando Key Vault $KV (requer rede com acesso ao PE)..."
  SMOKE_PASS=$(az keyvault secret show --vault-name "$KV" --name smoke-test-password --query value -o tsv)
fi
if [ -z "${SUPER_PASS:-}" ]; then
  SUPER_PASS=$(az keyvault secret show --vault-name "$KV" --name superadmin-smoke-password --query value -o tsv)
fi

echo "=== Auth flow ==="
TOKEN=$(curl -fs -X POST "$API/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"smoke@totalcampanha.com.br\",\"senha\":\"$SMOKE_PASS\"}" \
  | jq -r .accessToken)
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && echo "OK login" || { echo "FALHA login"; exit 1; }

echo "=== Endpoints autenticados ==="
for path in /me /contatos /segmentos /templates /campanhas /billing/atual; do
  curl -fs "$API/api/v1$path" -H "Authorization: Bearer $TOKEN" > /dev/null \
    && echo "OK $path" || { echo "FALHA $path"; exit 1; }
done
# /conexoes/whatsapp pode legitimamente ser 404 (sem conexão) — aceita 200/404.
CW=$(curl -s -o /dev/null -w '%{http_code}' "$API/api/v1/conexoes/whatsapp" -H "Authorization: Bearer $TOKEN")
{ [ "$CW" = "200" ] || [ "$CW" = "404" ]; } && echo "OK /conexoes/whatsapp ($CW)" || { echo "FALHA /conexoes/whatsapp ($CW)"; exit 1; }

if [ "$SMOKE_CAMPANHA" = "1" ]; then
  echo "=== Campanha de teste (CLAUDE.md: criação de campanha test) ==="
  # Cria rascunho apontando para o 1º template e 1º segmento do tenant de
  # smoke, valida a estimativa e EXCLUI — nada é disparado.
  TPL=$(curl -fs "$API/api/v1/templates" -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id // empty')
  SEG=$(curl -fs "$API/api/v1/segmentos" -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id // empty')
  CANAL=$(curl -fs "$API/api/v1/templates" -H "Authorization: Bearer $TOKEN" | jq -r '.[0].canal // empty')
  if [ -n "$TPL" ] && [ -n "$SEG" ]; then
    CAMP=$(curl -fs -X POST "$API/api/v1/campanhas" \
      -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
      -d "{\"nome\":\"[SMOKE] pos-deploy $(date -u +%Y%m%d-%H%M)\",\"canal\":\"$CANAL\",\"templateId\":\"$TPL\",\"segmentoId\":\"$SEG\"}" \
      | jq -r .id)
    [ -n "$CAMP" ] && [ "$CAMP" != "null" ] && echo "OK campanha criada ($CAMP)" || { echo "FALHA criar campanha"; exit 1; }
    curl -fs -X POST "$API/api/v1/campanhas/$CAMP/calcular-estimativa" \
      -H "Authorization: Bearer $TOKEN" > /dev/null && echo "OK estimativa"
    curl -fs -X DELETE "$API/api/v1/campanhas/$CAMP" \
      -H "Authorization: Bearer $TOKEN" > /dev/null && echo "OK campanha de teste removida"
  else
    echo "AVISO: tenant de smoke sem template/segmento — pulei criação de campanha."
  fi
fi

echo "=== Super Admin (lição L08 — abas críticas não podem sumir) ==="
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
