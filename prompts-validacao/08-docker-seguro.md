# 🐳 08 — Docker Seguro

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto usa Docker (Dockerfile, docker-compose)?
  → SIM → Aplicar INTEGRALMENTE.
  → NÃO → Pular este prompt.
```

---

## 📋 CONTEÚDO

### 1. Dockerfile Multi-stage (Padrão TotalUtiliti) `[UNIVERSAL]`

```dockerfile
# ============================================================
# PADRÃO TOTALUTILITI — Multi-stage, non-root, slim
# ============================================================

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app

# Non-root user (OBRIGATÓRIO)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Apenas o necessário
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Nunca rodar como root
USER appuser
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 2. Regras absolutas `[UNIVERSAL]`

```
  ❌ NUNCA rodar como root em produção (USER appuser)
  ❌ NUNCA copiar .env no Dockerfile
  ❌ NUNCA usar ARG/ENV para passar segredos no build
  ❌ NUNCA usar imagem :latest (pinar versão: node:20-alpine)
  ❌ NUNCA instalar ferramentas desnecessárias (curl, vim, etc.)
  ✅ SEMPRE multi-stage build (build ≠ runtime)
  ✅ SEMPRE .dockerignore excluindo .env, .git, node_modules
  ✅ SEMPRE health check no Dockerfile
  ✅ SEMPRE imagem slim/alpine como base de produção
```

### 3. .dockerignore (ver prompt 02 para template completo)

```dockerignore
.env
.env.*
*.pem
*.key
.git
node_modules
dist
coverage
Dockerfile*
docker-compose*
.dockerignore
*.md
```

### 4. docker-compose.yml — Sem segredos `[UNIVERSAL]`

```yaml
# ❌ ERRADO — senhas hardcoded
environment:
  DATABASE_URL: "postgresql://admin:senha123@db:5432/app"

# ✅ CORRETO — referência a .env
environment:
  DATABASE_URL: ${DATABASE_URL}
# ou
env_file:
  - .env
```

### 5. Scan de vulnerabilidades `[UNIVERSAL]`

```bash
# Scan da imagem com Trivy (rodar antes de push para ACR)
trivy image --severity HIGH,CRITICAL minha-imagem:latest

# No CI, bloquear se encontrar vulnerabilidades CRITICAL
trivy image --exit-code 1 --severity CRITICAL minha-imagem:latest
```

### 6. Checklist

```
  □ Multi-stage build (stage de build ≠ stage de runtime)
  □ Imagem base pinada com versão (node:20-alpine, não :latest)
  □ Non-root user (USER appuser)
  □ .dockerignore exclui .env, .git, node_modules, *.pem, *.key
  □ Nenhum segredo no Dockerfile (ARG, ENV, COPY de .env)
  □ Health check configurado
  □ docker-compose.yml sem senhas hardcoded
  □ Scan de vulnerabilidades (Trivy) antes de push
```

````markdown
## Docker — Regras para Antigravity

- SEMPRE multi-stage build: build com dependências completas, runtime mínimo
- SEMPRE non-root user no stage de produção
- NUNCA copiar .env para dentro da imagem
- NUNCA usar :latest — pinar versão exata
- Health check obrigatório em todo Dockerfile
- Se precisar instalar pacote no runtime: JUSTIFICAR e documentar
````

---

> **Próximo prompt:** `09-postgresql-hardening.md`
