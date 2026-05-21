# SPECS — Total Campanha

> Especificação técnica: schema de banco, contratos de API, eventos de webhook, formatos de dados.

## 1. Schema Prisma (resumo — arquivo final em `prisma/schema.prisma`)

```prisma
// =========== GLOBAL (sem tenant_id) ===========

model Tenant {
  id            String   @id @default(uuid()) @db.Uuid
  slug          String   @unique
  cnpj          String   @unique
  razaoSocial   String
  plano         Plano    @default(STARTER)
  status        TenantStatus @default(TRIAL)
  trialAteEm    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  // Relações (sem RLS pois tabela é global)
  userTenants   UserTenant[]
}

enum Plano { STARTER PRO ENTERPRISE }
enum TenantStatus { TRIAL ATIVO INADIMPLENTE SUSPENSO CANCELADO }

model User {
  id            String   @id @default(uuid()) @db.Uuid
  emailHash     String   @unique  // hash do email para login (evita enumeration)
  email         String   @unique  // mostrado no painel
  passwordHash  String              // Argon2id+pepper
  totpSecret    String?             // 2FA opcional
  createdAt     DateTime @default(now())
  userTenants   UserTenant[]
}

model UserTenant {
  userId        String   @db.Uuid
  tenantId      String   @db.Uuid
  role          Role
  user          User     @relation(fields: [userId], references: [id])
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  @@id([userId, tenantId])
  @@index([tenantId])
}

enum Role { ADMIN EDITOR_CAMPANHA VISUALIZADOR }

model UsageLog {
  id               String   @id @default(uuid()) @db.Uuid
  tenantId         String   @db.Uuid
  servico          String   // 'meta.whatsapp.marketing', 'ses.email.send', 'openai.gpt'
  custoEstimadoBrl Decimal  @db.Decimal(10, 4)
  metadados        Json
  createdAt        DateTime @default(now())
  @@index([tenantId, createdAt])
  @@index([servico, createdAt])
}

// =========== POR TENANT (com RLS) ===========

model Contato {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @db.Uuid
  nome          String?
  email         String?
  telefoneE164  String?
  tags          String[]
  extras        Json     @default("{}")
  optInEmail    Boolean  @default(false)
  optInWhatsapp Boolean  @default(false)
  optInMeta     Json?    // log resumido: { ip, ua, origem, versao, ts }
  excluidoEm    DateTime?  // soft delete
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([tenantId])
  @@index([tenantId, email])
  @@index([tenantId, telefoneE164])
  @@unique([tenantId, email])  // email único por tenant
  @@unique([tenantId, telefoneE164])
}

model Segmento {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @db.Uuid
  nome      String
  filtros   Json     // estrutura: { and: [...], or: [...] }
  createdAt DateTime @default(now())
  @@index([tenantId])
}

model Template {
  id               String   @id @default(uuid()) @db.Uuid
  tenantId         String   @db.Uuid
  canal            Canal
  nome             String
  // Email
  mjml             String?
  assunto          String?
  // WhatsApp (nome do template aprovado na conta Meta do tenant)
  metaTemplateName String?
  metaLanguage     String?  // ex.: 'pt_BR'
  variaveis        Json     // [{ key: 'nome', exemplo: 'João' }, ...]
  createdAt        DateTime @default(now())
  @@index([tenantId, canal])
}

enum Canal { EMAIL WHATSAPP }

model Campanha {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @db.Uuid
  nome          String
  segmentoId    String   @db.Uuid
  templateId    String   @db.Uuid
  canal         Canal
  status        StatusCampanha @default(RASCUNHO)
  agendadoPara  DateTime?
  janelaEnvio   Json?    // { inicio: '09:00', fim: '18:00', diasSemana: [1,2,3,4,5] }
  totalDestinatarios Int @default(0)
  totalEnviados Int      @default(0)
  totalEntregues Int     @default(0)
  totalLidos    Int      @default(0)
  totalRespondidos Int   @default(0)
  totalFalhas   Int      @default(0)
  custoEstimadoBrl Decimal? @db.Decimal(10, 4)
  custoRealBrl  Decimal? @db.Decimal(10, 4)
  iniciadaEm    DateTime?
  finalizadaEm  DateTime?
  createdAt     DateTime @default(now())
  @@index([tenantId, status])
}

enum StatusCampanha { RASCUNHO AGENDADA DISPARANDO PAUSADA FINALIZADA CANCELADA }

model Mensagem {
  id                  String   @id @default(uuid()) @db.Uuid
  tenantId            String   @db.Uuid
  campanhaId          String   @db.Uuid
  contatoId           String   @db.Uuid
  canal               Canal
  status              StatusMensagem @default(PENDENTE)
  statusHistory       Json     @default("[]")
  providerMessageId   String?
  custoEstimadoBrl    Decimal? @db.Decimal(10, 4)
  enviadaEm           DateTime?
  entregueEm          DateTime?
  lidaEm              DateTime?
  falhaMotivo         String?
  @@index([tenantId, campanhaId])
  @@index([tenantId, status])
  @@index([providerMessageId])
}

enum StatusMensagem { PENDENTE ENFILEIRADA ENVIADA ENTREGUE LIDA RESPONDIDA FALHOU CANCELADA }

model ConexaoWhatsapp {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  wabaId          String
  phoneNumberId   String
  // Token criptografado via pgcrypto.pgp_sym_encrypt usando chave de Key Vault
  tokenEncrypted  Bytes
  webhookSecret   String   // gerado pela plataforma
  tierMeta        TierMeta @default(TIER_250)
  qualityRating   String?  // green/yellow/red (vem da Meta)
  status          StatusConexao @default(PENDENTE_VERIFICACAO)
  ultimoTeste     DateTime?
  createdAt       DateTime @default(now())
  @@unique([tenantId])  // 1 conexão WhatsApp por tenant no MVP
}

enum TierMeta { TIER_250 TIER_1K TIER_10K TIER_100K TIER_UNLIMITED }
enum StatusConexao { PENDENTE_VERIFICACAO ATIVA SUSPENSA ERRO }

model ConexaoEmail {
  id              String   @id @default(uuid()) @db.Uuid
  tenantId        String   @db.Uuid
  dominio         String
  remetente       String
  dkimStatus      String   // pending, verified, failed
  spfStatus       String
  status          StatusConexao @default(PENDENTE_VERIFICACAO)
  createdAt       DateTime @default(now())
  @@unique([tenantId, dominio])
}

model OptInLog {
  id          BigInt   @id @default(autoincrement())
  tenantId    String   @db.Uuid
  contatoId   String?  @db.Uuid
  email       String?
  telefoneE164 String?
  canal       Canal
  acao        OptInAcao
  ip          String
  userAgent   String
  origem      String   // 'landing-tenant', 'qr-balcao', 'whatsapp-stop', ...
  versaoTermo String
  createdAt   DateTime @default(now())
  @@index([tenantId, createdAt])
  @@index([contatoId])
}

enum OptInAcao { OPT_IN OPT_OUT }

model AuditLog {
  id        BigInt   @id @default(autoincrement())
  tenantId  String?  @db.Uuid  // nulo se for ação de Super Admin
  userId    String?  @db.Uuid
  acao      String   // 'campanha.criar', 'contato.deletar', 'conexao_whatsapp.atualizar', ...
  recurso   String?
  dados     Json
  createdAt DateTime @default(now())
  @@index([tenantId, createdAt])
  @@index([userId, createdAt])
}

model InboxConversa {
  id                 String   @id @default(uuid()) @db.Uuid
  tenantId           String   @db.Uuid
  contatoId          String   @db.Uuid
  ultimoMsgAt        DateTime
  janela24hExpiraEm  DateTime  // pode reabrir window respondendo dentro
  status             String   // 'aberta', 'fechada'
  @@index([tenantId, status])
}

model InboxMensagem {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @db.Uuid
  conversaId   String   @db.Uuid
  direcao      String   // 'in' (recebida) / 'out' (enviada manual)
  conteudo     String
  createdAt    DateTime @default(now())
  @@index([tenantId, conversaId])
}
```

