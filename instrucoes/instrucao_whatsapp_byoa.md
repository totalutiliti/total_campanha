# instrucao_whatsapp_byoa.md — Total Campanha

> Operação da integração WhatsApp Cloud API no modelo BYOA (Bring Your Own Account).
> Audiência: Antigravity (código), suporte TotalUtiliti (atendimento ao tenant), tenants (tutorial).

## 1. Visão geral

No modelo BYOA, **cada tenant** tem a **própria conta** Meta Business Manager + WABA + Phone Number + Token. A plataforma Total Campanha apenas **orquestra** o envio usando essas credenciais. Implicações:

- O **custo Meta** é cobrado direto do tenant (cartão na conta Meta dele).
- A **responsabilidade LGPD** sobre os contatos é do tenant.
- O **tier Meta** (250/1k/10k/100k/dia) é da conta dele, não da plataforma.
- A **suspensão Meta** por má prática afeta só o tenant em questão.

Esse é o diferencial estratégico do produto — transferimos o risco e o custo variável.

## 2. Pré-requisitos para o tenant (antes do onboarding)

Antes de prosseguir, o tenant **precisa ter**:

1. **CNPJ ativo** (Meta exige para Business Verification).
2. **Conta Meta Business Manager verificada** ([business.facebook.com](https://business.facebook.com)).
   - Documentação enviada e aprovada.
   - Pode levar 1-7 dias úteis a primeira vez.
3. **Número de telefone dedicado** para WhatsApp Business (não pode estar em uso no WhatsApp pessoal nem no WhatsApp Business app).
   - Recomendação: linha móvel ou SMS-capable. Pode ser número fixo se receber SMS/chamada para verificação.
4. **WABA (WhatsApp Business Account)** criada no Meta Business Manager.
5. **Phone Number** adicionado à WABA (passa por verificação SMS/voz).
6. **Display Name** aprovado pela Meta (1-3 dias úteis).
7. **Cartão de crédito** vinculado à conta Meta (para cobrança de conversas marketing).

Validação rápida:
> "Você consegue mandar uma mensagem template via Meta Business Manager neste momento? Se não, primeiro precisamos resolver isso."

## 3. Setup assistido — fluxo de atendimento

Plano sugerido (também é uma oferta paga: **R$ 997 one-time**):

### 3.1. Reunião 1 — Diagnóstico (30 min)

- Checar os 7 pré-requisitos acima
- Identificar gaps e quem resolve cada um (geralmente o cliente precisa fornecer documentos)
- Definir prazo

### 3.2. Acompanhar verificação Meta (1-7 dias, assíncrono)

- Tenant envia documentos no Meta Business Manager
- TotalUtiliti acompanha por dashboard compartilhado (ou prints periódicos)

### 3.3. Reunião 2 — Geração do token e configuração na plataforma (45 min)

- Gerar System User Token permanente (passo a passo abaixo)
- Plugar no painel Total Campanha
- Configurar webhook
- Testar envio para o próprio celular do tenant
- Cadastrar 1-2 templates da biblioteca pré-aprovada

### 3.4. Reunião 3 — Primeira campanha real (60 min)

- Importar contatos (com validação de opt-in)
- Criar segmento piloto (20-50 contatos, não a base toda)
- Disparar
- Acompanhar métricas em tempo real
- Discutir próximos passos

## 4. Como gerar System User Token permanente

> Crítico: token de usuário comum **expira em 60 dias**. System User Token de admin **não expira**.
> Passo a passo abaixo é o que o tenant precisa fazer dentro da conta Meta dele.

### 4.1. Criar System User

1. Acessar [business.facebook.com](https://business.facebook.com) → Configurações da empresa.
2. Menu "Usuários" → "Usuários do sistema" → "Adicionar".
3. Nome: `Total Campanha Integration`
4. Função: **Admin**
5. Salvar.

### 4.2. Atribuir ativos ao System User

1. Selecionar o System User criado.
2. "Adicionar ativos" → escolher a WABA.
3. Permissões necessárias: **Controle total** (full control) sobre a WABA.

### 4.3. Gerar token

1. Com System User selecionado, clicar "Gerar novo token".
2. **App:** selecionar o app da plataforma (se não tem, criar um app em [developers.facebook.com](https://developers.facebook.com) — pode ser app interno).
3. **Permissões/Scopes** obrigatórios:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. **Validade:** "Nunca" (System User permanente).
5. **Copiar token** (só é mostrado uma vez).

### 4.4. Obter IDs

- **WABA ID:** Configurações da empresa → Contas → WhatsApp accounts → selecionar → ID aparece na URL ou em detalhes.
- **Phone Number ID:** Meta Business Manager → WhatsApp Manager → selecionar número → Phone Number ID está em "Configurações > API".
- **App ID:** Meta Developers → seu app → Configurações > Básico.

Anotar tudo. Esses 3 IDs + Token vão para o painel Total Campanha.

## 5. Cadastro na plataforma (lado do tenant)

No painel `/conexoes/whatsapp`:

```
WABA ID:           __________________
Phone Number ID:   __________________
Token permanente:  __________________
```

Botão **"Testar conexão"** → plataforma:
1. Chama `GET https://graph.facebook.com/v22.0/{phone_number_id}?fields=display_phone_number,verified_name,quality_rating` com `Bearer {token}`.
2. Se HTTP 200 e response inclui `display_phone_number`, salva e marca como ATIVA.
3. Se 401/403 → erro "Token inválido ou sem permissão para esse número".
4. Se 404 → erro "Phone Number ID não encontrado nesta conta".

**Importante:** plataforma criptografa o token com pgcrypto antes de gravar. Token nunca aparece em log nem na resposta da API (`GET /conexoes/whatsapp` retorna `tokenPreview: "...XYZ4"`).

## 6. Configurar webhook na Meta (do lado do tenant)

Plataforma gera, para cada tenant:
- **Callback URL:** `https://api.totalcampanha.com.br/api/v1/webhooks/meta/{tenantSlug}/{webhookSecret}`
- **Verify Token:** valor de `webhook_secret` na tabela (32 bytes hex).

> O secret faz parte da URL desde 06/2026: é a autenticação do POST de eventos
> (a Meta não assina o payload sem App Secret por tenant, e o slug é público —
> aparece na página de opt-in). POST com secret errado é descartado em silêncio
> (200 sem processar); handshake errado falha alto (403) para o tenant ver na
> hora que configurou errado.

No Meta Developers > app > WhatsApp > Configuração:
1. **Callback URL:** colar URL acima.
2. **Verify Token:** colar o secret.
3. **Verificar e salvar.** Meta chama `GET {url}?hub.mode=subscribe&hub.verify_token={secret}&hub.challenge={x}`. Plataforma valida e retorna `{x}`. Meta marca como verified.
4. **Subscribe to fields:** `messages`, `message_template_status_update`, `account_update`.

## 7. Templates WhatsApp

### 7.1. Categorias Meta

- **MARKETING** — promocional. Exige opt-in, cobrança por conversa.
- **UTILITY** — transacional (ex.: status de pedido). Custo menor, sem opt-in obrigatório.
- **AUTHENTICATION** — OTP.

Para Total Campanha, foco é **MARKETING** (campanhas promocionais). Cada template precisa ser:
1. **Submetido pelo tenant** na conta Meta dele.
2. **Aprovado pela Meta** (24-48h, mas pode demorar mais).
3. **Categoria correta** (se Meta achar que está mal categorizado, recategoriza).

### 7.2. Biblioteca pré-aprovada (diferencial Total Campanha)

Pasta `apps/api/src/modules/templates/biblioteca/` com JSONs por vertical:

```
biblioteca/
├── autopecas/
│   ├── promocao-produto-frota.json
│   ├── lancamento-aplicacao.json
│   └── liquidacao-estoque.json
├── floricultura/
│   ├── dia-das-maes-buque.json
│   ├── aniversariante-do-mes.json
│   └── arranjo-funeral.json
├── perfumaria/
│   └── ...
└── materiais-construcao/
    └── ...
```

Estrutura de cada arquivo:

```json
{
  "vertical": "autopecas",
  "nome_sugerido": "promocao_produto_frota_mb",
  "categoria_meta": "MARKETING",
  "idioma": "pt_BR",
  "corpo": "Olá {{1}}, temos {{2}} disponível por {{3}} — ideal para sua frota. Confira: {{4}}",
  "variaveis": [
    { "key": "nome", "exemplo": "Adauto" },
    { "key": "produto", "exemplo": "Barra de Direção Curta MB 1418" },
    { "key": "preco", "exemplo": "R$ 487,00" },
    { "key": "link", "exemplo": "https://wa.me/p/123" }
  ],
  "rodape": "Responda SAIR para não receber mais.",
  "notas": "Aprovado em conta-teste em mar/2026. Submeter sem alterações para alta chance de aprovação."
}
```

UI: tenant escolhe biblioteca → clica "Usar este template" → plataforma mostra instrução de como submeter no Meta Business Manager (copy + paste).

## 8. Tiers Meta e throttling

| Tier | Mensagens marketing iniciadas/dia |
|---|---|
| TIER_50 | 50 (sandbox / nova conta sem display name aprovado) |
| TIER_250 | 250 (padrão após display name aprovado) |
| TIER_1K | 1.000 |
| TIER_10K | 10.000 |
| TIER_100K | 100.000 |
| TIER_UNLIMITED | sem limite |

Promoções de tier acontecem automaticamente pela Meta baseado em:
- Volume enviado nos últimos 7 dias
- Quality rating (verde/amarelo/vermelho)

**Atualização no nosso sistema:**
- Webhook Meta com field `account_update` traz mudanças de tier
- Processador atualiza `conexoes_whatsapp.tier_meta`
- BullMQ rate limiter recalcula throttling no próximo job

**Throttling BullMQ:**

```typescript
const tierLimits = {
  TIER_50:        { perMinute: 5,    burst: 10 },
  TIER_250:       { perMinute: 10,   burst: 50 },
  TIER_1K:        { perMinute: 40,   burst: 200 },
  TIER_10K:       { perMinute: 400,  burst: 2000 },
  TIER_100K:      { perMinute: 4000, burst: 20000 },
  TIER_UNLIMITED: { perMinute: 10000, burst: 50000 }, // teto nosso por sanidade
};
```

## 9. Quality Rating

Meta atribui rating ao número:
- **Green:** Healthy. Sem problemas.
- **Yellow:** Quality drop. Vários blocks/denúncias recentes. Risco se piorar.
- **Red:** Low quality. Risco iminente de suspensão.

Webhook traz updates. Plataforma exibe no painel:
- **Verde:** sem ação.
- **Amarelo:** banner no painel — "Atenção: qualidade do seu número caiu. Revise: 1) os destinatários estão dando opt-in real? 2) seus templates estão sendo recebidos como spam? Considere pausar campanhas marketing por 7 dias e enviar só utility."
- **Vermelho:** banner crítico + bloqueio automático de novas campanhas marketing (utility ainda permitido) até voltar para amarelo/verde.

## 10. Códigos de erro Meta — mapeamento

Webhook ou response da API podem retornar `error.code`. Mapeamento:

| Código Meta | Causa | falhaMotivo legível | Retryable? |
|---|---|---|---|
| 130429 | Rate limit | Limite Meta atingido | Sim, backoff longo |
| 131000 | Generic error | Erro genérico Meta | Sim, retry padrão |
| 131005 | Permission denied | Token sem permissão | Não — pausa conexão |
| 131008 | Phone number not registered | Número não cadastrado | Não |
| 131009 | Bad parameter | Parâmetro inválido | Não — bug nosso |
| 131016 | Service unavailable | Meta fora do ar | Sim |
| 131021 | Recipient cannot be sender | Mesmo número | Não |
| 131026 | Message undeliverable | Destinatário sem WhatsApp | Não |
| 131031 | Account locked | Conta Meta bloqueada | Não — pausa conexão + alerta |
| 131045 | Not registered for business | Número não business | Não — pausa |
| 131047 | 24h window expired | Janela 24h fechou (usar template) | Não |
| 131051 | Unsupported message type | Tipo não suportado | Não — bug nosso |
| 131056 | Pair rate limit | Rate por par sender-recipient | Sim, longo |
| 132000 | Template doesn't exist | Template não existe na conta Meta | Não — pausa campanha |
| 132001 | Template wrong language | Idioma errado | Não |
| 132005 | Template hydrated text too long | Variável muito longa | Não — bug nosso |
| 132007 | Template format mismatch | Variáveis não batem | Não |
| 132012 | Param format mismatch | Param errado | Não |
| 132015 | Template paused | Template pausado pela Meta | Não — alerta tenant |
| 132016 | Template disabled | Template desativado | Não — alerta tenant |
| 132068 | Flow blocked | Bloqueio temporário | Sim, longo |
| 133000 | Decryption error | Erro WhatsApp | Sim |

## 11. Tratamento de "Acesso bloqueado" / suspensão

Se Meta suspende o tenant (rating vermelho persistente, denúncias excessivas, violação de termos):
- Webhook traz `account_update` com `status='disabled'`.
- Plataforma marca `conexoes_whatsapp.status = 'SUSPENSA'`.
- Bloqueia novos disparos.
- Notifica tenant por email com instruções de appeal Meta.
- Tenant precisa resolver com a Meta diretamente. TotalUtiliti não tem como apelar pelo tenant.

## 12. Versão da API Meta

- Versão fixada: **`v22.0`** (atual em maio/2026)
- Verificar na release de cada deploy: [https://developers.facebook.com/docs/whatsapp/cloud-api/changelog](https://developers.facebook.com/docs/whatsapp/cloud-api/changelog)
- Meta marca versões como "deprecated" e dá ~2 anos para migrar
- Em config: `META_API_VERSION=v22.0` (env var, fácil bumpar)

## 13. Validação manual periódica (mensal)

Operações que cada tenant ATIVO deve passar mensalmente (Antigravity pode automatizar):

```bash
# Job recorrente: para cada tenant com ConexaoWhatsapp ATIVA
# 1. Re-validar conexão (GET /v22.0/{phone_number_id})
# 2. Atualizar quality_rating e tier_meta no banco
# 3. Se status mudou (atualização que não veio por webhook), notificar
# 4. Se token rejeitado (401), marcar ERRO + email para tenant
```

Job BullMQ recorrente `revalidar-conexoes-whatsapp`, agendado para rodar diariamente às 3h da manhã (horário Brasil), distribuído ao longo de 1h (não bater Meta de uma vez).

## 14. Resumo para tenant (1-pager para enviar)

```
WhatsApp na Total Campanha — Como funciona

✅ Você usa SEU número WhatsApp Business — não o nosso
✅ O custo Meta vai NO SEU cartão — total transparência
✅ Você controla os templates aprovados na SUA conta Meta
✅ Total Campanha cuida do envio, agendamento, throttling, status, inbox

Pré-requisitos (você precisa ter):
[ ] CNPJ ativo
[ ] Meta Business Manager verificado
[ ] WhatsApp Business Account (WABA) criada
[ ] Número dedicado adicionado à WABA
[ ] Display Name aprovado
[ ] Cartão vinculado à conta Meta

Não tem ainda? Sem problema — nosso Setup Assistido (R$ 997)
faz tudo isso pra você, em 1-3 reuniões.

Tem dúvida? Fala com a gente.
```
