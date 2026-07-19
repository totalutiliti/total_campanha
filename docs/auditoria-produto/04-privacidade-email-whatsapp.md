# 04 — Privacidade, LGPD, email e WhatsApp

## Papéis e premissas

- **Fato documental:** Total Campanha pretende atuar como operador dos contatos carregados pelo tenant e controlador dos dados cadastrais/faturamento do próprio tenant.
- **Decisão jurídica pendente:** base legal por finalidade, prazos de retenção, conteúdo do DPA/termos e exceções de conservação devem ser aprovados por jurídico/DPO; este relatório não é parecer jurídico.
- Referências: [direitos do titular — ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1), [guia de agentes de tratamento — ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/2021.05.27GuiaAgentesdeTratamento_Final.pdf/%40%40download/file), [política de mensageria WhatsApp Business](https://whatsappbusiness.com/policy/) e [Amazon SES — listas e supressões](https://docs.aws.amazon.com/ses/latest/dg/lists-and-subscriptions.html).

## Inventário de dados pessoais

| Categoria                                                       | Finalidade aparente           | Armazenamento/terceiros                             | Retenção/ações                                               |
| --------------------------------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| Usuário do tenant: email, senha hash, TOTP, papel               | Autenticação/administração    | PostgreSQL, Redis para tokens; email transacional   | Retenção/cancelamento não automatizados                      |
| Empresa: CNPJ, razão social, billing                            | Contrato/faturamento          | PostgreSQL, Asaas                                   | Política não formalizada no código                           |
| Contato: nome, email, telefone, tags, extras                    | Segmentação/campanha          | PostgreSQL; Redis no import; Meta/SES no envio      | Soft delete; hard delete parcial                             |
| Consentimento: canal, ação, IP, user-agent, origem, versão      | Prova de opt-in/out           | PostgreSQL OptInLog                                 | Imutabilidade pretendida; PII em claro e prazo só documental |
| Mensagem: destino correlacionado, status, falha, conteúdo inbox | Entrega, suporte e analytics  | PostgreSQL, Meta/SES                                | Sem retenção/partição; inbox mantém conteúdo                 |
| Logs/auditoria/custos                                           | Segurança, suporte e cobrança | PostgreSQL, Log Analytics/App Insights              | 30 dias no workspace IaC; DB sem retenção automática         |
| Credenciais BYOA                                                | Operar conta do tenant        | Token Meta cifrado PostgreSQL/Key Vault; SES global | Rotação Meta em backlog                                      |

## Achados LGPD/privacidade

### ACHADO PRIV-001 — Email é ativado antes de confirmação

**Severidade:** Alta · **Prioridade:** P0 · **Status:** Confirmado
O formulário público ativa `optInEmail`; o email posterior é informativo. Usar estado pendente e token single-use; somente após clique registrar opt-in ativo com versão/origem/IP/user-agent. Testes devem provar que pendente não entra em campanha.

### ACHADO PRIV-002 — Opt-in administrativo/importado sem prova

**Severidade:** Alta · **Prioridade:** P0 · **Status:** Confirmado
DTOs e CSV mudam flags sem evento probatório obrigatório. Separar base legal declarada, elegibilidade e consentimento verificável; toda mudança exige evento append-only correlacionado.

### ACHADO PRIV-003 — Opt-in público pode mesclar identidades

**Severidade:** Alta · **Prioridade:** P1 · **Status:** Confirmado
Busca `email OR telefone` pode encontrar um contato e sobrescrever o outro dado; `origem` vem do cliente, `X-Forwarded-For` é aceito diretamente e reCAPTCHA falha aberto sem chave. Confirmar canais/posse separadamente, configurar trusted proxy e falhar startup em PROD sem proteção exigida.

### ACHADO PRIV-004 — Direito ao esquecimento é parcial

**Severidade:** Alta · **Prioridade:** P1 · **Status:** Confirmado
**Positivo:** contato é removido e destinatário de Mensagem vira hash. **Lacunas:** a rotina cria OptInLog com email/telefone em claro, não trata InboxConversa/InboxMensagem, Redis/blobs/backups nem exclusão de conta; `EDITOR` pode disparar a ação irreversível. Criar matriz de retenção, anonimização integral e fluxo DSAR/ADMIN+step-up. Aceite: relatório automatizado mostra destino de cada dado e exceção legal.

### ACHADO PRIV-005 — Possível dado real em modelo baixável

**Severidade:** Alta · **Prioridade:** P0 · **Status:** Provável
Comentário em `apps/web/src/lib/csv/template.ts:13` indica exemplos de clientes reais. Nenhum valor foi copiado. Substituir por sintéticos, confirmar origem/autorização e revisar histórico com gitleaks/identificadores mascarados.

## Consentimento, direitos e documentos

| Requisito                  | Estado                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Opt-in/out por canal       | Existe, com fragilidades acima                                                           |
| Histórico de consentimento | OptInLog existe; prova administrativa e versão textual precisam reforço                  |
| Correção                   | CRUD de contato existe                                                                   |
| Exclusão                   | Hard delete parcial; exclusão de tenant/conta ausente                                    |
| Exportação                 | CSV de contatos backend existe, sem jornada UI/DSAR integral                             |
| Revogação                  | Link email + palavras WA; GET tem risco de crawler                                       |
| Política/termos/DPA        | Documentos internos existem; páginas públicas/versionamento/aceite não foram encontrados |
| Canal de privacidade/DPO   | Não encontrado na UI                                                                     |
| Dados de produção em DEV   | Não validado; possível exemplo real requer ação                                          |

## Email

### Modelo atual

O worker envia por SMTP ou Amazon SES. O tenant cadastra domínio/remetente e recebe instruções DNS, mas o dispatcher usa `MAIL_FROM_DEFAULT` global. `resend` não está implementado de fato.

### ACHADO EMAIL-001 — Identidade do tenant ignorada

**Severidade:** Alta · **Prioridade:** P0 · **Status:** Confirmado
Carregar `ConexaoEmail` ativa/verificada do mesmo tenant e usar seu remetente; nunca fallback global silencioso em PROD. Teste A/B deve observar remetentes distintos.

### ACHADO EMAIL-002 — Sem feedback e supressão

**Severidade:** Alta · **Prioridade:** P1 · **Status:** Ausência confirmada
Não há webhook/event stream SES, provider message ID, hard/soft bounce, complaint ou suppression. AWS recomenda monitorar e agir sobre bounce/complaint; sua documentação informa que alta taxa pode levar a review/pausa ([SES sender review](https://docs.aws.amazon.com/ses/latest/dg/faqs-enforcement.html)). Implementar feedback autenticado/idempotente, supressão por tenant e alertas de reputação. Aceite: complaint/hard bounce impede reenvio e replay não duplica métrica.

### ACHADO EMAIL-003 — GET de descadastro causa efeito

**Severidade:** Média · **Prioridade:** P2 · **Status:** Confirmado
`List-Unsubscribe-Post` existe, o que é positivo, mas a página e API GET já desativam o contato; scanners/prefetch podem descadastrar sem intenção. GET humano deve apresentar confirmação; POST RFC 8058 permanece idempotente para one-click do provedor.

### Checklist email

| Controle                    | Estado                                                            |
| --------------------------- | ----------------------------------------------------------------- |
| Opt-in e log                | Existe, mas sem double opt-in/prova forte                         |
| Opt-out visível e headers   | Existe; rodapé é injetado sempre                                  |
| Deduplicação                | Contato tem unique tenant+email; efeito de envio ainda duplicável |
| SPF/DKIM/DMARC              | Wizard/SES gera instruções; estado real DNS não validado          |
| Cancelar/pausar             | UI/API existem; race com worker                                   |
| Idempotência                | Insuficiente (`ARC-001`)                                          |
| Tracking de abertura/clique | Não encontrado; decisão de privacidade pendente                   |
| Limites/frequência          | Throttle não agregado; entitlements ausentes                      |
| Auditoria/custo             | Parcial; usage pode alterar status do envio                       |

## WhatsApp

### Modelo atual identificado

**Fato:** integração oficial Meta WhatsApp Cloud API, BYOA por tenant, com template aprovado e número/credencial próprios. Não é automação de WhatsApp Web nem biblioteca não oficial.

A política atual da Meta exige telefone + opt-in, respeito ao opt-out, template aprovado para iniciar conversa e, fora da janela de 24h, uso de template aprovado; violações podem limitar/remover acesso ([WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/)).

### Avaliação

| Controle              | Estado                                                                            |
| --------------------- | --------------------------------------------------------------------------------- |
| Opt-in                | Flag e página pública existem; prova/importação precisam correção                 |
| Opt-out               | Palavras `SAIR/STOP/CANCELAR/PARAR` desativam WhatsApp; falta UI de supressão     |
| Templates             | Nome/idioma/variáveis e consulta Meta no backend; UI parcial                      |
| Janela 24h            | Inbox bloqueia texto livre fora da janela                                         |
| Cloud API oficial     | Confirmado                                                                        |
| Isolamento credencial | Schema/cifra por tenant; worker BYPASSRLS ameaça isolamento                       |
| Webhook               | Sem HMAC e sem idempotência (`WA-001`, `ARC-005`)                                 |
| Limites/qualidade     | Campos tier/quality existem; throttle agregado e alertas de qualidade incompletos |
| Custos                | Usage existe; nem toda chamada paga (resposta/teste) é instrumentada              |
| Risco de banimento    | Alto enquanto opt-in, duplicidade, throttle e webhook não forem corrigidos        |
| Embedded Signup       | Não implementado; onboarding manual complexo                                      |

## Decisões humanas pendentes

1. Posicionamento e bases legais por categoria de campanha/vertical.
2. Prazo de retenção por tabela, backups e prova de consentimento.
3. Modelo de DPA, termos, política pública, encarregado e processo DSAR.
4. SES por conta da plataforma vs BYOA/tenant e isolamento de reputação/supressão.
5. Embedded Signup/Tech Provider Meta e suporte assistido.
6. Limites por plano/campanha e política de abuso.

## Critérios antes do piloto

- Consentimento verificável e supressão operacional.
- Sender/número/credencial do mesmo tenant comprovados em testes A/B.
- Webhooks assinados e idempotentes.
- Envio exatamente uma vez no modelo operacional suportado.
- Hard delete/DSAR e retenção aprovados e testados.
- Sem dados reais em templates, seeds ou ambientes de teste.
- Monitor de bounce/complaint/quality/custo e suspensão automática segura.
