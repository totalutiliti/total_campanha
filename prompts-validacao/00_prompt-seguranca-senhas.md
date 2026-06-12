# 🔐 PROMPT DE REFERÊNCIA — Gestão de Senhas e Segredos

> **Escopo:** Guia definitivo para todos os projetos TotalUtiliti.
> **Stack:** NestJS · Next.js · PostgreSQL · Azure Container Apps · Azure Key Vault · Docker
> **Autor:** João — TotalUtiliti Management Consultoria Ltda
> **Última atualização:** 2026-03-15

---

## 📋 ÍNDICE

1. [Princípios Fundamentais](#1-princípios-fundamentais)
2. [Senhas de Usuários (Hashing)](#2-senhas-de-usuários-hashing)
3. [Segredos da Aplicação (API Keys, Connection Strings)](#3-segredos-da-aplicação)
4. [Azure Key Vault — Configuração e Uso](#4-azure-key-vault)
5. [Managed Identity — Eliminando Senhas](#5-managed-identity)
6. [Migração: Connection String → Managed Identity](#6-migração-para-managed-identity)
7. [Variáveis de Ambiente — Padrões](#7-variáveis-de-ambiente)
8. [Git — Prevenção de Vazamentos](#8-git-prevenção-de-vazamentos)
9. [Rotação de Segredos](#9-rotação-de-segredos)
10. [Checklist por Projeto](#10-checklist-por-projeto)
11. [Prompt para Claude Code (Antigravity)](#11-prompt-para-claude-code)
12. [Referência Rápida de Comandos Azure CLI](#12-referência-rápida-azure-cli)

---

## 1. Princípios Fundamentais

```
REGRA DE OURO: Se um segredo pode ser eliminado, elimine-o.
Managed Identity > Key Vault > Env Var > Nunca hardcoded.
```

| Camada | O que protege | Como |
|--------|---------------|------|
| **Hashing** | Senhas de usuários no banco | Argon2id + pepper |
| **Key Vault** | Segredos da aplicação | Referência em runtime |
| **Managed Identity** | Autenticação entre serviços Azure | Zero segredos |
| **Git Protection** | Código-fonte | Pre-commit hooks + Push Protection |
| **RBAC** | Acesso a recursos | Deny-by-default, menor privilégio |
| **Rotação** | Segredos que existem | Automática, 30-90 dias |

---

## 2. Senhas de Usuários (Hashing)

### 2.1 Algoritmo: Argon2id + Pepper

```typescript
// ============================================================
// PADRÃO TOTALUTILITI — Hash de Senhas
// ============================================================
// Algoritmo: Argon2id (resistente a GPU + side-channel)
// Pepper: Segredo da aplicação, armazenado no Key Vault
// Salt: Gerado automaticamente pelo argon2 (único por senha)
// ============================================================

import * as argon2 from 'argon2';

// Pepper vem do Key Vault via env var — NUNCA hardcoded
const PEPPER = process.env.AUTH_PEPPER;

if (!PEPPER || PEPPER.length < 32) {
  throw new Error('AUTH_PEPPER ausente ou insuficiente. Verifique Key Vault.');
}

export async function hashPassword(plaintext: string): Promise<string> {
  const pepperedPassword = `${plaintext}${PEPPER}`;

  return argon2.hash(pepperedPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,    // 19 MiB (mínimo OWASP)
    timeCost: 2,          // 2 iterações
    parallelism: 1,       // 1 thread
    hashLength: 32,       // 256 bits
  });
}

export async function verifyPassword(
  plaintext: string,
  storedHash: string,
): Promise<boolean> {
  const pepperedPassword = `${plaintext}${PEPPER}`;
  return argon2.verify(storedHash, pepperedPassword);
}
```

### 2.2 Parâmetros OWASP (Ajustar conforme hardware)

| Parâmetro | Mínimo OWASP | Recomendado Produção | Notas |
|-----------|-------------|----------------------|-------|
| memoryCost | 19456 (19 MiB) | 65536 (64 MiB) | Mais = mais seguro, mas mais lento |
| timeCost | 2 | 3 | Iterações |
| parallelism | 1 | 1 | Manter 1 para Container Apps |
| hashLength | 32 | 32 | 256 bits é suficiente |

> **Benchmark:** O hash deve levar entre **200ms e 1000ms** no hardware de produção.
> Rode `npx argon2-bench` para calibrar.

### 2.3 Regras Absolutas

- ❌ NUNCA: MD5, SHA-1, SHA-256 puro, bcrypt com cost < 12
- ❌ NUNCA: Armazenar senha em texto plano, mesmo em logs
- ❌ NUNCA: Pepper hardcoded no código (vai pro Key Vault)
- ✅ SEMPRE: Salt único por senha (argon2 faz automaticamente)
- ✅ SEMPRE: Pepper no Key Vault, injetado via env var
- ✅ SEMPRE: Timing-safe comparison (argon2.verify já faz)

---

## 3. Segredos da Aplicação

### 3.1 Classificação de Segredos

| Tipo | Exemplos | Onde armazenar | Rotação |
|------|----------|---------------|---------|
| **Crítico** | DB password, AUTH_PEPPER, encryption keys | Key Vault | 30 dias |
| **Alto** | API keys (OpenAI, Azure), JWT secret | Key Vault | 90 dias |
| **Médio** | Webhook secrets, SMTP password | Key Vault | 90 dias |
| **Eliminar** | Azure service-to-service auth | Managed Identity | N/A |

### 3.2 O que NUNCA deve existir no código

```bash
# ❌ PROIBIDO — Estes padrões NUNCA devem aparecer em código-fonte:
DATABASE_URL="postgresql://user:password@host:5432/db"
AZURE_OPENAI_API_KEY="sk-..."
AUTH_PEPPER="meu-pepper-super-secreto"
JWT_SECRET="qualquer-coisa-aqui"

# ✅ CORRETO — Referência ao Key Vault:
DATABASE_URL=${KV_DATABASE_URL}
# Ou melhor ainda: Managed Identity (sem connection string)
```

---

## 4. Azure Key Vault

### 4.1 Nomenclatura Padrão TotalUtiliti

```
Formato: kv-{projeto}-{env}
Exemplos:
  kv-kegsafe-dev
  kv-kegsafe-prod
  kv-totalledger-dev
  kv-totalledger-prod
```

### 4.2 Nomenclatura de Segredos no Key Vault

```
Formato: {CATEGORIA}-{NOME}
Separador: - (hífen, não underscore — Key Vault não aceita _)

Exemplos:
  db-connection-string
  db-password
  auth-pepper
  auth-jwt-secret
  openai-api-key
  smtp-password
  webhook-secret-stripe
```

### 4.3 Criação via Azure CLI

```bash
# Criar Key Vault
az keyvault create \
  --name kv-kegsafe-dev \
  --resource-group rg-kegsafe-dev \
  --location brazilsouth \
  --sku standard \
  --enable-rbac-authorization true

# Adicionar segredo
az keyvault secret set \
  --vault-name kv-kegsafe-dev \
  --name auth-pepper \
  --value "$(openssl rand -base64 48)"

# Listar segredos
az keyvault secret list \
  --vault-name kv-kegsafe-dev \
  --query "[].{name:name, enabled:attributes.enabled}" \
  -o table
```

### 4.4 Acesso via Container Apps

```bash
# 1. Habilitar Managed Identity no Container App
az containerapp identity assign \
  --name kegsafe-backend-dev \
  --resource-group rg-kegsafe-dev \
  --system-assigned

# 2. Obter o principalId
PRINCIPAL_ID=$(az containerapp identity show \
  --name kegsafe-backend-dev \
  --resource-group rg-kegsafe-dev \
  --query principalId -o tsv)

# 3. Conceder acesso ao Key Vault (RBAC)
KV_ID=$(az keyvault show --name kv-kegsafe-dev --query id -o tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Key Vault Secrets User" \
  --scope $KV_ID

# 4. Configurar env var referenciando Key Vault
az containerapp secret set \
  --name kegsafe-backend-dev \
  --resource-group rg-kegsafe-dev \
  --secrets \
    "auth-pepper=keyvaultref:https://kv-kegsafe-dev.vault.azure.net/secrets/auth-pepper,identityref:system"

# 5. Mapear secret para env var
az containerapp update \
  --name kegsafe-backend-dev \
  --resource-group rg-kegsafe-dev \
  --set-env-vars \
    "AUTH_PEPPER=secretref:auth-pepper"
```

---

## 5. Managed Identity

### 5.1 Por que usar

```
COM connection string:
  App → "postgresql://user:SENHA@host/db" → PostgreSQL
  ❌ Senha existe, pode vazar, precisa rotacionar

COM Managed Identity:
  App → (token automático Azure AD) → PostgreSQL
  ✅ Sem senha, sem rotação, sem vazamento possível
```

### 5.2 Serviços Azure que suportam Managed Identity

| Serviço | Suporte | Notas |
|---------|---------|-------|
| **PostgreSQL Flexible Server** | ✅ | AAD authentication |
| **Blob Storage** | ✅ | Via @azure/identity |
| **Key Vault** | ✅ | Via @azure/identity |
| **Azure OpenAI** | ✅ | Via @azure/identity |
| **Container Registry** | ✅ | Pull de imagens sem senha |
| **Service Bus** | ✅ | Via @azure/identity |
| **Redis Cache** | ✅ | AAD authentication |
| **Document Intelligence** | ✅ | Via @azure/identity |

### 5.3 Código NestJS com @azure/identity

```typescript
// ============================================================
// PADRÃO TOTALUTILITI — Azure Identity (Managed Identity)
// ============================================================
// Funciona tanto local (Azure CLI login) quanto em produção
// (Managed Identity automática no Container Apps)
// ============================================================

import { DefaultAzureCredential } from '@azure/identity';

// DefaultAzureCredential tenta, nesta ordem:
// 1. Environment variables (AZURE_CLIENT_ID, etc.)
// 2. Managed Identity (quando rodando no Azure)
// 3. Azure CLI (quando rodando local: `az login`)
// 4. VS Code / PowerShell / etc.

const credential = new DefaultAzureCredential();

// ----------------------------------------------------------
// Exemplo: Azure OpenAI SEM API key
// ----------------------------------------------------------
import { OpenAIClient } from '@azure/openai';

const openaiClient = new OpenAIClient(
  'https://openai-kegsafe-sc.openai.azure.com/',
  credential,  // ← Sem API key!
);

// ----------------------------------------------------------
// Exemplo: Blob Storage SEM connection string
// ----------------------------------------------------------
import { BlobServiceClient } from '@azure/storage-blob';

const blobClient = new BlobServiceClient(
  'https://stkegsafedev.blob.core.windows.net/',
  credential,  // ← Sem connection string!
);

// ----------------------------------------------------------
// Exemplo: Key Vault SEM client secret
// ----------------------------------------------------------
import { SecretClient } from '@azure/keyvault-secrets';

const kvClient = new SecretClient(
  'https://kv-kegsafe-dev.vault.azure.net/',
  credential,  // ← Sem client secret!
);

const pepper = await kvClient.getSecret('auth-pepper');
console.log(pepper.value); // O valor do segredo
```

---

## 6. Migração: Connection String → Managed Identity

### 6.1 PostgreSQL Flexible Server

```bash
# ============================================================
# PASSO A PASSO: Migrar PostgreSQL para AAD Authentication
# ============================================================

# 1. Habilitar AAD auth no PostgreSQL
az postgres flexible-server update \
  --name pg-kegsafe-dev \
  --resource-group rg-kegsafe-dev \
  --active-directory-auth Enabled \
  --password-auth Enabled  # Manter senha TEMPORARIAMENTE durante migração

# 2. Criar administrador AAD
az postgres flexible-server ad-admin create \
  --server-name pg-kegsafe-dev \
  --resource-group rg-kegsafe-dev \
  --display-name "kegsafe-backend-dev" \
  --object-id $PRINCIPAL_ID \
  --type ServicePrincipal

# 3. Obter token para conectar via psql (teste)
TOKEN=$(az account get-access-token \
  --resource-type oss-rdbms \
  --query accessToken -o tsv)

PGPASSWORD=$TOKEN psql \
  "host=pg-kegsafe-dev.postgres.database.azure.com \
   port=5432 \
   dbname=kegsafe \
   user=kegsafe-backend-dev \
   sslmode=require"

# 4. Após validar, desabilitar password auth
az postgres flexible-server update \
  --name pg-kegsafe-dev \
  --resource-group rg-kegsafe-dev \
  --password-auth Disabled
```

### 6.2 Código NestJS — PostgreSQL com Managed Identity

```typescript
// ============================================================
// TypeORM DataSource com Azure Managed Identity
// ============================================================

import { DefaultAzureCredential } from '@azure/identity';
import { DataSource } from 'typeorm';

async function createDataSource(): Promise<DataSource> {
  const credential = new DefaultAzureCredential();

  // Obter token para PostgreSQL
  const token = await credential.getToken(
    'https://ossrdbms-aad.database.windows.net/.default',
  );

  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST, // pg-kegsafe-dev.postgres.database.azure.com
    port: 5432,
    database: process.env.DB_NAME,
    username: process.env.DB_AAD_USER, // Nome da Managed Identity
    password: token.token,  // Token AAD em vez de senha fixa
    ssl: { rejectUnauthorized: true },
    extra: {
      // Renovar token antes de expirar (tokens AAD duram ~1h)
      connectionTimeoutMillis: 5000,
    },
  });
}

// ============================================================
// IMPORTANTE: Renovação de Token
// ============================================================
// Tokens AAD expiram em ~1 hora.
// Para produção, implementar renovação periódica:
//
// import { TokenRefreshHandler } from './token-refresh';
//
// @Injectable()
// export class DatabaseTokenRefreshService {
//   @Cron('0 */45 * * * *')  // A cada 45 minutos
//   async refreshToken() {
//     const credential = new DefaultAzureCredential();
//     const token = await credential.getToken(
//       'https://ossrdbms-aad.database.windows.net/.default',
//     );
//     // Atualizar pool de conexões com novo token
//   }
// }
```

### 6.3 Azure OpenAI — Migração

```bash
# ANTES (com API key):
AZURE_OPENAI_API_KEY="abc123..."  # ❌ Segredo que pode vazar

# DEPOIS (com Managed Identity):
# 1. Atribuir role ao Container App
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Cognitive Services OpenAI User" \
  --scope "/subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{openai-name}"

# 2. No código, usar DefaultAzureCredential (ver seção 5.3)
# 3. Remover AZURE_OPENAI_API_KEY das env vars
```

### 6.4 Blob Storage — Migração

```bash
# ANTES:
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=..."  # ❌

# DEPOIS:
# 1. Atribuir role
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{storage-name}"

# 2. No código, usar DefaultAzureCredential (ver seção 5.3)
# 3. Remover connection string
```

---

## 7. Variáveis de Ambiente

### 7.1 Estrutura de Arquivos

```
projeto/
├── .env.example          # ✅ Vai pro Git (placeholders)
├── .env                  # ❌ NO .gitignore (valores reais locais)
├── .env.dev              # ❌ NO .gitignore
├── .env.prod             # ❌ NO .gitignore
└── .gitignore            # Deve conter: .env*  !.env.example
```

### 7.2 Template `.env.example`

```bash
# ============================================================
# .env.example — Template de Variáveis de Ambiente
# Copie para .env e preencha com valores reais
# NUNCA commite o .env real
# ============================================================

# ---- Banco de Dados ----
# Opção 1: Connection string (desenvolvimento local)
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DBNAME"
# Opção 2: Managed Identity (produção — sem senha)
DB_HOST="pg-PROJETO-ENV.postgres.database.azure.com"
DB_NAME="DBNAME"
DB_AAD_USER="CONTAINER-APP-NAME"

# ---- Autenticação ----
AUTH_PEPPER="GERAR_COM_openssl_rand_-base64_48"
JWT_SECRET="GERAR_COM_openssl_rand_-base64_64"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# ---- Azure OpenAI ----
# Opção 1: API key (desenvolvimento)
AZURE_OPENAI_ENDPOINT="https://openai-PROJETO-sc.openai.azure.com/"
AZURE_OPENAI_API_KEY="VALOR_DO_KEY_VAULT"
AZURE_OPENAI_DEPLOYMENT="gpt-52-chat"
# Opção 2: Managed Identity (produção — sem API key)
# Remover AZURE_OPENAI_API_KEY e usar DefaultAzureCredential

# ---- Azure Blob Storage ----
AZURE_STORAGE_ACCOUNT_URL="https://stPROJETOENV.blob.core.windows.net/"
# Managed Identity em produção — sem connection string

# ---- Redis ----
REDIS_URL="redis://localhost:6379"

# ---- Ambiente ----
NODE_ENV="development"
PORT=3000
```

### 7.3 Regra do `.gitignore`

```gitignore
# Segredos — NUNCA commitar
.env
.env.*
!.env.example

# Azure
*.publishsettings
```

---

## 8. Git — Prevenção de Vazamentos

### 8.1 GitHub Push Protection

Já habilitado nos repos da organização `totalutiliti`. Se o Push Protection bloquear:

```bash
# 1. NÃO usar --force para contornar
# 2. Remover o segredo do código
# 3. Rotacionar o segredo IMEDIATAMENTE (ele já foi exposto localmente)
# 4. Adicionar ao Key Vault
# 5. Reescrever histórico se necessário:
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch PATH/TO/FILE" \
  --prune-empty -- --all

# Ou usar BFG Repo Cleaner (mais rápido):
bfg --delete-files ARQUIVO_COM_SEGREDO
bfg --replace-text passwords.txt  # arquivo com padrões a substituir
```

### 8.2 Pre-commit Hook (gitleaks)

```bash
# Instalar gitleaks
# Windows (via scoop):
scoop install gitleaks

# Configurar pre-commit hook em cada repo:
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
gitleaks protect --staged --verbose
if [ $? -ne 0 ]; then
  echo "❌ SEGREDO DETECTADO! Commit bloqueado."
  echo "Remova o segredo e tente novamente."
  exit 1
fi
EOF
chmod +x .git/hooks/pre-commit
```

### 8.3 Configuração `.gitleaks.toml` (na raiz do repo)

```toml
[extend]
useDefault = true

[allowlist]
description = "Allowlist para TotalUtiliti"
paths = [
  '''.env\.example''',
  '''\.gitleaks\.toml''',
]

# Regras customizadas para padrões Azure
[[rules]]
id = "azure-connection-string"
description = "Azure Connection String"
regex = '''(?i)(DefaultEndpointsProtocol|AccountKey|SharedAccessSignature)\s*=\s*[^\s;]+'''
tags = ["azure", "connection-string"]

[[rules]]
id = "azure-openai-key"
description = "Azure OpenAI API Key"
regex = '''(?i)(api[_-]?key|openai[_-]?key)\s*[:=]\s*["']?[a-f0-9]{32}["']?'''
tags = ["azure", "openai"]
```

### 8.4 Scan do Histórico Completo

```bash
# Rodar periodicamente em todos os repos:
gitleaks detect --source . --verbose --report-path gitleaks-report.json

# Se encontrar algo:
# 1. Rotacionar o segredo IMEDIATAMENTE
# 2. Limpar o histórico (ver 8.1)
# 3. Force push (coordenar com time)
```

---

## 9. Rotação de Segredos

### 9.1 Política de Rotação

| Segredo | Frequência | Automático? |
|---------|-----------|-------------|
| AUTH_PEPPER | 90 dias | Semi (Key Vault + deploy) |
| JWT_SECRET | 90 dias | Semi (suportar 2 secrets simultâneos) |
| DB Password | 60 dias | Sim (Key Vault rotation policy) |
| OpenAI API Key | 90 dias | Migrar para Managed Identity |
| SMTP Password | 90 dias | Manual |

### 9.2 Rotação com Zero Downtime (JWT)

```typescript
// ============================================================
// Suporte a múltiplos JWT secrets durante rotação
// ============================================================

const JWT_SECRETS = [
  process.env.JWT_SECRET_CURRENT,   // Secret atual
  process.env.JWT_SECRET_PREVIOUS,  // Secret anterior (aceitar durante transição)
].filter(Boolean);

// Assinar sempre com o CURRENT
function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRETS[0], { expiresIn: '15m' });
}

// Verificar com QUALQUER secret válido
function verifyToken(token: string): object | null {
  for (const secret of JWT_SECRETS) {
    try {
      return jwt.verify(token, secret);
    } catch {
      continue;
    }
  }
  return null; // Nenhum secret válido
}

// Processo de rotação:
// 1. Gerar novo secret → JWT_SECRET_NEW
// 2. Mover JWT_SECRET_CURRENT → JWT_SECRET_PREVIOUS
// 3. Mover JWT_SECRET_NEW → JWT_SECRET_CURRENT
// 4. Deploy
// 5. Após JWT_EXPIRES_IN, remover JWT_SECRET_PREVIOUS
```

### 9.3 Key Vault — Rotation Policy

```bash
# Configurar rotação automática no Key Vault
az keyvault secret rotation-policy update \
  --vault-name kv-kegsafe-prod \
  --name db-password \
  --value @rotation-policy.json

# rotation-policy.json:
{
  "lifetimeActions": [
    {
      "trigger": { "timeBeforeExpiry": "P30D" },
      "action": { "type": "Notify" }
    }
  ],
  "attributes": {
    "expiryTime": "P90D"
  }
}
```

---

## 10. Checklist por Projeto

### Ao criar um novo projeto:

```
□ Key Vault criado (kv-{projeto}-{env})
□ Managed Identity habilitada no Container App
□ Container App tem role "Key Vault Secrets User"
□ AUTH_PEPPER gerado (openssl rand -base64 48) e salvo no KV
□ JWT_SECRET gerado (openssl rand -base64 64) e salvo no KV
□ .env.example criado com placeholders
□ .env no .gitignore
□ gitleaks configurado (pre-commit hook + .gitleaks.toml)
□ GitHub Push Protection habilitado no repo
□ RBAC deny-by-default configurado
□ Argon2id implementado para senhas de usuário
□ Rate limiting em endpoints de autenticação
```

### Ao fazer deploy para produção:

```
□ Nenhum segredo em variável de ambiente literal
□ Todos os secrets via Key Vault reference
□ Managed Identity para: PostgreSQL, Blob Storage, OpenAI, ACR
□ Password auth desabilitado no PostgreSQL (se possível)
□ SSL/TLS enforced em todas as conexões
□ Scan gitleaks no histórico completo do repo
□ CORS configurado (origens específicas, não *)
□ Helmet habilitado no NestJS
□ CSP headers configurados
□ Logs NÃO contêm segredos (verificar manualmente)
```

### Revisão periódica (mensal):

```
□ Scan gitleaks em todos os repos da org totalutiliti
□ Verificar segredos expirados/próximos de expirar no Key Vault
□ Auditar access logs do Key Vault
□ Verificar que nenhum novo Container App está sem Managed Identity
□ Revisar roles RBAC (remover acessos desnecessários)
□ Verificar que pg-bmvagas-prod está parado (ou re-stop se auto-restart)
```

---

## 11. Prompt para Claude Code (Antigravity)

> Cole este prompt ao iniciar uma sessão de implementação relacionada a segurança.

````markdown
## Contexto de Segurança — TotalUtiliti

Ao implementar qualquer funcionalidade que envolva autenticação, segredos
ou acesso a recursos Azure, siga RIGOROSAMENTE estas regras:

### Senhas de usuário
- Usar Argon2id com pepper (ver padrão em prompt-seguranca-senhas.md seção 2)
- Pepper vem de `process.env.AUTH_PEPPER` (Key Vault)
- NUNCA usar MD5, SHA-*, bcrypt

### Segredos
- NUNCA hardcoded. Nem "temporariamente". Nem em comentários.
- Usar `process.env.VARIAVEL` que referencia Key Vault
- Preferir `DefaultAzureCredential` do `@azure/identity` sempre que possível
- Ao criar .env.example, usar placeholders descritivos

### Conexões Azure
- PostgreSQL: preferir AAD auth via Managed Identity
- Blob Storage: usar `DefaultAzureCredential`, nunca connection string
- OpenAI: usar `DefaultAzureCredential`, nunca API key em código
- Key Vault: usar `DefaultAzureCredential`

### Git
- NUNCA commitar .env, .env.*, ou qualquer arquivo com segredos
- Se acidentalmente commitar, PARAR e avisar imediatamente
- Usar --no-verify apenas para bypass de lint, NUNCA para segurança

### NestJS específico
- Rate limiting em /auth/* endpoints (ThrottlerModule)
- CORS com origens explícitas
- Helmet habilitado
- Soft delete em usuários (nunca hard delete)
- Audit log para ações sensíveis
- RBAC deny-by-default
````

---

## 12. Referência Rápida de Comandos Azure CLI

```bash
# ============================================================
# GERAR SEGREDOS
# ============================================================
openssl rand -base64 48    # Pepper (384 bits)
openssl rand -base64 64    # JWT Secret (512 bits)
openssl rand -hex 32       # Generic secret (256 bits)

# ============================================================
# KEY VAULT
# ============================================================
# Criar
az keyvault create --name kv-PROJ-ENV --resource-group rg-PROJ-ENV \
  --location brazilsouth --sku standard --enable-rbac-authorization true

# Adicionar segredo
az keyvault secret set --vault-name kv-PROJ-ENV --name SECRET-NAME --value "VALUE"

# Ler segredo
az keyvault secret show --vault-name kv-PROJ-ENV --name SECRET-NAME --query value -o tsv

# Listar
az keyvault secret list --vault-name kv-PROJ-ENV -o table

# ============================================================
# MANAGED IDENTITY
# ============================================================
# Habilitar no Container App
az containerapp identity assign --name APP-NAME --resource-group RG --system-assigned

# Obter principal ID
az containerapp identity show --name APP-NAME --resource-group RG --query principalId -o tsv

# Atribuir role
az role assignment create --assignee PRINCIPAL-ID --role "ROLE-NAME" --scope RESOURCE-ID

# Roles comuns:
#   Key Vault:     "Key Vault Secrets User"
#   Blob Storage:  "Storage Blob Data Contributor"
#   OpenAI:        "Cognitive Services OpenAI User"
#   PostgreSQL:    Configurar via ad-admin (ver seção 6.1)
#   ACR:           "AcrPull"

# ============================================================
# CONTAINER APPS — Secrets do Key Vault
# ============================================================
# Mapear KV secret → Container App secret
az containerapp secret set --name APP --resource-group RG \
  --secrets "secret-name=keyvaultref:https://kv-PROJ-ENV.vault.azure.net/secrets/SECRET-NAME,identityref:system"

# Mapear secret → env var
az containerapp update --name APP --resource-group RG \
  --set-env-vars "ENV_VAR_NAME=secretref:secret-name"

# ============================================================
# AUDITORIA
# ============================================================
# Logs de acesso ao Key Vault
az monitor diagnostic-settings create \
  --name kv-audit \
  --resource $(az keyvault show --name kv-PROJ-ENV --query id -o tsv) \
  --logs '[{"category":"AuditEvent","enabled":true}]' \
  --workspace WORKSPACE-ID

# Verificar role assignments
az role assignment list --assignee PRINCIPAL-ID --all -o table
```

---

## 📝 Notas Finais

### Ordem de prioridade para migração dos projetos existentes:

1. **KegSafe** — Projeto piloto, menor risco. Migrar PostgreSQL + Blob + OpenAI para Managed Identity.
2. **Total Ledger** — Em deploy ativo. Migrar Azure OpenAI (já usa Key Vault para alguns secrets).
3. **VidroSaaS** — Migrar OpenAI + PostgreSQL.
4. **Total Talent / BM Vagas** — Migrar OpenAI + Document Intelligence.
5. **Lello / Petropolis** — Projetos de cliente, migrar com coordenação.

### Recursos

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Azure Managed Identity docs](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview)
- [Azure Key Vault Best Practices](https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices)
- [gitleaks](https://github.com/gitleaks/gitleaks)

---

> **Este documento é um prompt vivo.** Atualize conforme novos projetos
> forem criados e novas práticas forem adotadas. A última revisão
> deve sempre estar na data no topo do documento.
