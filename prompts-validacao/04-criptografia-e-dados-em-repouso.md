# 🔒 04 — Criptografia e Proteção de Dados em Repouso e em Trânsito

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
Antes de aplicar este prompt, analise o projeto atual:

NÍVEL 1 — CRIPTOGRAFIA EM TRÂNSITO (TLS)
  O projeto expõe APIs, frontends ou qualquer endpoint HTTP?
    → SIM → Aplicar seções marcadas [TRÂNSITO]. (Quase todo projeto.)
    → NÃO → Improvável. Se for um script/batch sem rede, pular.

NÍVEL 2 — CRIPTOGRAFIA EM REPOUSO (STORAGE)
  O projeto armazena dados em banco de dados, Blob Storage,
  Redis, filesystem ou qualquer persistência?
    → SIM → Aplicar seções marcadas [REPOUSO].

NÍVEL 3 — CRIPTOGRAFIA DE COLUNA (CAMPO SENSÍVEL)
  O projeto armazena dados que, mesmo com acesso ao banco,
  NÃO deveriam ser legíveis sem chave específica?
  (CPF, dados de saúde, dados financeiros, dados fiscais)
    → SIM → Aplicar seções marcadas [COLUNA].
    → NÃO → Pular. Criptografia de disco/storage é suficiente.

NÍVEL 4 — CRIPTOGRAFIA DE ARQUIVOS (DOCUMENTOS/UPLOADS)
  O projeto processa uploads de documentos, imagens de
  documentos pessoais, PDFs, ou gera relatórios com dados pessoais?
    → SIM → Aplicar seções marcadas [ARQUIVO].

NÍVEL 5 — CUSTOMER-MANAGED KEYS (CMK)
  O cliente exige controle total sobre chaves de criptografia?
  Existe requisito regulatório que exija CMK?
    → SIM → Aplicar seções marcadas [CMK].
    → NÃO → Service-Managed Keys (padrão Azure) é suficiente.

RESUMO RÁPIDO POR PROJETO:
  Total Ledger (contabilidade)    → TODOS os níveis (1-4, talvez 5)
  KegSafe (barris)                → Nível 1 + 2
  VidroSaaS (vidraçaria CRM)     → Nível 1 + 2 + 3 (CPF de clientes)
  Total Talent (recrutamento)     → Nível 1 + 2 + 3 + 4 (currículos)
  Lello Bella (chatbot)           → Nível 1 + 2
  Recursive Language Models       → Nível 1 + 2
```

---

## 📋 ÍNDICE

1. [Visão Geral — As 4 Camadas de Criptografia](#1-visão-geral) `[UNIVERSAL]`
2. [Criptografia em Trânsito (TLS)](#2-criptografia-em-trânsito) `[TRÂNSITO]`
3. [Criptografia em Repouso — Azure](#3-criptografia-em-repouso-azure) `[REPOUSO]`
4. [Criptografia em Repouso — PostgreSQL](#4-criptografia-postgresql) `[REPOUSO]`
5. [Criptografia em Repouso — Blob Storage](#5-criptografia-blob) `[REPOUSO]`
6. [Criptografia em Repouso — Redis](#6-criptografia-redis) `[REPOUSO]`
7. [Criptografia de Coluna (Application-Level)](#7-criptografia-de-coluna) `[COLUNA]`
8. [Criptografia de Arquivos e Documentos](#8-criptografia-de-arquivos) `[ARQUIVO]`
9. [Customer-Managed Keys (CMK)](#9-customer-managed-keys) `[CMK]`
10. [Gerenciamento de Chaves](#10-gerenciamento-de-chaves) `[UNIVERSAL]`
11. [Backup Criptografado](#11-backup-criptografado) `[REPOUSO]`
12. [Checklist de Validação](#12-checklist) `[UNIVERSAL]`
13. [Instruções para Claude Code](#13-instruções-claude-code) `[UNIVERSAL]`

---

## 1. Visão Geral — As 4 Camadas `[UNIVERSAL]`

```
DADOS EM TRÂNSITO ←→ DADOS EM REPOUSO ←→ DADOS SENSÍVEIS
     (TLS)              (Disco/Storage)      (Coluna/App)

