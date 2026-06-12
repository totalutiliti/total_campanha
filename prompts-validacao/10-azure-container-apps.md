# ☁️ 10 — Azure Container Apps

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto roda em Azure Container Apps?
  → SIM → Aplicar INTEGRALMENTE.
  → NÃO → Pular (se for App Service, VM ou outro: adaptar conceitos).
```

---

## 📋 CONTEÚDO

### 1. Ingress — HTTPS Only `[UNIVERSAL]`

```bash
az containerapp ingress update --name APP --resource-group RG \
  --transport https --allow-insecure false

# Custom domain + certificado SSL (produção)
az containerapp hostname add --name APP --resource-group RG \
  --hostname app.dominio.com.br
az containerapp ssl upload --name APP --resource-group RG \
  --hostname app.dominio.com.br --certificate-file cert.pfx
```

### 2. CORS Restrito `[UNIVERSAL]`

```bash
# NUNCA usar origin="*" em produção
az containerapp ingress cors update --name APP --resource-group RG \
  --allowed-origins "https://app.dominio.com.br" \
  --allowed-methods "GET,POST,PUT,DELETE,OPTIONS" \
  --allowed-headers "Authorization,Content-Type" \
  --max-age 3600
```

### 3. Managed Identity `[UNIVERSAL]`

```bash
# Habilitar (se não habilitado)
az containerapp identity assign --name APP --resource-group RG --system-assigned

# Usar para acessar: Key Vault, PostgreSQL, Blob, OpenAI, ACR
# Ver prompt 01 para detalhes de cada serviço
```

### 4. Secrets via Key Vault Reference `[UNIVERSAL]`

```bash
# Mapear segredo do Key Vault → Container App → env var
az containerapp secret set --name APP --resource-group RG \
  --secrets "meu-segredo=keyvaultref:https://kv-PROJ.vault.azure.net/secrets/NOME,identityref:system"

az containerapp update --name APP --resource-group RG \
  --set-env-vars "MINHA_VAR=secretref:meu-segredo"
```

### 5. Health Probes `[UNIVERSAL]`

```bash
# Liveness (app está viva?) + Readiness (app aceita tráfego?)
az containerapp update --name APP --resource-group RG \
  --container-name APP \
  --set-env-vars "PORT=3000" \
  # Configurar via YAML ou portal:
  # livenessProbe: /health, port 3000, period 30s
  # readinessProbe: /health, port 3000, period 10s
```

### 6. Scale-to-Zero e Limites `[UNIVERSAL]`

```bash
# Padrão TotalUtiliti: scale-to-zero em dev, min=1 em prod
# Dev:
az containerapp update --name APP --resource-group RG \
  --min-replicas 0 --max-replicas 3 \
  --cpu 0.5 --memory 1Gi

# Prod:
az containerapp update --name APP --resource-group RG \
  --min-replicas 1 --max-replicas 10 \
  --cpu 1 --memory 2Gi
```

### 7. Checklist

```
  □ HTTPS only (allow-insecure: false)
  □ CORS com origens explícitas (nunca *)
  □ Managed Identity habilitada
  □ Segredos via Key Vault reference (não env vars literais)
  □ Health probes configurados (liveness + readiness)
  □ Resource limits definidos (CPU + RAM)
  □ Scale-to-zero em dev, min=1 em prod
  □ Custom domain + SSL em produção
  □ ACR pull via Managed Identity (não admin credentials)
  □ Revisões habilitadas para rollback
```

````markdown
## Container Apps — Regras para Antigravity

- NUNCA colocar segredos como env var literal no deploy script
- SEMPRE usar Key Vault reference para segredos
- HTTPS only, CORS restrito, Managed Identity habilitada
- Health endpoint /health OBRIGATÓRIO em todo projeto
- Deploy sequence: migrate DB first → build/push → update container
````

---

> **Próximo prompt:** `11-ci-cd-e-deploy-seguro.md`
