# 🛡️ 02 — .gitignore e Proteção de Código-Fonte

> **Objetivo:** Garantir que nenhum segredo, credencial ou dado sensível
> seja commitado no repositório Git — nem agora, nem no histórico.
> **Aplica-se a:** Todos os projetos TotalUtiliti (NestJS + Next.js + Azure)
> **Última atualização:** 2026-03-15

---

## 📋 ÍNDICE

1. [Por que isso é crítico](#1-por-que-isso-é-crítico)
2. [.gitignore Padrão TotalUtiliti](#2-gitignore-padrão-totalutiliti)
3. [.dockerignore Padrão](#3-dockerignore-padrão)
4. [GitHub Push Protection](#4-github-push-protection)
5. [Gitleaks — Pre-commit Hook](#5-gitleaks-pre-commit-hook)
6. [Scan do Histórico Completo](#6-scan-do-histórico-completo)
7. [Limpeza de Segredos Vazados](#7-limpeza-de-segredos-vazados)
8. [Regras para Claude Code (Antigravity)](#8-regras-para-claude-code)
9. [Checklist de Validação](#9-checklist-de-validação)

---

## 1. Por que isso é crítico

```
Um segredo commitado no Git existe PARA SEMPRE — mesmo deletando o arquivo.
Git guarda histórico completo. Um `git log` ou clone do repo expõe tudo.

Cenário real (Total Ledger, 2026):
  → Debug script com Azure OpenAI key hardcoded
  → GitHub Push Protection BLOQUEOU o push
  → Segredo não chegou ao remote, mas ficou no histórico local
  → Necessário: rotacionar a key + limpar histórico

Se o Push Protection não estivesse habilitado, a key teria sido
indexada por bots em MINUTOS. Bots escaneiam repos públicos E privados
(funcionários com acesso, forks, mirrors).
```

**Dados do produto Total Ledger:** CPF, rendimentos, patrimônio, dependentes,
dados bancários. Um vazamento via Git = violação LGPD + multa + perda de clientes.

---

## 2. .gitignore Padrão TotalUtiliti

> **Regra:** Todo novo repositório da organização `totalutiliti` DEVE usar
> este .gitignore como base. Adicionar regras específicas do projeto abaixo
> da seção "Projeto-específico".

```gitignore
# ==============================================================
# .gitignore — Padrão TotalUtiliti
# Baseado em: NestJS + Next.js + PostgreSQL + Azure + Docker
# ==============================================================

# --------------------------------------------------------------
# 🔴 SEGREDOS — NUNCA COMMITAR (prioridade máxima)
# --------------------------------------------------------------

# Variáveis de ambiente com valores reais
.env
.env.*
!.env.example
!.env.template

# Chaves e certificados
*.pem
*.key
*.p12
*.pfx
*.crt
*.cer
*.jks
*.keystore

# Azure
*.publishsettings
azure.json
local.settings.json

# Tokens e credenciais
**/credentials.json
**/token.json
**/service-account*.json
**/*secret*.json
!package.json
!package-lock.json
!tsconfig.json
!nest-cli.json

# Arquivos de configuração local que podem conter segredos
.npmrc
.yarnrc
.pypirc

# --------------------------------------------------------------
# 📦 DEPENDÊNCIAS
# --------------------------------------------------------------

node_modules/
.pnp
.pnp.js
.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz

# Python (se usado em scripts auxiliares)
__pycache__/
*.py[cod]
*$py.class
venv/
.venv/
*.egg-info/

# --------------------------------------------------------------
# 🔨 BUILD E COMPILAÇÃO
# --------------------------------------------------------------

# NestJS
dist/
build/

# Next.js
.next/
out/

# TypeScript
*.tsbuildinfo

# Turbo
.turbo/

# --------------------------------------------------------------
# 🧪 TESTES E COBERTURA
# --------------------------------------------------------------

coverage/
.nyc_output/
test-results/
junit.xml
*.lcov

# --------------------------------------------------------------
# 🐳 DOCKER
# --------------------------------------------------------------

# Nunca commitar dados de volume
docker-volumes/
postgres-data/
redis-data/

# Docker Compose override (pode conter ports/configs locais)
docker-compose.override.yml

# --------------------------------------------------------------
# 💻 IDE E SISTEMA OPERACIONAL
# --------------------------------------------------------------

# VS Code (manter settings compartilháveis, ignorar pessoais)
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
!.vscode/launch.json
!.vscode/tasks.json

# JetBrains (WebStorm, IntelliJ)
.idea/

# macOS
.DS_Store
._*

# Windows
Thumbs.db
ehthumbs.db
Desktop.ini
nul

# Linux
*~

# --------------------------------------------------------------
# 📊 LOGS E DADOS TEMPORÁRIOS
# --------------------------------------------------------------

logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Dados temporários
tmp/
temp/
.tmp/
*.tmp
*.bak
*.swp

# Uploads locais (produção usa Blob Storage)
uploads/
!uploads/.gitkeep

# --------------------------------------------------------------
# 📄 DOCUMENTOS GERADOS
# --------------------------------------------------------------

# Relatórios gerados
reports/
*.generated.*

# Swagger/OpenAPI gerado
swagger-spec.json

# Prisma
prisma/*.db
prisma/*.db-journal

# --------------------------------------------------------------
# 🔒 SEGURANÇA — Ferramentas de scan
# --------------------------------------------------------------

# Relatórios de vulnerabilidade (podem conter detalhes sensíveis)
gitleaks-report.json
gitleaks-report.csv
snyk-report.json
trivy-results.json
audit-report.json

# --------------------------------------------------------------
# 🎯 PROJETO-ESPECÍFICO (adicionar regras do projeto abaixo)
# --------------------------------------------------------------

```

### 2.1 Validação do .gitignore

Após criar ou atualizar o `.gitignore`, valide que nenhum arquivo
sensível está sendo rastreado:

```bash
# Verificar se algum arquivo sensível está no tracking
git ls-files | grep -iE '\.env$|\.env\.|\.pem$|\.key$|secret|credential|token\.json'

# Se encontrar algum, remover do tracking (sem deletar o arquivo)
git rm --cached .env
git rm --cached caminho/para/arquivo-sensivel

# Commitar a remoção
git commit -m "chore: remove tracked sensitive files"

# IMPORTANTE: O arquivo ainda existe no HISTÓRICO
# Ver seção 7 para limpeza completa do histórico
```

### 2.2 Arquivos que PARECEM inofensivos mas podem conter segredos

```
⚠️ ATENÇÃO ESPECIAL — Revisar manualmente antes de commitar:

  docker-compose.yml        → Pode ter passwords em environment
  docker-compose.prod.yml   → Idem
  *.sql                     → Pode ter CREATE USER com senha
  *.sh / *.bat              → Pode ter export de variáveis com valores
  scripts/deploy*.sh        → Pode ter tokens de deploy
  terraform.tfvars          → Sempre tem segredos
  bicep/*.parameters.json   → Pode ter valores sensíveis
  *.ipynb                   → Jupyter notebooks podem ter outputs com tokens
  debug-*.ts / test-*.ts    → Scripts de debug frequentemente hardcodam valores
  seed.ts / seed.sql        → Seeds podem ter senhas de teste que viram produção
```

---

## 3. .dockerignore Padrão

> **Por que:** Sem `.dockerignore`, o `docker build` copia TUDO para o
> contexto de build — incluindo `.env`, `.git`, `node_modules`. Esses
> arquivos ficam nas camadas da imagem Docker e podem ser extraídos.

```dockerignore
# ==============================================================
# .dockerignore — Padrão TotalUtiliti
# TUDO que não é necessário para build deve estar aqui
# ==============================================================

# Segredos (CRÍTICO)
.env
.env.*
*.pem
*.key
*.p12
**/*secret*
**/credentials.json

# Git (contém histórico completo — NUNCA incluir na imagem)
.git
.gitignore
.gitattributes

# Dependências (serão instaladas no build)
node_modules
.pnp
.yarn/cache

# Build artifacts
dist
build
.next
out
coverage

# IDE
.vscode
.idea

# Docker (evitar recursão)
Dockerfile*
docker-compose*
.dockerignore

# Documentação
*.md
docs/
LICENSE
CHANGELOG

# OS
.DS_Store
Thumbs.db
nul

# Testes
test/
tests/
__tests__
*.spec.ts
*.test.ts
jest.config.*
```

### 3.1 Validação do .dockerignore

```bash
# Ver o que o Docker está copiando para o contexto de build
# (rodar na raiz do projeto, onde está o Dockerfile)
docker build --no-cache -f Dockerfile . 2>&1 | head -5
# Procure por "Sending build context to Docker daemon  XXXMB"
# Se for > 50MB para um projeto NestJS/Next.js, algo está errado

# Teste mais detalhado — listar arquivos que seriam incluídos:
# (requer rsync)
rsync -avn --exclude-from='.dockerignore' . /dev/null 2>&1 | grep -iE '\.env|\.key|\.pem|secret|credential'
# Se retornar qualquer coisa → CORRIGIR o .dockerignore
```

---

## 4. GitHub Push Protection

### 4.1 O que é

GitHub Push Protection escaneia automaticamente cada push em busca de
padrões conhecidos de segredos (API keys, connection strings, tokens).
Se detectar, **bloqueia o push antes de chegar ao remote**.

### 4.2 Habilitando (nível organização)

```
GitHub → Organização totalutiliti
  → Settings → Code security and analysis
    → Push protection → Enable
    → Secret scanning → Enable
    → Secret scanning alerts → Enable
```

### 4.3 Habilitando (nível repositório)

```
GitHub → Repositório
  → Settings → Code security and analysis
    → Push protection → Enable
```

### 4.4 Quando o Push Protection bloqueia

```bash
# Você verá algo assim:
# remote: Push protection blocked push
# remote: Secret type: Azure OpenAI API Key
# remote: Location: scripts/debug-ocr.ts:15

# O QUE FAZER:
# 1. ❌ NÃO usar --force ou bypass
# 2. Remover o segredo do código
# 3. Mover o segredo para Key Vault / .env
# 4. Rotacionar o segredo IMEDIATAMENTE
#    (mesmo que não tenha chegado ao remote, considere comprometido)
# 5. Limpar o histórico local (ver seção 7)
# 6. Tentar o push novamente
```

### 4.5 Alertas de Secret Scanning

Configurar notificações para receber alertas quando o GitHub detectar
segredos (mesmo em repos privados):

```
GitHub → Organização → Settings → Code security
  → Secret scanning → Notify: security-team@totalutiliti.com
```

---

## 5. Gitleaks — Pre-commit Hook

### 5.1 Instalação

```bash
# Windows (Git Bash + scoop)
scoop install gitleaks

# macOS
brew install gitleaks

# Linux
# Download do binário: https://github.com/gitleaks/gitleaks/releases
wget https://github.com/gitleaks/gitleaks/releases/download/v8.21.0/gitleaks_8.21.0_linux_x64.tar.gz
tar -xzf gitleaks_8.21.0_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/

# Verificar instalação
gitleaks version
```

### 5.2 Configuração do Pre-commit Hook

```bash
# Na raiz de CADA repositório:
mkdir -p .git/hooks

cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/bash
# ==============================================================
# Pre-commit hook — Gitleaks
# Bloqueia commits que contêm segredos
# ==============================================================

echo "🔍 Scanning for secrets..."

gitleaks protect --staged --verbose --redact

if [ $? -ne 0 ]; then
  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║  ❌ SEGREDO DETECTADO — COMMIT BLOQUEADO            ║"
  echo "║                                                      ║"
  echo "║  1. Remova o segredo do código                       ║"
  echo "║  2. Mova para Key Vault ou .env (no .gitignore)     ║"
  echo "║  3. Se já foi commitado antes, limpe o histórico     ║"
  echo "║  4. Rotacione o segredo por segurança                ║"
  echo "║                                                      ║"
  echo "║  Para ver detalhes: gitleaks protect --staged -v     ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
  exit 1
fi

echo "✅ Nenhum segredo detectado. Commit autorizado."
HOOK

chmod +x .git/hooks/pre-commit
```

### 5.3 Usando com Husky (projetos com pnpm/npm)

Se o projeto já usa Husky para lint, integre o gitleaks:

```bash
# No package.json ou .husky/pre-commit, ADICIONAR (não substituir):
npx husky add .husky/pre-commit "gitleaks protect --staged --verbose --redact"
```

```bash
# .husky/pre-commit final deve parecer com:
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Lint (existente)
npx lint-staged

# Security scan (NOVO — sempre por último)
gitleaks protect --staged --verbose --redact
```

### 5.4 Configuração `.gitleaks.toml`

Criar na raiz de cada repositório:

```toml
# ==============================================================
# .gitleaks.toml — Configuração Gitleaks para TotalUtiliti
# ==============================================================

title = "TotalUtiliti Gitleaks Config"

[extend]
useDefault = true  # Usar todas as regras padrão do gitleaks

# --------------------------------------------------------------
# Allowlist global — Arquivos que PODEM conter padrões falso-positivos
# --------------------------------------------------------------
[allowlist]
description = "Arquivos seguros que podem gerar falso-positivo"
paths = [
  '''\.env\.example$''',
  '''\.env\.template$''',
  '''\.gitleaks\.toml$''',
  '''package-lock\.json$''',
  '''pnpm-lock\.yaml$''',
  '''yarn\.lock$''',
  '''CHANGELOG\.md$''',
  '''prompts-validacao/.*\.md$''',
]

# Para permitir um commit específico (usar com MUITA cautela):
# commits = ["commit-sha-aqui"]

# --------------------------------------------------------------
# Regras customizadas para padrões Azure
# --------------------------------------------------------------

[[rules]]
id = "azure-storage-connection-string"
description = "Azure Storage Connection String"
regex = '''DefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{44,}'''
tags = ["azure", "storage", "critical"]

[[rules]]
id = "azure-sql-connection-string"
description = "Azure SQL/PostgreSQL Connection String com senha"
regex = '''(?i)(Server|Host)=[^;]+;.*(Password|Pwd)=[^;]+'''
tags = ["azure", "database", "critical"]

[[rules]]
id = "azure-openai-key"
description = "Azure OpenAI API Key"
regex = '''(?i)(AZURE_OPENAI_API_KEY|api[_-]?key)\s*[:=]\s*["']?[a-f0-9]{32,}["']?'''
tags = ["azure", "openai", "critical"]

[[rules]]
id = "jwt-secret-hardcoded"
description = "JWT Secret hardcoded"
regex = '''(?i)(jwt[_-]?secret|JWT_SECRET)\s*[:=]\s*["'][^"']{8,}["']'''
tags = ["auth", "critical"]

[[rules]]
id = "argon2-pepper-hardcoded"
description = "AUTH_PEPPER hardcoded"
regex = '''(?i)(AUTH_PEPPER|pepper)\s*[:=]\s*["'][^"']{8,}["']'''
tags = ["auth", "critical"]

[[rules]]
id = "brazilian-cpf"
description = "CPF brasileiro (dado pessoal sensível)"
regex = '''\d{3}\.\d{3}\.\d{3}-\d{2}'''
tags = ["lgpd", "pii", "warning"]
[rules.allowlist]
paths = [
  '''.*\.test\.ts$''',
  '''.*\.spec\.ts$''',
  '''.*\.md$''',
]

[[rules]]
id = "brazilian-cnpj"
description = "CNPJ brasileiro"
regex = '''\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}'''
tags = ["lgpd", "pii", "warning"]
[rules.allowlist]
paths = [
  '''.*\.test\.ts$''',
  '''.*\.spec\.ts$''',
  '''.*\.md$''',
]
```

### 5.5 IMPORTANTE: `--no-verify`

```bash
# --no-verify PULA o pre-commit hook (incluindo gitleaks)
# Usar APENAS para bypass de lint, NUNCA para bypass de segurança

# ❌ PROIBIDO — Nunca usar para silenciar alertas de segredo
git commit --no-verify -m "feat: add debug script"

# ✅ ACEITÁVEL — Bypass de lint quando necessário (gitleaks rodará no CI)
git commit --no-verify -m "wip: draft em andamento"
# MAS: o CI pipeline DEVE rodar gitleaks como segunda barreira
```

---

## 6. Scan do Histórico Completo

> **Quando rodar:** Antes de cada deploy para produção, mensalmente,
> e sempre que um novo colaborador entrar no projeto.

### 6.1 Scan completo

```bash
# Scan de todo o histórico do repositório
gitleaks detect \
  --source . \
  --verbose \
  --redact \
  --report-format json \
  --report-path gitleaks-report.json

# Ver resultados resumidos
echo "=== RESULTADOS ==="
cat gitleaks-report.json | python3 -m json.tool | grep -E '"Description"|"File"|"StartLine"'

# Se encontrar algo:
# 1. ROTACIONAR o segredo IMEDIATAMENTE (ele já foi exposto)
# 2. Limpar o histórico (ver seção 7)
# 3. Documentar o incidente
```

### 6.2 Scan de todos os repos da organização

```bash
#!/bin/bash
# ==============================================================
# scan-all-repos.sh
# Escaneia todos os repos locais da TotalUtiliti
# Rodar mensalmente como parte da revisão de segurança
# ==============================================================

PROJETOS_DIR="D:/0000_totalutiliti/projetos"
REPORT_DIR="$HOME/gitleaks-reports/$(date +%Y-%m-%d)"
mkdir -p "$REPORT_DIR"

TOTAL_FINDINGS=0

for repo in "$PROJETOS_DIR"/*/projeto; do
  if [ -d "$repo/.git" ]; then
    REPO_NAME=$(basename "$(dirname "$repo")")
    echo "🔍 Scanning: $REPO_NAME"

    gitleaks detect \
      --source "$repo" \
      --redact \
      --report-format json \
      --report-path "$REPORT_DIR/$REPO_NAME.json" \
      2>/dev/null

    FINDINGS=$(cat "$REPORT_DIR/$REPO_NAME.json" 2>/dev/null | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
    TOTAL_FINDINGS=$((TOTAL_FINDINGS + FINDINGS))

    if [ "$FINDINGS" -gt 0 ]; then
      echo "  ❌ $FINDINGS segredos encontrados!"
    else
      echo "  ✅ Limpo"
      rm -f "$REPORT_DIR/$REPO_NAME.json"  # Remover relatório vazio
    fi
  fi
done

echo ""
echo "========================================"
echo "Total de segredos encontrados: $TOTAL_FINDINGS"
echo "Relatórios em: $REPORT_DIR"
echo "========================================"

if [ "$TOTAL_FINDINGS" -gt 0 ]; then
  echo "⚠️  AÇÃO NECESSÁRIA: Rotacionar segredos e limpar histórico"
  exit 1
fi
```

---

## 7. Limpeza de Segredos Vazados

> **REGRA #1:** Antes de limpar o histórico, ROTACIONE o segredo.
> A limpeza do Git não garante que ninguém já viu/copiou o valor.

### 7.1 Fluxo completo de resposta

```
1. DETECTOU segredo no histórico
   ↓
2. ROTACIONAR o segredo IMEDIATAMENTE
   - Gerar novo valor
   - Atualizar no Key Vault
   - Deploy com novo valor
   - Invalidar o valor antigo
   ↓
3. LIMPAR o histórico do Git (seção 7.2 ou 7.3)
   ↓
4. FORCE PUSH para o remote
   - Coordenar com time (aviso prévio)
   - Todos devem re-clonar ou git pull --rebase
   ↓
5. DOCUMENTAR o incidente
   - O que vazou, quando, como foi detectado
   - Ações tomadas
   - Prevenção futura
```

### 7.2 BFG Repo Cleaner (Recomendado — mais rápido e seguro)

```bash
# Instalar BFG
# Download: https://rtyley.github.io/bfg-repo-cleaner/
# Requer Java

# Opção A: Remover arquivo específico de todo o histórico
bfg --delete-files .env repo.git
bfg --delete-files debug-ocr.ts repo.git

# Opção B: Substituir texto (segredo) em todo o histórico
echo "chave-que-vazou-abc123" > passwords.txt
bfg --replace-text passwords.txt repo.git

# Após BFG:
cd repo.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (CUIDADO — coordenar com time)
git push --force --all
git push --force --tags
```

### 7.3 git filter-repo (Alternativa — nativo, sem Java)

```bash
# Instalar
pip install git-filter-repo --break-system-packages

# Remover arquivo de todo o histórico
git filter-repo --invert-paths --path caminho/para/arquivo-com-segredo

# Substituir texto em todo o histórico
git filter-repo --replace-text <(echo "texto-segredo==>***REDACTED***")

# Force push
git push --force --all
```

### 7.4 git filter-branch (Legado — usar apenas se os outros não funcionarem)

```bash
# Remover arquivo de todo o histórico
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch caminho/para/arquivo" \
  --prune-empty -- --all

# Limpar refs
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push --force --all
```

---

## 8. Regras para Claude Code (Antigravity)

> Cole este bloco no prompt ao iniciar sessões de implementação.

````markdown
## Proteção de Código-Fonte — Regras para Antigravity

### .gitignore
- Todo novo projeto DEVE ter .gitignore antes do primeiro commit
- Usar o template padrão TotalUtiliti (ver 02-gitignore-e-protecao-codigo.md)
- NUNCA remover regras de segurança do .gitignore
- Se precisar commitar algo que está no .gitignore, PERGUNTAR primeiro

### Segredos no código
- NUNCA hardcodar segredos, API keys, passwords, connection strings
- Nem "temporariamente", nem em comentários, nem em scripts de debug
- Usar `process.env.VARIAVEL` para tudo
- Se um valor parece ser segredo, tratar como segredo

### Arquivos sensíveis
- NUNCA criar arquivos .env com valores reais
- .env.example com placeholders descritivos é OK
- NUNCA commitar *.pem, *.key, credentials.json, token.json
- Scripts .sql com CREATE USER/ROLE devem usar placeholders

### Docker
- NUNCA copiar .env no Dockerfile (nem com COPY . .)
- Verificar que .dockerignore existe e exclui segredos
- NUNCA usar ARG ou ENV no Dockerfile para passar segredos

### Commits
- Se acidentalmente incluir segredo em um commit, PARAR IMEDIATAMENTE
- Avisar o João antes de tentar corrigir
- NÃO usar --no-verify para contornar alertas de segurança do gitleaks
- --no-verify é aceito apenas para bypass de lint

### Padrão Windows
- Sempre adicionar `nul` ao .gitignore (Windows reserved filename)
- Executar `rm -f nul` se o arquivo fantasma aparecer
````

---

## 9. Checklist de Validação

### Antes do primeiro commit de um novo projeto:

```
□ .gitignore criado com template padrão TotalUtiliti
□ .dockerignore criado com template padrão
□ .env.example criado com placeholders (sem valores reais)
□ .env real está no .gitignore (verificar com git status)
□ Nenhum arquivo *.pem, *.key, credentials.json no tracking
□ Pre-commit hook do gitleaks instalado
□ .gitleaks.toml criado na raiz do repo
□ `nul` no .gitignore (Windows)
```

### Antes de cada deploy para produção:

```
□ Rodar: gitleaks detect --source . --verbose
□ Zero findings no scan completo do histórico
□ Nenhum docker-compose*.yml contém senhas literais
□ Nenhum script .sh/.bat contém tokens/keys
□ Nenhum seed.sql/seed.ts contém senhas reais
□ GitHub Push Protection habilitado no repo
□ GitHub Secret Scanning habilitado no repo
```

### Revisão mensal (todos os repos):

```
□ Rodar scan-all-repos.sh em todos os projetos
□ Verificar alertas do GitHub Secret Scanning
□ Revisar novos colaboradores — todos têm gitleaks instalado?
□ Verificar que nenhum novo .env foi commitado acidentalmente
□ Atualizar gitleaks para última versão
```

### Quando um segredo é detectado no histórico:

```
□ ROTACIONAR o segredo IMEDIATAMENTE (antes de limpar o Git)
□ Gerar novo valor e atualizar no Key Vault
□ Deploy com novo valor
□ Invalidar/revogar valor antigo
□ Limpar histórico Git (BFG ou filter-repo)
□ Force push coordenado com time
□ Todos re-clonam ou git pull --rebase
□ Documentar incidente (o quê, quando, como, ações tomadas)
□ Verificar se o segredo foi usado indevidamente (logs de acesso)
□ Atualizar regras do .gitleaks.toml se necessário
```

---

## 📝 Referências

- [Gitleaks — GitHub](https://github.com/gitleaks/gitleaks)
- [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-filter-repo](https://github.com/newren/git-filter-repo)
- [GitHub Push Protection docs](https://docs.github.com/en/code-security/secret-scanning/push-protection-for-repositories-and-organizations)
- [GitHub Secret Scanning docs](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
- [OWASP Source Code Leakage](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/05-Review_Webpage_Content_for_Information_Leakage)

---

> **Próximo prompt na sequência:** `03-lgpd-e-dados-fiscais.md`
> (Conformidade LGPD para dados de declaração de imposto de renda)
