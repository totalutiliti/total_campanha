#!/bin/bash
# Escala PROD para temporada de alta (Dia das Mães, Black Friday, Natal, etc).
# Ver instrucao_azure.md seção 6. Rodar ~7 dias antes da data comercial.
# Lembrar de rodar scale-down.sh depois.
set -euo pipefail

RG=rg-totalcampanha-prod

echo "Escalando para temporada de alta..."

az containerapp update -g "$RG" -n tc-worker-prod \
  --max-replicas 30

az containerapp update -g "$RG" -n tc-api-prod \
  --max-replicas 20

az containerapp update -g "$RG" -n tc-web-prod \
  --max-replicas 16

echo "OK. Limites elevados. NÃO esquecer de rodar scale-down.sh após a data."
