# 01 — Inventário funcional

## Escopo e classificação da evidência

Este inventário foi obtido por inspeção estática da branch `dev` no commit `34f7d15f98a09ee753ae43fa8e6f8ff054095193`. Não houve navegação em runtime. Marcadores usados:

- **Fato:** observado no código, schema, IaC ou configuração versionada.
- **Inferência:** conclusão técnica sustentada por fatos, ainda sem teste runtime.
- **Hipótese:** exige ambiente, dados ou decisão humana.
- **Risco confirmado:** mecanismo defeituoso demonstrável no código.
- **Decisão pendente:** escolha de produto/comercial que não deve ser tomada pela auditoria.

## Inventário inicial

| Item             | Fato observado                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Linguagem        | TypeScript; SQL de migrations; Bicep; Shell/PowerShell; JSON/YAML/Markdown                                                                      |
| Monorepo         | pnpm workspaces + Turborepo                                                                                                                     |
| Frontend         | Next.js 14 App Router, React 18, Tailwind, componentes próprios inspirados em shadcn/ui                                                         |
| API              | NestJS 10, Zod/nestjs-zod, Swagger em dev/staging, Pino, Helmet                                                                                 |
| Worker           | NestJS + BullMQ; processadores de email, WhatsApp, webhooks, importação, retry, trial e verificação SES                                         |
| Banco            | PostgreSQL 16, Prisma 5.22, `pgcrypto`, RLS com `ENABLE`/`FORCE` nas tabelas tenant-scoped listadas                                             |
| Cache/filas      | Redis/ioredis/BullMQ                                                                                                                            |
| Email            | SMTP local/MailHog e Amazon SES; `resend` consta no env da API, mas cai para SMTP e não está implementado                                       |
| WhatsApp         | Meta WhatsApp Cloud API oficial, BYOA manual por tenant                                                                                         |
| Billing          | Asaas implementado com modo stub em DEV; Stripe só aparece no `.env.example`                                                                    |
| Auth             | Argon2id + pepper, JWT access/refresh, refresh em cookie HttpOnly, Redis para rotação, TOTP, RBAC por tenant                                    |
| Arquivos/imagens | Importação CSV/XLSX é convertida no cliente; não existe upload de catálogo/imagem. Blob Storage existe no IaC, sem jornada funcional encontrada |
| Infra            | Azure Container Apps, PostgreSQL Flexible Server, Redis, Storage, Key Vault, ACR, Log Analytics/App Insights; perfis completo e lean            |
| Ambientes        | development, test, staging e production no schema de env; DEV e PROD documentados; estado real não validado                                     |
| Configuração     | `.env.example` amplo; `.env` local ignorado; Key Vault/secret refs descritos no IaC                                                             |
| Testes           | Duas suítes TypeScript: RLS e isolamento de sete entidades. API/worker sem unitários encontrados; frontend sem Playwright/config/spec           |
| CI/CD            | GitHub Actions para CI, gitleaks, anti-regressão, deploy de três apps e tag PROD                                                                |
| Documentação     | PRD, arquitetura, specs, regras, bootstrap, UX, runbooks e instruções operacionais extensos; divergências com código/IaC foram encontradas      |

## Perfis de usuário

| Perfil                  | Capacidades encontradas                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `ADMIN` do tenant       | Configura conexões, contatos/importação, grupos, mensagens, campanhas, billing e ações destrutivas |
| `EDITOR_CAMPANHA`       | Cria/edita conteúdo e contatos; várias ações administrativas são negadas no backend                |
| `VISUALIZADOR`          | Leitura de campanhas, templates, segmentos, conexões e analytics                                   |
| Super Admin             | Gestão básica de tenants, suspensão, impersonação, custos e auditoria global                       |
| Titular/contato público | Opt-in por tenant e opt-out por token                                                              |

## Funcionalidades

