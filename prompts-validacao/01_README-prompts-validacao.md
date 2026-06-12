# 📁 ÍNDICE — Prompts de Validação Pré-Produção

> **Escopo:** Qualquer projeto TotalUtiliti (NestJS + Next.js + PostgreSQL + Azure)
> **Formato:** Cada prompt tem classificação automática — o Claude Code (Antigravity)
> lê o bloco no topo, analisa o projeto, e sabe exatamente quais seções aplicar.
> **Status:** ✅ 22/22 prompts criados
> **Última atualização:** 2026-03-15

---

## COMO USAR ESTA PASTA

```
1. Copie esta pasta para a raiz do repositório do projeto
2. No CLAUDE.md do projeto, adicione:
   "Referência de validação: ver pasta prompts-validacao/"
3. Antes de cada deploy para produção:
   → O Antigravity lê cada prompt
   → Analisa o projeto (entidades, endpoints, infra)
   → Aplica APENAS as seções relevantes (classificação automática)
   → Reporta o que está OK e o que precisa de ação

Cada prompt tem um bloco 🔍 CLASSIFICAÇÃO AUTOMÁTICA no topo.
O Antigravity lê, decide o que se aplica, e ignora o resto.
Não é necessário ler todos os 22 manualmente.
```

---

## ESTRUTURA

### CAMADA 1 — SEGURANÇA DE DADOS

| # | Arquivo | Cobre | Status |
|---|---------|-------|--------|
| 01 | `01-senhas-e-segredos.md` | Argon2id+pepper, Key Vault, Managed Identity, rotação | ✅ |
| 02 | `02-gitignore-e-protecao-codigo.md` | .gitignore, gitleaks, Push Protection, scan histórico | ✅ |
| 03 | `03-lgpd-e-dados-pessoais.md` | LGPD completa, bases legais, direitos titulares, ROPA, DPA, incidentes ANPD | ✅ |
| 04 | `04-criptografia-e-dados-em-repouso.md` | TLS, AES-256, criptografia de coluna, arquivos, CMK | ✅ |

### CAMADA 2 — AUTENTICAÇÃO E AUTORIZAÇÃO

| # | Arquivo | Cobre | Status |
|---|---------|-------|--------|
| 05 | `05-autenticacao-e-login.md` | Login, JWT, refresh token, rate limiting, MFA, recuperação de senha | ✅ |
| 06 | `06-rbac-e-multitenancy.md` | RBAC deny-by-default, RLS, guards, isolamento cross-tenant, audit | ✅ |
| 07 | `07-variaveis-de-ambiente.md` | .env.example, validação Zod, hierarquia de config | ✅ |

### CAMADA 3 — INFRAESTRUTURA E DEPLOY

| # | Arquivo | Cobre | Status |
|---|---------|-------|--------|
| 08 | `08-docker-seguro.md` | Multi-stage, non-root, .dockerignore, scan Trivy | ✅ |
| 09 | `09-postgresql-hardening.md` | Roles, SSL, RLS, firewall, auditoria, connection pooling | ✅ |
| 10 | `10-azure-container-apps.md` | HTTPS, CORS, Managed Identity, Key Vault, health probes | ✅ |
| 11 | `11-ci-cd-e-deploy-seguro.md` | Pipeline, scan, deploy order, rollback, aprovação prod | ✅ |

### CAMADA 4 — APLICAÇÃO E API

| # | Arquivo | Cobre | Status |
|---|---------|-------|--------|
| 12 | `12-api-security.md` | Helmet, CORS, validation, rate limiting, SQL injection, error handling | ✅ |
| 13 | `13-tratamento-de-erros.md` | Exception filter, retry, graceful shutdown, error boundaries | ✅ |
| 14 | `14-upload-e-processamento-arquivos.md` | MIME validation, UUID naming, Blob Storage, OCR seguro | ✅ |

### CAMADA 5 — OBSERVABILIDADE E OPERAÇÃO

| # | Arquivo | Cobre | Status |
|---|---------|-------|--------|
| 15 | `15-logging-e-auditoria.md` | JSON estruturado, mascaramento, audit trail, correlação | ✅ |
| 16 | `16-monitoramento-e-alertas.md` | Health check, alertas 5xx, FinOps, uptime, SLO | ✅ |
| 17 | `17-backup-e-disaster-recovery.md` | Backup PostgreSQL/Blob, RPO/RTO, teste de restore, plano DR | ✅ |
| 18 | `18-plano-de-resposta-a-incidentes.md` | Playbooks, notificação LGPD, post-mortem, contatos emergência | ✅ |

### CAMADA BÔNUS — QUALIDADE E MATURIDADE

| # | Arquivo | Cobre | Status |
|---|---------|-------|--------|
| 19 | `19-testes-de-seguranca.md` | Testes auth, RBAC, RLS cross-tenant, input validation, error exposure | ✅ |
| 20 | `20-frontend-seguro.md` | Tokens, CSP, XSS, localStorage, cookies seguros | ✅ |
| 21 | `21-documentacao-e-onboarding.md` | README, CLAUDE.md, Swagger, runbook | ✅ |
| 22 | `22-contrato-e-sla.md` | ToS, SLA, DPA, política de privacidade, material comercial | ✅ |

---

## TAGS DE CLASSIFICAÇÃO

Os prompts usam tags para indicar quando cada seção se aplica:

| Tag | Quando se aplica |
|-----|------------------|
| `[UNIVERSAL]` | Todo projeto |
| `[FINANCEIRO]` | Dados financeiros, fiscais, bancários |
| `[SENSÍVEL]` | Dados de saúde, biometria, religião (LGPD Art. 11) |
| `[MENORES]` | Dados de crianças/adolescentes |
| `[TRANSFERÊNCIA]` | Dados enviados para fora do Brasil (OpenAI, etc.) |
| `[MULTI-TENANT]` | SaaS com múltiplos clientes na mesma instância |
| `[SUPER-ADMIN]` | Admin da plataforma que gerencia todos os tenants |
| `[MFA]` | Multi-factor authentication necessário |
| `[API-AUTH]` | API consumida por sistemas externos |
| `[CMK]` | Customer-managed encryption keys |
| `[DADOS-PESSOAIS]` | Upload/processamento de documentos com dados pessoais |
| `[DPA]` | Contrato de processamento de dados obrigatório |
| `[LGPD-LOG]` | Logging com requisitos LGPD |
| `[LGPD-INCIDENTE]` | Notificação de incidentes à ANPD |

---

## COMO O ANTIGRAVITY USA ESTA PASTA

```
1. Lê o CLAUDE.md do projeto → entende contexto
2. Lê o README.md desta pasta → entende a estrutura
3. Para cada prompt (01-22):
   a. Lê o bloco CLASSIFICAÇÃO AUTOMÁTICA
   b. Analisa o projeto (tabelas, endpoints, infra, dependências)
   c. Decide quais níveis se aplicam
   d. Aplica as seções marcadas com as tags relevantes
   e. Ignora seções que não se aplicam
4. Reporta: o que está conforme, o que precisa de ação
```

---

> **Esta pasta é um ativo vivo.** Atualize conforme novos padrões,
> novas regulamentações ou novos tipos de projeto surgirem.
