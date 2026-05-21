# PRD — Total Campanha

> Product Requirements Document
> Versão 1.0 — maio de 2026
> Autor: João (TotalUtiliti) com apoio de Claude

## 1. Visão e proposta de valor

Plataforma SaaS B2B para PMEs brasileiras dispararem **campanhas promocionais por Email e WhatsApp** a partir de uma base de contatos própria, no modelo **BYOA**: o tenant pluga a própria conta Meta Cloud API (WhatsApp Business Platform) e o próprio remetente de email autenticado (SPF/DKIM/DMARC).

A plataforma cuida de: contatos, segmentação, templates, agendamento, throttling, retries, webhooks de status, inbox de respostas dentro da janela de 24h, analytics, opt-in/opt-out, billing recorrente, conformidade LGPD.

**Por que BYOA:**
- Transfere para o tenant o custo variável (Meta cobra por conversa) e a responsabilidade legal pelo consentimento.
- Reduz risco da plataforma (queima de número, suspensão Meta).
- Permite preço base mais acessível (não precisa precificar conversas no plano).

## 2. Público-alvo (ICP)

PMEs brasileiras com base de contatos B2B ou B2C, que hoje fazem disparo manual (lista de transmissão, planilha + WhatsApp Web):
- Autopeças e distribuidoras industriais (cliente piloto: Cardans Tencar).
- Floriculturas e perfumarias.
- Materiais de construção.
- Óticas, pet shops, papelarias.
- Lojas de roupa de bairro premium.
- Padarias gourmet e empórios.

Tamanho típico: 200 a 10.000 contatos, 2 a 30 funcionários, faturamento R$ 500k a R$ 30M/ano. Já tem WhatsApp Business app no celular do dono ou vendedor.

**Fora do ICP (não competimos):** e-commerce médio/grande que já usa RD Station, HubSpot, Klaviyo, ActiveCampaign; agências de marketing; bancos/seguros (compliance complexo).

## 3. Métricas de sucesso

**Produto:**
- TTV (time to value): do signup ao primeiro disparo enviado em **menos de 30 minutos**.
- Taxa de conclusão do onboarding WhatsApp: **> 60%** (atualmente em outros produtos, ~30%).
- Disparos enviados por tenant ativo: **> 200/mês** após 60 dias.
- Taxa de resposta de campanhas: **> 5%** (benchmark setor).

**Negócio:**
- 20 tenants pagantes em 6 meses.
- MRR R$ 10.000 em 6 meses, R$ 40.000 em 12 meses.
- Churn mensal < 5%.
- NPS > 50.

## 4. Requisitos funcionais por fase

### Fase 1 — MVP vendável (alvo: 8–12 semanas)

**RF-01 Multi-tenancy**
- Cadastro self-service de tenant (CNPJ, razão social, plano free trial 14 dias).
- Cada tenant tem subdomínio próprio (`{slug}.totalcampanha.com.br`) ou path (`/t/{slug}`).
- RLS PostgreSQL em todas as tabelas de domínio.

**RF-02 Usuários e permissões**
- RBAC por tenant: `admin`, `editor_campanha`, `visualizador`.
- Convite por email; senha Argon2id+pepper.
- 2FA opcional via TOTP.

**RF-03 Super Admin (TotalUtiliti)**
- Painel `/super-admin` separado do painel do tenant.
- Lista de tenants, status, MRR, último disparo, uso por tenant.
- **Aba de custos por tenant desde o dia 1** (chamadas Meta, mensagens SES, GPT se vier).
- Impersonate (com audit log) para suporte.

**RF-04 Contatos**
- Importação via CSV (com mapeamento de colunas e detecção de duplicatas).
- Campos fixos: nome, email, telefone (E.164), tags.
- Campos custom por tenant via JSONB (`extras`). Ex.: autopeças quer "frota", floricultura quer "data_aniversario".
- Soft delete + hard delete (LGPD direito ao esquecimento).
- Validação de telefone: lib `libphonenumber-js` formato E.164.
- Validação de email: regex + RFC 5322 + opcional verificação SMTP (lib `email-validator`).

**RF-05 Opt-in / Opt-out**
- Página pública por tenant: `opt-in.totalcampanha.com.br/{slug}`.
- Captura: timestamp, IP, user-agent, origem (URL, QR), versão do termo, canais aceitos (email e/ou WhatsApp).
- Página de opt-out one-click, sem login.
- Link de opt-out obrigatório em todo email (`{{unsubscribe_url}}`).
- WhatsApp: instrução no template + tratamento da palavra `SAIR` / `STOP` no inbox.

**RF-06 Segmentação**
- Filtros AND/OR sobre tags, campos custom, opt-in status, data de último engajamento, região (UF).
- Salvar segmentos nomeados.
- Visualizar contagem em tempo real.