### Setup RLS (migration manual após `prisma migrate`)

```sql
-- Para cada tabela com tenant_id:
ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contatos
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE segmentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON segmentos
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ...repetir para todas as tabelas tenant-scoped

-- Bypass para o role de migração e para Super Admin:
ALTER TABLE contatos FORCE ROW LEVEL SECURITY;
GRANT BYPASSRLS ON ... TO migration_role;
```

## 2. Rotas API (alto nível)

Prefixo `/api/v1`. Auth Bearer JWT.

### Auth

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/signup` | Cadastro de tenant + primeiro usuário (admin) |
| POST | `/auth/login` | Login, retorna access + sets refresh cookie |
| POST | `/auth/refresh` | Refresh token rotation |
| POST | `/auth/logout` | Invalida refresh |
| POST | `/auth/forgot` | Envia link de reset |
| POST | `/auth/reset` | Reset com token |
| POST | `/auth/2fa/setup` | Gera secret TOTP |
| POST | `/auth/2fa/verify` | Confirma TOTP |

### Tenant scope (todas com header `X-Tenant: {slug}` ou inferido do subdomínio)

| Método | Rota | Role |
|---|---|---|
| GET | `/me` | qualquer |
| GET | `/tenants/atual` | qualquer |
| GET/POST/PATCH/DELETE | `/contatos` | editor+ |
| POST | `/contatos/importar` | admin (CSV multipart) |
| GET | `/contatos/exportar` | admin |
| GET/POST/PATCH/DELETE | `/segmentos` | editor+ |
| GET | `/segmentos/:id/contatos/contagem` | visualizador+ |
| GET/POST/PATCH/DELETE | `/templates` | editor+ |
| POST | `/templates/:id/preview` | editor+ |
| GET | `/templates/whatsapp/aprovados-na-meta` | editor+ (consulta API Meta) |
| GET/POST/PATCH/DELETE | `/campanhas` | editor+ |
| POST | `/campanhas/:id/disparar` | admin |
| POST | `/campanhas/:id/pausar` | admin |
| GET | `/campanhas/:id/analytics` | visualizador+ |
| GET/POST/PATCH | `/conexoes/whatsapp` | admin |
| POST | `/conexoes/whatsapp/testar` | admin |
| GET/POST/PATCH | `/conexoes/email` | admin |
| GET | `/inbox/conversas` | editor+ |
| GET | `/inbox/conversas/:id/mensagens` | editor+ |
| POST | `/inbox/conversas/:id/responder` | editor+ |

### Públicas (sem auth)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/p/opt-in/:tenantSlug` | Landing de opt-in |
| POST | `/p/opt-in/:tenantSlug` | Submit do opt-in |
| GET | `/p/opt-out/:token` | Opt-out one-click |
| GET | `/p/email/track/open/:msgId` | Pixel de abertura |
| GET | `/p/email/track/click/:msgId/:linkHash` | Redirect com track |