Camada 1: TLS em trânsito
  → Protege dados trafegando pela rede
  → HTTPS, SSL/TLS nas conexões ao banco, Redis, APIs
  → Quem faz: infraestrutura (Azure Container Apps, load balancer)

Camada 2: Criptografia de disco/storage (at rest)
  → Protege contra roubo físico de disco ou acesso ao storage
  → AES-256 no Azure Storage, PostgreSQL, Blob
  → Quem faz: Azure (automático, sempre ativo)

Camada 3: Criptografia de coluna (application-level)
  → Protege campos específicos MESMO se alguém acessar o banco
  → pgcrypto, AES-256 via aplicação, campos criptografados
  → Quem faz: aplicação (NestJS) + chave no Key Vault

Camada 4: Criptografia de arquivos
  → Protege documentos (PDFs, imagens) no Blob Storage
  → Criptografia client-side antes do upload, ou CMK
  → Quem faz: aplicação antes de enviar ao storage

REGRA: Camadas 1 e 2 são OBRIGATÓRIAS para todo projeto.
       Camadas 3 e 4 dependem do tipo de dado (ver classificação).
```

### Defesa em profundidade

```
Cenário de ataque:          O que protege:

Rede interceptada           → Camada 1 (TLS)
Disco físico roubado        → Camada 2 (Storage encryption)
DBA malicioso / SQL injection→ Camada 3 (Column encryption)
Blob Storage comprometido   → Camada 4 (File encryption)
Azure account comprometida  → Camada 3 + 4 (chave no Key Vault separado)
Backup vazado               → Camada 2 + 11 (backup criptografado)

Nenhuma camada sozinha é suficiente.
A combinação cria defesa em profundidade.
```

---

## 2. Criptografia em Trânsito (TLS) `[TRÂNSITO]`

### 2.1 Requisitos mínimos

```
OBRIGATÓRIO PARA TODO PROJETO:
  □ TLS 1.2 ou superior em TODAS as conexões
  □ HTTP → HTTPS redirect (nunca aceitar HTTP puro)
  □ HSTS header habilitado (Strict-Transport-Security)

CONEXÕES QUE DEVEM SER TLS:
  □ Frontend ↔ Backend (HTTPS)
  □ Backend ↔ PostgreSQL (SSL required)
  □ Backend ↔ Redis (TLS se disponível)
  □ Backend ↔ Azure OpenAI (HTTPS — automático)
  □ Backend ↔ Blob Storage (HTTPS — automático)
  □ Backend ↔ Key Vault (HTTPS — automático)
  □ Backend ↔ Document Intelligence (HTTPS — automático)
  □ Backend ↔ APIs externas (WhatsApp, Twilio) (HTTPS)
```

### 2.2 Azure Container Apps — HTTPS only

```bash
# Forçar HTTPS no ingress do Container App
az containerapp ingress update \
  --name APP-NAME \
  --resource-group RG \
  --transport https \
  --allow-insecure false

# Verificar configuração
az containerapp ingress show \
  --name APP-NAME \
  --resource-group RG \
  --query '{transport:transport, allowInsecure:allowInsecure}'
# Esperado: { "transport": "https", "allowInsecure": false }
```

### 2.3 PostgreSQL — SSL obrigatório

```bash
# Verificar que SSL está habilitado no Flexible Server
az postgres flexible-server parameter show \
  --server-name PG-NAME \
  --resource-group RG \
  --name require_secure_transport \
  --query value
# Esperado: "ON"

# Se não estiver:
az postgres flexible-server parameter set \
  --server-name PG-NAME \
  --resource-group RG \
  --name require_secure_transport \
  --value ON

# Na connection string da aplicação, garantir SSL:
# postgresql://user:pass@host:5432/db?sslmode=require
```

### 2.4 NestJS — Helmet e HSTS

```typescript
// ============================================================
// OBRIGATÓRIO em todo projeto NestJS
// ============================================================
import helmet from 'helmet';