| Funcionalidade              | Objetivo/perfil/caminho                                                                                        | Telas e APIs                                                                                            | Dados/integrações/permissões                                      | Estado, inconsistências e reutilização                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação                | Entrar, recuperar senha, selecionar empresa e usar TOTP; todos; `/login`, `/esqueci-senha`, `/redefinir-senha` | `/auth/login`, `select-tenant`, `refresh`, `logout`, `forgot`, `reset`, `senha`, `2fa/*`; signup só API | User, UserTenant, Tenant; Redis; rotas públicas/guard JWT         | **Parcial/NV.** Sem signup UI, confirmação de email, gestão de sessões ou UI de 2FA. `ARC-002`, `SEC-003/004`                                     |
| Dashboard/onboarding        | Orientar primeira campanha; usuário tenant; `/`                                                                | Busca conexões, contatos, templates e campanhas                                                         | Todos os domínios; qualquer papel autenticado                     | **Implementado/NV.** Checklist claro, mas falhas viram zero/vazio (`UX-007`)                                                                      |
| Contatos                    | CRUD, busca, tags, opt-in/out e LGPD; tenant; `/contatos/*`                                                    | CRUD, importar e exportar                                                                               | Contato, OptInLog, Mensagem; ADMIN/EDITOR, export ADMIN           | **Parcial.** UI limita-se a 200 sem paginação; export backend sem CTA; hard delete incompleto (`PRIV-004`, `UX-004`)                              |
| Importação                  | Carregar planilha, mapear colunas, preview e upsert; ADMIN; `/contatos/importar`                               | `POST /contatos/importar`                                                                               | CSV/XLSX no cliente, Redis/worker                                 | **Aparentemente funcional.** Fluxo UX forte; PII no Redis, N queries e limites frágeis (`PERF-003`, `UPLOAD-001`, `PRIV-005`)                     |
| Grupos/segmentos            | Definir público por filtros; `/segmentos`, `/segmentos/novo`                                                   | CRUD, prévia, contagem/lista/previsão                                                                   | Segmento/Contato; ADMIN/EDITOR mutam, todos leem                  | **Parcial.** Backend edita/detalha, UI só cria/exclui e expõe `extras.*` (`UX-005`)                                                               |
| Mensagens/templates         | Criar email MJML ou referência Meta; `/templates/*`                                                            | CRUD, preview; biblioteca, aprovados Meta e teste só no backend                                         | Template, Meta; ADMIN/EDITOR mutam                                | **Parcial.** Editor email é técnico; biblioteca/teste/validação Meta sem UI (`PROD-005`)                                                          |
| Campanhas                   | Criar, estimar, agendar/disparar, pausar/cancelar e medir; `/campanhas/*`                                      | CRUD, estimativa, disparo, pausa, cancelamento, analytics                                               | Campanha, Mensagem, Segmento, Template, filas, Meta/SES, UsageLog | **Parcial e não seguro para comercialização.** Sem confirmação/edição de rascunho; duplicidade/atomicidade/race (`ARC-001/003/006`, `UX-001/002`) |
| Inbox/respostas             | Atender respostas WhatsApp dentro de 24h; `/respostas`                                                         | conversas, mensagens, responder                                                                         | InboxConversa/Mensagem, Contato, Meta                             | **Aparentemente funcional/NV.** Polling 30s; mobile ruim; eventos duplicáveis; resposta paga sem usage completo                                   |
| Conexão WhatsApp            | BYOA manual; `/conexoes`, `/conexoes/whatsapp/novo`                                                            | criar, listar, patch/delete/testar/enviar teste                                                         | ConexaoWhatsapp, Meta; ADMIN configura                            | **Parcial.** UI só cria/lista; wizard exige token/WABA/phone ID/webhook; sem Embedded Signup (`WA-001`, `UX-003`)                                 |
| Conexão Email               | Verificar domínio/remetente; `/conexoes/email/novo`                                                            | criar, listar, verificar, delete                                                                        | ConexaoEmail, SES/DNS                                             | **Parcial.** Configuração cadastrada não é usada no dispatcher (`EMAIL-001`); sem feedback SES (`EMAIL-002`)                                      |
| Billing/plano               | Trial, assinar, mudar e cancelar; `/plano`                                                                     | `/billing/*`, webhook Asaas                                                                             | Tenant/Asaas; ADMIN muta                                          | **Parcial.** Preços divergentes, limites não aplicados e idempotência insuficiente (`PROD-004`, `BILL-001`)                                       |
| Minha conta                 | Ver identidade/papel e trocar senha; `/minha-conta`                                                            | `/me`, `/auth/senha`                                                                                    | User/UserTenant                                                   | **Parcial.** Sem editar perfil/empresa, sessões, 2FA, export/exclusão de conta                                                                    |
| Manual                      | Ajuda contextual; `/manual`                                                                                    | Conteúdo local                                                                                          | Sem integração                                                    | **Parcial.** “Captura de tela em breve” (`UX-008`)                                                                                                |
| Opt-in público              | Registrar consentimento por canal; `/p/opt-in/[tenantSlug]`                                                    | `/p/opt-in/:tenantSlug` GET/POST                                                                        | Contato/OptInLog, reCAPTCHA, email                                | **Implementado com riscos.** Sem double opt-in; merge de identidade e prova administrativa insuficientes (`PRIV-001/002/003`)                     |
| Opt-out público             | Descadastro email/WA; `/p/opt-out/[token]`                                                                     | GET/POST `/p/opt-out/:token`                                                                            | Contato/OptInLog                                                  | **Implementado.** GET muta estado e pode ser pré-carregado; WhatsApp também reconhece palavras de saída (`EMAIL-003`)                             |
| Analytics                   | Indicadores globais e por campanha                                                                             | UI só por campanha; `/analytics/dashboard`, `/comparativo` backend                                      | Campanha/Mensagem/UsageLog                                        | **Parcial.** Backend global sem UI; consultas live crescerão (`PROD-005`, `PERF-004`)                                                             |
| Super Admin                 | Operar plataforma; `/admin/*`                                                                                  | tenants, suspensão, impersonação, usage e audit                                                         | Conexão privilegiada, Tenant/User/Usage/Audit                     | **Parcial.** Sem reativação/edição, usuários, filas/saúde, incidentes, feature flags, suporte/limites; sessão privilegiada frágil                 |
| Catálogo/produtos/promoções | Promessa descrita para o produto                                                                               | Nenhuma tela/API/model                                                                                  | Nenhum model Produto/Imagem/Promoção                              | **Ausente confirmado.** Bloqueador `PROD-001`; decisão de posicionamento pendente                                                                 |