### Webhooks (sem auth, validados por secret)

| Método | Rota | Source |
|---|---|---|
| POST | `/webhooks/meta/:tenantSlug` | WhatsApp Cloud API |
| GET | `/webhooks/meta/:tenantSlug` | Meta verification handshake |
| POST | `/webhooks/ses` | Amazon SES bounces/complaints (SNS) |
| POST | `/webhooks/asaas` | Asaas (billing) |

### Super Admin (separado, role `super_admin` global em `users.is_super_admin`)

| Método | Rota |
|---|---|
| GET | `/admin/tenants` |
| GET | `/admin/tenants/:id` |
| POST | `/admin/tenants/:id/suspender` |
| POST | `/admin/tenants/:id/impersonate` |
| GET | `/admin/usage` |
| GET | `/admin/usage/por-tenant` |
| GET | `/admin/usage/por-servico` |
| GET | `/admin/audit` |

## 3. Eventos de webhook

### Da Meta (entrada)

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "{waba_id}",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "phone_number_id": "..." },
        "statuses": [{
          "id": "wamid....",
          "status": "delivered",
          "timestamp": "1747000000",
          "recipient_id": "5511999999999"
        }]
      }
    }]
  }]
}
```

Processamento: identificar tenant pelo `phone_number_id` (lookup em `ConexaoWhatsapp`), atualizar `Mensagem.status` e `statusHistory`, atualizar contadores da campanha.

### Para o tenant (Fase 2)

`POST {webhookUrl}` com payload assinado HMAC-SHA256:
```json
{
  "evento": "mensagem.respondida",
  "tenant_slug": "cardanstencar",
  "campanha_id": "...",
  "contato_id": "...",
  "conteudo": "Tem para 1721 também?",
  "timestamp": "..."
}
```

## 4. Formatos de import CSV

Cabeçalho mínimo:
```
nome,email,telefone,tags
"Auto Viação Urubupunga","compras@urubupunga.com","+5511999999999","cliente-ativo;regiao-oeste"
```

Validações:
- Linhas inválidas vão para um relatório (não bloqueia o import).
- Duplicatas (mesmo email ou mesmo telefone no tenant) → upsert por padrão, com flag para "ignorar".
- Campos custom: aceitar colunas extras, viram chaves no `extras` JSONB.

## 5. Templates de email (MJML simplificado)

Editor de blocos: Hero, Texto, Imagem, Botão, Spacer, Divider, Footer.
Output: MJML armazenado em `templates.mjml`.
Renderização: `mjml2html(mjml, { keepComments: false })` no momento do envio + interpolação Mustache `{{nome}}`, `{{cidade}}`, etc.

## 6. Templates WhatsApp

A plataforma **não** cria templates na Meta — isso é responsabilidade do tenant via Meta Business Manager. A plataforma armazena apenas a referência:

```json
{
  "metaTemplateName": "promocao_barras_direcao_mb",
  "metaLanguage": "pt_BR",
  "variaveis": [
    { "key": "nome", "exemplo": "João" },
    { "key": "produto", "exemplo": "Barra de Direção Curta MB 1418" },
    { "key": "preco", "exemplo": "R$ 487,00" }
  ]
}
```

Biblioteca pré-aprovada por vertical: arquivos JSON em `apps/api/src/modules/templates/biblioteca/` agrupados por nicho (`autopecas/`, `floricultura/`). O tenant clona, edita, submete na Meta dele, depois cadastra a referência aqui.