app.use(helmet({
  hsts: {
    maxAge: 31536000,        // 1 ano
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: true,  // CSP — configurar por projeto
}));

// Se atrás de proxy (Container Apps):
app.set('trust proxy', 1);
```

---

## 3. Criptografia em Repouso — Azure `[REPOUSO]`

### 3.1 O que o Azure criptografa automaticamente

```
SEMPRE ATIVO — AUTOMÁTICO — SEM CONFIGURAÇÃO:

  Azure PostgreSQL Flexible Server
    → AES-256 via Azure Storage Service Encryption (SSE)
    → Cobre: data files, backups, WAL, temporary files
    → FIPS 140-2 compliant
    → NÃO é TDE nativo do PostgreSQL (é criptografia de disco)
    → Chave: Microsoft-managed (SMK) por padrão

  Azure Blob Storage
    → AES-256 via SSE
    → Cobre: blobs, files, queues, tables, metadata
    → Sempre ativo, não pode ser desligado

  Azure Managed Disks (Container Apps)
    → AES-256 SSE
    → Cobre: discos de SO e dados

  Azure Redis Cache
    → Criptografia em repouso habilitada por padrão (Premium/Enterprise)
    → Basic/Standard: dados ficam na memória (volátil)

CONSEQUÊNCIA PRÁTICA:
  Se você usa Azure, seus dados em repouso JÁ ESTÃO criptografados
  com AES-256, sem fazer nada. Isso atende à LGPD Art. 46 para a
  camada de storage.

  MAS: essa criptografia protege contra roubo de disco.
  NÃO protege contra acesso indevido ao banco via credenciais.
  Para isso → Camada 3 (criptografia de coluna).
```

### 3.2 Como verificar

```bash
# PostgreSQL — verificar encryption status
# (não há comando direto; a criptografia é sempre ativa)
# Confirmar via documentação: https://servicetrust.microsoft.com/

# Blob Storage — verificar encryption
az storage account show \
  --name STORAGE-NAME \
  --resource-group RG \
  --query encryption
# Esperado: keySource = "Microsoft.Storage" (SMK) ou "Microsoft.Keyvault" (CMK)

# Para compliance, manter screenshot/output desses comandos como evidência
```

---

## 4. Criptografia em Repouso — PostgreSQL `[REPOUSO]`

### 4.1 Azure PostgreSQL Flexible Server

```
O QUE JÁ VEM CRIPTOGRAFADO (automático):
  ✅ Data files (tabelas, índices)
  ✅ WAL (Write-Ahead Log)
  ✅ Temporary files
  ✅ Backups automáticos
  ✅ Read replicas

O QUE NÃO É CRIPTOGRAFADO pela camada de storage:
  ❌ Dados em memória (RAM) durante processamento
  ❌ Dados visíveis via SQL para quem tem credencial
  ❌ Dados em query results trafegando sem TLS

PROTEÇÃO ADICIONAL NECESSÁRIA:
  → SSL obrigatório (seção 2.3)
  → Roles com menor privilégio (o app user NÃO é superuser)
  → RLS habilitado (tenant isolation)
  → Para campos ultra-sensíveis → criptografia de coluna (seção 7)
```

### 4.2 Parâmetros de segurança do PostgreSQL

```bash
# Verificar parâmetros críticos
az postgres flexible-server parameter list \
  --server-name PG-NAME \
  --resource-group RG \
  --query "[?name=='require_secure_transport' || \
            name=='password_encryption' || \
            name=='log_connections' || \
            name=='log_disconnections' || \
            name=='log_statement']" \
  -o table

# VALORES ESPERADOS:
#   require_secure_transport = ON      (TLS obrigatório)
#   password_encryption     = scram-sha-256  (não md5!)
#   log_connections         = ON       (auditoria)
#   log_disconnections      = ON       (auditoria)
#   log_statement           = ddl      (logar DDL — CREATE, ALTER, DROP)
```

---

## 5. Criptografia em Repouso — Blob Storage `[REPOUSO]`

### 5.1 O que o Azure faz automaticamente

```
Azure Blob Storage usa AES-256 SSE:
  ✅ Todos os blobs criptografados automaticamente no write
  ✅ Descriptografia automática e transparente no read
  ✅ Cobre: blobs, snapshots, metadata, files, queues, tables
  ✅ Não pode ser desligado
  ✅ Sem impacto de performance

Para a MAIORIA dos projetos, isso é suficiente.
```

### 5.2 Quando precisar de mais

```
CONSIDERAR CRIPTOGRAFIA CLIENT-SIDE QUANDO:
  → Documentos contêm dados fiscais (cartões de ponto, IRPF)
  → Imagens de documentos pessoais (RG, CPF, comprovantes)
  → O cliente exige que nem a Microsoft possa ler os dados
  → Regulamento específico exige controle total das chaves

IMPLEMENTAÇÃO (se necessário):
  → Criptografar ANTES de fazer upload ao Blob
  → Chave de criptografia no Key Vault
  → Descriptografar no backend após download
  → Ver seção 8 para implementação
```

---

## 6. Criptografia em Repouso — Redis `[REPOUSO]`

```
REDIS NO AZURE:

  Azure Cache for Redis (Premium/Enterprise tier):
    ✅ Criptografia em repouso habilitada
    ✅ TLS em trânsito habilitado

  Azure Cache for Redis (Basic/Standard tier):
    ⚠️ Dados ficam APENAS em memória (volátil)
    ⚠️ Sem persistência criptografada (porque não há persistência)

  Container Apps com Redis sidecar:
    ⚠️ Sem criptografia em repouso nativa
    ⚠️ Dados em memória apenas

REGRA PRÁTICA:
  → NUNCA armazenar dados pessoais sensíveis no Redis
  → Redis é para: sessões, cache, filas (BullMQ), rate limiting
  → Se precisar cachear dados pessoais: usar IDs, não valores reais
  
  ❌ redis.set('cache:user:123', JSON.stringify({ cpf: '123.456.789-00', renda: 150000 }))
  ✅ redis.set('cache:user:123', JSON.stringify({ userId: 'abc123', lastAccess: '2026-03-15' }))
```

---

## 7. Criptografia de Coluna (Application-Level) `[COLUNA]`

> **Aplica-se quando:** o projeto armazena campos que devem ser
> ilegíveis mesmo para quem tem acesso direto ao banco de dados.

### 7.1 Quando usar

```
A criptografia de storage (Camada 2) protege contra roubo de disco.
Mas quem tem a connection string do banco VÊ tudo em texto plano.

CRIPTOGRAFIA DE COLUNA protege contra:
  → DBA malicioso ou negligente
  → SQL injection que extrai dados
  → Acesso indevido via credenciais comprometidas
  → Backup restaurado em ambiente não autorizado

CAMPOS CANDIDATOS A CRIPTOGRAFIA DE COLUNA:
  → CPF (se armazenado — considerar alternativa: armazenar hash)
  → Dados bancários (conta, agência)
  → Dados de saúde (despesas médicas)
  → Documentos de identidade (RG)
  → Qualquer campo que a LGPD classifica como sensível
  
CAMPOS QUE NÃO PRECISAM:
  → Nome (necessário para buscas — criptografia impede busca)
  → Email (necessário para login/busca)
  → Endereço (necessário para buscas/exibição)
  → Dados agregados (valores numéricos para relatórios)
```

### 7.2 Trade-offs

```
CRIPTOGRAFIA DE COLUNA IMPEDE:
  ❌ Busca por conteúdo (WHERE cpf = '123.456.789-00')
  ❌ Ordenação pelo campo
  ❌ Índices no campo criptografado
  ❌ Joins pelo campo

ALTERNATIVA PARA CAMPOS QUE PRECISAM DE BUSCA:
  → Armazenar hash (SHA-256) em coluna separada para lookup
  → Armazenar valor criptografado para exibição
  
  Tabela: contribuintes
  ┌────────────────────┬──────────────────────────────────────┐
  │ cpf_hash (indexed) │ SHA-256 do CPF (para busca)           │
  │ cpf_encrypted      │ AES-256-GCM do CPF (para exibição)   │
  └────────────────────┴──────────────────────────────────────┘
  
  Busca: WHERE cpf_hash = sha256('123.456.789-00')
  Exibição: decrypt(cpf_encrypted) → '123.456.789-00'
```

### 7.3 Implementação NestJS — Criptografia na aplicação

```typescript
// ============================================================
// PADRÃO TOTALUTILITI — Criptografia de coluna via aplicação
// ============================================================
// Usa AES-256-GCM (authenticated encryption)
// Chave armazenada no Key Vault, injetada via env var
// ============================================================

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

// Chave vem do Key Vault → env var (NUNCA hardcoded)
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY; // 32 bytes base64
const ALGORITHM = 'aes-256-gcm';

if (!ENCRYPTION_KEY) {
  throw new Error('DATA_ENCRYPTION_KEY ausente. Verificar Key Vault.');
}

const key = Buffer.from(ENCRYPTION_KEY, 'base64');

// Criptografar valor
export function encrypt(plaintext: string): string {
  const iv = randomBytes(16); // IV único por operação
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag(); // Tag de autenticação (GCM)

  // Formato: iv:authTag:ciphertext (tudo em hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

// Descriptografar valor
export function decrypt(encryptedString: string): string {
  const [ivHex, authTagHex, ciphertext] = encryptedString.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Hash para busca (determinístico — mesmo input = mesmo hash)
export function hashForLookup(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// ============================================================
// USO no Service/Entity
// ============================================================
// Na entity TypeORM, usar transformer:
//
// @Column({
//   transformer: {
//     to: (value: string) => encrypt(value),
//     from: (value: string) => decrypt(value),
//   },
// })
// cpf_encrypted: string;
//
// @Column()
// @Index()
// cpf_hash: string; // Preenchido com hashForLookup(cpf)
```

### 7.4 Implementação PostgreSQL — pgcrypto (alternativa)

```sql
-- ============================================================
-- ALTERNATIVA: Criptografia no banco via pgcrypto
-- Vantagem: criptografia acontece no banco, menos código na app
-- Desvantagem: chave precisa ser enviada na query
-- ============================================================

-- Habilitar extensão
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Criptografar ao inserir
INSERT INTO contribuintes (cpf_encrypted, cpf_hash)
VALUES (
  pgp_sym_encrypt('123.456.789-00', 'chave-do-key-vault'),
  digest('123.456.789-00', 'sha256')
);

-- Descriptografar ao ler
SELECT pgp_sym_decrypt(cpf_encrypted::bytea, 'chave-do-key-vault') AS cpf
FROM contribuintes
WHERE cpf_hash = digest('123.456.789-00', 'sha256');

-- ⚠️ ATENÇÃO: A chave aparece na query.
-- Se log_statement = 'all', a chave vai para os logs!
-- RECOMENDAÇÃO: usar log_statement = 'ddl' (não 'all')
-- RECOMENDAÇÃO MELHOR: criptografar na aplicação (seção 7.3)
```

### 7.5 Geração da chave de criptografia

```bash
# Gerar chave AES-256 (32 bytes = 256 bits)
openssl rand -base64 32

# Armazenar no Key Vault
az keyvault secret set \
  --vault-name kv-PROJETO-ENV \
  --name data-encryption-key \
  --value "$(openssl rand -base64 32)"

# Injetar no Container App via Key Vault reference
az containerapp secret set \
  --name APP-NAME \
  --resource-group RG \
  --secrets "data-encryption-key=keyvaultref:https://kv-PROJETO-ENV.vault.azure.net/secrets/data-encryption-key,identityref:system"

az containerapp update \
  --name APP-NAME \
  --resource-group RG \
  --set-env-vars "DATA_ENCRYPTION_KEY=secretref:data-encryption-key"
```

---

## 8. Criptografia de Arquivos e Documentos `[ARQUIVO]`

> **Aplica-se quando:** o projeto processa uploads de documentos
> pessoais, cartões de ponto, comprovantes, PDFs com dados sensíveis.

### 8.1 Quando criptografar client-side

```
A criptografia do Azure Blob Storage (SSE) já protege arquivos em repouso.

CRIPTOGRAFIA CLIENT-SIDE adicional quando:
  → Documentos contêm dados fiscais (IRPF, cartões de ponto)
  → Imagens de documentos pessoais (RG, CPF)
  → Requisito regulatório ou contratual exige
  → O cliente exige que dados não sejam legíveis nem pelo provedor cloud

FLUXO:
  Upload: Arquivo → encrypt(chave KV) → Blob Storage (criptografado 2x)
  Download: Blob Storage → decrypt(chave KV) → Arquivo legível
  Processamento OCR: decrypt → enviar para Document Intelligence → re-encrypt resultado
```

### 8.2 Implementação NestJS

```typescript
// ============================================================
// Criptografia de arquivos antes do upload ao Blob Storage
// ============================================================
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

const ALGORITHM = 'aes-256-gcm';
const key = Buffer.from(process.env.FILE_ENCRYPTION_KEY, 'base64');

// Criptografar arquivo (stream — funciona com arquivos grandes)
async function encryptFile(inputPath: string, outputPath: string): Promise<{iv: string, authTag: string}> {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  await pipeline(
    createReadStream(inputPath),
    cipher,
    createWriteStream(outputPath),
  );

  return {
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

// Descriptografar arquivo
async function decryptFile(inputPath: string, outputPath: string, iv: string, authTag: string): Promise<void> {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  await pipeline(
    createReadStream(inputPath),
    decipher,
    createWriteStream(outputPath),
  );
}

// ============================================================
// Fluxo de upload:
// 1. Receber arquivo do frontend
// 2. encryptFile(tempPath, encryptedPath)
// 3. Upload encryptedPath para Blob Storage
// 4. Salvar iv + authTag no banco (metadados do arquivo)
// 5. Deletar tempPath e encryptedPath do disco local
//
// Fluxo de download:
// 1. Download do Blob Storage para tempPath
// 2. Buscar iv + authTag do banco
// 3. decryptFile(tempPath, decryptedPath, iv, authTag)
// 4. Enviar decryptedPath ao frontend
// 5. Deletar ambos do disco local
// ============================================================
```

### 8.3 Metadados de criptografia no banco

```sql
-- Armazenar metadados de criptografia junto ao registro do arquivo
-- NUNCA armazenar a chave de criptografia aqui (ela fica no Key Vault)

ALTER TABLE documentos ADD COLUMN encryption_iv VARCHAR(32);
ALTER TABLE documentos ADD COLUMN encryption_auth_tag VARCHAR(32);
ALTER TABLE documentos ADD COLUMN encryption_algorithm VARCHAR(20) DEFAULT 'aes-256-gcm';
ALTER TABLE documentos ADD COLUMN is_encrypted BOOLEAN DEFAULT false;
```

---

## 9. Customer-Managed Keys (CMK) `[CMK]`

> **Aplica-se quando:** o cliente exige controle total sobre
> as chaves de criptografia, ou há requisito regulatório específico.

### 9.1 Quando usar

```
SERVICE-MANAGED KEYS (SMK) — Padrão, suficiente para maioria:
  ✅ Azure gerencia tudo (geração, rotação, armazenamento)
  ✅ Sem custo adicional
  ✅ Sem complexidade operacional
  ✅ Atende LGPD e maioria dos requisitos

CUSTOMER-MANAGED KEYS (CMK) — Quando necessário:
  → Cliente exige em contrato
  → Regulamento setorial exige (ex: BACEN para fintechs)
  → Necessidade de revogar acesso ao provedor cloud
  → Auditoria de acesso às chaves de criptografia

ATENÇÃO:
  → CMK no PostgreSQL Flexible Server só pode ser definido na CRIAÇÃO
  → Não é possível mudar de SMK para CMK depois
  → Planeje ANTES de criar o servidor
```

### 9.2 Configuração CMK para PostgreSQL

```bash
# 1. Criar Key Vault (se não existir) com soft-delete e purge protection
az keyvault create \
  --name kv-PROJETO-cmk \
  --resource-group RG \
  --location brazilsouth \
  --enable-rbac-authorization true \
  --enable-soft-delete true \
  --enable-purge-protection true \
  --retention-days 90

# 2. Criar chave RSA no Key Vault
az keyvault key create \
  --vault-name kv-PROJETO-cmk \
  --name pg-encryption-key \
  --kty RSA \
  --size 2048

# 3. Criar User-Assigned Managed Identity
az identity create \
  --name mi-PROJETO-pg-cmk \
  --resource-group RG \
  --location brazilsouth

# 4. Atribuir permissões no Key Vault à Managed Identity
MI_PRINCIPAL=$(az identity show --name mi-PROJETO-pg-cmk --resource-group RG --query principalId -o tsv)
KV_ID=$(az keyvault show --name kv-PROJETO-cmk --query id -o tsv)

az role assignment create --assignee $MI_PRINCIPAL \
  --role "Key Vault Crypto Service Encryption User" --scope $KV_ID

# 5. Criar PostgreSQL com CMK (APENAS NA CRIAÇÃO)
KEY_ID=$(az keyvault key show --vault-name kv-PROJETO-cmk --name pg-encryption-key --query key.kid -o tsv)
MI_ID=$(az identity show --name mi-PROJETO-pg-cmk --resource-group RG --query id -o tsv)

az postgres flexible-server create \
  --name pg-PROJETO-ENV \
  --resource-group RG \
  --location brazilsouth \
  --key $KEY_ID \
  --identity $MI_ID \
  # ... demais parâmetros
```

---

## 10. Gerenciamento de Chaves `[UNIVERSAL]`

### 10.1 Inventário de chaves

```
PARA CADA PROJETO, MANTER UM INVENTÁRIO:

  ┌──────────────────────┬──────────────────┬──────────────┬───────────┐
  │ Chave                 │ Onde armazenada   │ Rotação      │ Uso       │
  ├──────────────────────┼──────────────────┼──────────────┼───────────┤
  │ AUTH_PEPPER           │ Key Vault         │ 90 dias      │ Hash senha│
  │ JWT_SECRET            │ Key Vault         │ 90 dias      │ Tokens    │
  │ DATA_ENCRYPTION_KEY   │ Key Vault         │ 180 dias     │ AES coluna│
  │ FILE_ENCRYPTION_KEY   │ Key Vault         │ 180 dias     │ AES arquivo│
  │ PostgreSQL SMK/CMK    │ Azure managed/KV  │ Automática   │ Disco     │
  │ Blob Storage SMK/CMK  │ Azure managed/KV  │ Automática   │ Disco     │
  └──────────────────────┴──────────────────┴──────────────┴───────────┘
```

### 10.2 Rotação de chaves de criptografia de dados

```
PROBLEMA: Se você rotaciona a chave, os dados antigos foram
criptografados com a chave ANTERIOR.

SOLUÇÃO: Re-encrypt migration

  1. Gerar nova chave → KEY_NEW
  2. Manter chave antiga acessível → KEY_OLD
  3. Job batch:
     Para cada registro criptografado:
       decrypt(valor, KEY_OLD)
       encrypt(valor, KEY_NEW)
       salvar
  4. Após migração completa: remover KEY_OLD
  5. Atualizar DATA_ENCRYPTION_KEY no Key Vault

FREQUÊNCIA RECOMENDADA:
  → A cada 180 dias (6 meses) para dados de coluna
  → Azure gerencia automaticamente para SMK de disco
  → CMK: você define a política de rotação no Key Vault
```

---

## 11. Backup Criptografado `[REPOUSO]`

```
AZURE POSTGRESQL FLEXIBLE SERVER:
  ✅ Backups automáticos são criptografados com a mesma chave
     do servidor (SMK ou CMK)
  ✅ Retenção configurável (7-35 dias)
  ✅ Geo-redundant backup disponível (replicação criptografada)

AZURE BLOB STORAGE:
  ✅ Snapshots e soft-delete são criptografados automaticamente
  ✅ Versioning criptografado

O QUE VERIFICAR:
  □ Backup automático habilitado no PostgreSQL
  □ Retenção adequada configurada (mínimo 7 dias, recomendado 14-35)
  □ Teste de restore periódico (backup sem teste não é backup)
  □ Se CMK: chave NÃO pode ser deletada antes de todos os backups expirarem

COMANDO PARA VERIFICAR:
  az postgres flexible-server show \
    --name PG-NAME --resource-group RG \
    --query '{backupRetention:backup.backupRetentionDays, geoRedundant:backup.geoRedundantBackup}'
```

---

## 12. Checklist de Validação `[UNIVERSAL]`

### Criptografia em trânsito `[TRÂNSITO]`:

```
  □ HTTPS only habilitado no Container App (allowInsecure: false)
  □ require_secure_transport = ON no PostgreSQL
  □ sslmode=require na connection string da aplicação
  □ Helmet com HSTS habilitado no NestJS
  □ TLS 1.2+ em todas as conexões externas
```

### Criptografia em repouso `[REPOUSO]`:

```
  □ Azure Storage encryption ativo no PostgreSQL (automático — verificar)
  □ Azure Blob Storage encryption ativo (automático — verificar)
  □ Backup automático habilitado e criptografado
  □ password_encryption = scram-sha-256 no PostgreSQL
  □ Redis NÃO armazena dados pessoais sensíveis em texto plano
  □ Teste de restore de backup realizado e documentado
```

### Criptografia de coluna `[COLUNA]`:

```
  □ Campos sensíveis identificados (CPF, dados bancários, saúde)
  □ Módulo de criptografia implementado (AES-256-GCM)
  □ DATA_ENCRYPTION_KEY no Key Vault
  □ Hash para busca (cpf_hash) + valor criptografado (cpf_encrypted)
  □ Logs NÃO contêm chaves de criptografia
  □ log_statement = 'ddl' no PostgreSQL (NÃO 'all' se usar pgcrypto)
```

### Criptografia de arquivos `[ARQUIVO]`:

```
  □ Documentos sensíveis criptografados antes do upload
  □ FILE_ENCRYPTION_KEY no Key Vault
  □ Metadados de criptografia (IV, authTag) armazenados no banco
  □ Arquivos temporários deletados após processamento
  □ Pipeline OCR: decrypt → processar → re-encrypt resultado
```

### Customer-Managed Keys `[CMK]`:

```
  □ Key Vault com soft-delete e purge protection habilitados
  □ Managed Identity com permissões corretas
  □ Chave RSA 2048+ criada
  □ PostgreSQL criado COM CMK desde o início
  □ Política de rotação da CMK definida
  □ Plano de contingência se chave for comprometida
```

---

## 13. Instruções para Claude Code `[UNIVERSAL]`

````markdown
## Criptografia — Regras para Antigravity

### Ao iniciar trabalho em um projeto
- Identifique os NÍVEIS de criptografia aplicáveis (ver classificação no topo)
- Verifique se o projeto já tem módulo de criptografia
- Se não tem e precisa (COLUNA/ARQUIVO): implementar antes de dados sensíveis

### TLS (todo projeto)
- NUNCA aceitar HTTP. Sempre HTTPS.
- Connection strings de banco SEMPRE com sslmode=require
- Helmet + HSTS no NestJS

### Dados em repouso
- Azure cuida automaticamente da camada de storage (AES-256 SSE)
- Não implementar criptografia de disco manualmente (redundante)
- Focar esforço na criptografia de COLUNA para campos sensíveis

### Criptografia de coluna
- Usar AES-256-GCM (authenticated encryption)
- Chave SEMPRE do Key Vault via env var
- NUNCA hardcodar chave de criptografia
- Para campos que precisam de busca: hash (SHA-256) + encrypted value
- TypeORM transformer para encrypt/decrypt automático

### Arquivos e documentos
- Se o projeto processa documentos com dados pessoais:
  encrypt ANTES do upload ao Blob Storage
- Armazenar IV e authTag no banco como metadados
- Deletar arquivos temporários IMEDIATAMENTE após processamento

### Redis
- NUNCA armazenar CPF, dados financeiros ou sensíveis em texto plano
- Cachear por ID, não por valor
- Redis é para cache e filas, não para dados pessoais

### Logs
- NUNCA logar chaves de criptografia, IVs, ou dados descriptografados
- Se usar pgcrypto: log_statement DEVE ser 'ddl', NÃO 'all'
````

---

## 📝 Referências

- [Azure Data Encryption at Rest](https://learn.microsoft.com/en-us/azure/security/fundamentals/encryption-atrest)
- [Azure PostgreSQL — Data Encryption](https://learn.microsoft.com/en-us/azure/postgresql/security/security-data-encryption)
- [Azure Storage Encryption](https://learn.microsoft.com/en-us/azure/storage/common/storage-service-encryption)
- [Azure PostgreSQL — SSL/TLS](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/security-connect-tls)
- [Node.js Crypto — AES-256-GCM](https://nodejs.org/api/crypto.html)
- [pgcrypto — PostgreSQL docs](https://www.postgresql.org/docs/current/pgcrypto.html)

---

> **Próximo prompt:** `05-autenticacao-e-login.md`