## Backend sem UI e UI sem jornada completa

- Backend sem superfície: analytics global/comparativo; biblioteca de templates; templates aprovados Meta; envio de teste; patch/delete/teste de conexões; exportação de contatos; edição/detalhe de segmentos; signup e setup/verify 2FA.
- UI parcialmente atendida: editar campanha/segmento, gerir usuários/convites, editar empresa, reativar tenant, diagnosticar filas/provedores e visualizar supressões.
- Nenhum botão totalmente inerte foi confirmado por inspeção; várias ações terminam em 403 porque a UI não reflete o papel (`UX-006`).

## Hardcodes e dependência do piloto

- Templates/seed contêm exemplos de autopeças e referência ao cliente piloto; a biblioteca genérica deve ser neutralizada (`PROD-006`).
- O modelo CSV comenta utilizar exemplos de clientes reais; a origem precisa ser validada sem reproduzir valores (`PRIV-005`).
- Marca alterna “Total Utiliti” e “Total Campanha”; domínio/remetente global ainda aparece como fallback.

## Jornadas principais e estado

1. **Receber acesso → login → selecionar empresa:** parcial; acesso ainda é provisionado manualmente.
2. **Conectar canal → importar contatos → criar grupo → template → campanha:** implementada estaticamente, não validada end-to-end.
3. **Revisar público/custo → enviar → acompanhar → pausar/cancelar:** revisão existe, mas envio não é seguro por confirmação/idempotência.
4. **Resposta WhatsApp → inbox → responder em 24h:** implementada estaticamente, com risco de replay e limitação móvel.
5. **Opt-in/out e exclusão:** existem, mas prova/retensão/anonimização são incompletas.
6. **Catálogo → promoção → campanha:** inexistente.

## Áreas não validadas

- Runtime, visual, responsividade, contraste computado, teclado/leitor de tela e latência.
- Configuração efetiva e dados de PROD, Azure, roles PostgreSQL e métricas de volume/custo.
- Meta/SES/Asaas reais, DNS, deliverability, templates aprovados e webhooks ao vivo.
- Conteúdo/origem de possíveis exemplos reais; nenhum valor foi copiado.
