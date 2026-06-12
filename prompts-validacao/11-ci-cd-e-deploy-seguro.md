# 🚀 11 — CI/CD e Deploy Seguro

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto tem pipeline de CI/CD ou processo de deploy?
  → SIM → Aplicar INTEGRALMENTE.
  → NÃO (deploy manual) → Aplicar seções de checklist manual.
```

---

## 📋 CONTEÚDO

### 1. Pipeline Seguro `[UNIVERSAL]`

```
PIPELINE MÍNIMO:
  1. Lint + type check
  2. Testes automatizados
  3. npm audit / pnpm audit (vulnerabilidades de dependências)
  4. gitleaks detect (scan de segredos)
  5. Build da imagem Docker
  6. Trivy scan na imagem (vulnerabilidades de container)
  7. Push para ACR
  8. Deploy para Container App (dev/staging)
  9. Health check pós-deploy
  10. Se staging OK → deploy para produção (com aprovação manual)
```

### 2. Segredos no CI `[UNIVERSAL]`

```
  ❌ NUNCA hardcodar segredos no workflow YAML
  ❌ NUNCA logar segredos no output do CI
  ✅ Usar GitHub Secrets ou Azure Key Vault
  ✅ Mascarar variáveis sensíveis nos logs
```

### 3. Deploy Sequence (Padrão TotalUtiliti) `[UNIVERSAL]`

```bash
# ORDEM CRÍTICA:
# 1. Migrate banco PRIMEIRO
pnpm run migration:run

# 2. Build e push da imagem
docker build -t acr.azurecr.io/app:$TAG .
docker push acr.azurecr.io/app:$TAG

# 3. Update Container App
az containerapp update --name APP --resource-group RG \
  --image acr.azurecr.io/app:$TAG

# 4. Verificar health
curl -f https://app-url/health || echo "DEPLOY FAILED"

# Se falhar → rollback para revisão anterior
az containerapp revision list --name APP --resource-group RG -o table
az containerapp update --name APP --resource-group RG \
  --image acr.azurecr.io/app:$TAG_ANTERIOR
```

### 4. Ambientes `[UNIVERSAL]`

```
DEV     → Deploy automático em push para branch dev
STAGING → Deploy automático em push para main (se tiver staging)
PROD    → Deploy com aprovação manual (GitHub Environment protection rules)
```

### 5. Checklist

```
  □ Pipeline inclui: lint, test, audit, gitleaks, build, trivy
  □ Segredos via GitHub Secrets ou Key Vault (nunca hardcoded)
  □ Deploy order: migrate → build → push → update → health check
  □ Rollback documentado e testado
  □ Aprovação manual para produção
  □ Health check pós-deploy automatizado
  □ Logs de deploy não contêm segredos
```

````markdown
## CI/CD — Regras para Antigravity

- NUNCA incluir segredos em scripts de deploy (.sh, .bat)
- Deploy order: migrate first → build → push → update container
- Se criar workflow GitHub Actions: incluir gitleaks + trivy scan
- Health check endpoint /health deve existir em todo projeto
````

---

> **Próximo prompt:** `12-api-security.md`