**RF-07 Templates**
- **Email:** editor MJML simplificado + variáveis (`{{nome}}`, `{{cidade}}`, etc.) + preview desktop/mobile.
- **WhatsApp:** o tenant cadastra apenas **nome do template + variáveis esperadas**. A aprovação Meta é feita por ele (Meta Business Manager). Plataforma valida que o template existe quando ele tenta usá-lo (chamada GET à API Meta).
- Biblioteca de templates pré-aprovados por vertical (autopeças, floricultura) que o tenant clona e submete na conta dele.

**RF-08 Conexões (BYOA)**
- Tela de "Conexões" no painel do tenant.
- **WhatsApp:** tenant cola `WABA ID`, `Phone Number ID`, `Token permanente` (criptografado em pgcrypto). Plataforma testa conexão (chama `/v18.0/{phone_number_id}` da Meta) antes de salvar.
- **Email:** tenant configura remetente e domínio. Plataforma fornece SPF/DKIM/DMARC necessários. Verificação automática de DNS.
- Webhook secret gerado pela plataforma, instrução para configurar na Meta.

**RF-09 Campanhas**
- Criar campanha: nome, segmento, canal(is), template, agendamento (imediato ou futuro), janela de envio (ex.: só 9h–18h em dias úteis).
- Estimativa de custo antes de confirmar (R$ X em Meta + R$ Y em SES).
- Disparo controlado por BullMQ com rate-limiting respeitando tier do tenant na Meta (250/dia, 1k, 10k, 100k).

**RF-10 Disparo e status**
- Workers BullMQ processam jobs.
- Webhooks Meta recebem `sent / delivered / read / failed / replied`.
- Estado por mensagem armazenado em `mensagens(tenant_id, campanha_id, contato_id, canal, status, status_history, provider_message_id)`.

**RF-11 Inbox de respostas (janela 24h WhatsApp)**
- Quando contato responde, sistema abre conversa.
- Tenant responde dentro da janela 24h sem precisar de novo template.
- Notificação por email para o tenant quando chega resposta.

**RF-12 Analytics**
- Dashboard por campanha: enviadas, entregues, lidas, respondidas, opt-out, falhas, custo estimado.
- Comparação entre campanhas.
- Export CSV.

**RF-13 Billing**
- Stripe ou Asaas (preferência Asaas para brasileiros pela facilidade de boleto/Pix).
- Planos: Starter R$ 197, Pro R$ 497, Enterprise R$ 1.497/mês.
- Setup assistido WhatsApp: R$ 997 one-time.
- Trial 14 dias sem cartão.

### Fase 2 (3–6 meses depois)

- Automações por gatilho (aniversário, X dias sem compra).
- Catálogo de produtos com fotos (Blob Storage), para reuso em campanhas.
- A/B testing de templates.
- Integração com ERPs comuns (Bling, Tiny, Omie) para import automático de contatos.
- Multi-número WhatsApp no mesmo tenant.
- Webhooks para o tenant (notificação de respostas no sistema dele).

### Fase 3

- IA gera sugestões de copy via Azure OpenAI (reusar `gpt-52-chat`).
- Segmentação por embedding (recomenda público para uma campanha baseado em histórico de engajamento).
- App mobile para responder inbox.
- Marketplace de templates verticais.

## 5. Requisitos não-funcionais

- **Disponibilidade:** 99.5% em PROD (Container Apps zone-redundant + PostgreSQL HA).
- **Latência API:** p95 < 300ms para endpoints CRUD; disparo assíncrono via fila.
- **Escala:** suportar 100 tenants ativos enviando 10k mensagens/dia cada (1M msg/dia total).
- **LGPD:** DPA com tenants, política pública, log de consentimento imutável, direito ao esquecimento <24h.
- **Backup:** PostgreSQL GP com geo-redundant backup 35 dias + PITR.
- **Observabilidade:** Application Insights com traces; alertas no Slack para erros >1%/min.

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Onboarding WhatsApp Meta é gargalo (tenant desiste) | Setup assistido pago + vídeo tutorial + biblioteca pré-aprovada |
| Tenant queima o próprio número Meta com má prática | Educação no onboarding + alertas automáticos no painel (quality rating) |
| Concorrentes (Octadesk, WATI, Disparo Pro) | Foco em PME tradicional B2B brasileira + suporte humano em pt-BR + integração com ERPs nacionais |
| Custo Azure escapa em escala | Painel de custo por tenant + alertas de budget + autoscaling com teto |
| LGPD: vazamento de base do tenant | RLS + criptografia em repouso + auditoria de acesso + segregação tenant |
| Spam-trap derruba IP SES | BYOA para email já desde o MVP (tenant usa próprio domínio) |
