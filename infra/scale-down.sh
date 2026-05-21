#!/bin/bash
# Volta PROD aos limites normais após a temporada de alta.
# Ver instrucao_azure.md seção 6.
set -euo pipefail

RG=rg-totalcampanha-prod

echo "Voltando aos limites normais..."

az containerapp update -g "$RG" -n tc-worker-prod \
  --max-replicas 10

az containerapp update -g "$RG" -n tc-api-prod \
  --max-replicas 8

az containerapp update -g "$RG" -n tc-web-prod \
  --max-replicas 8

echo "OK. Limites normais restaurados."
