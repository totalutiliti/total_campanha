# UX_BACKLOG.md — Total Campanha

> Backlog de ações de UX priorizado por **impacto × esforço**, com critérios de
> pronto. Cada item é executável de forma independente. Atualizar status quando
> concluído (mover para `## Concluído` no fim do arquivo).
>
> Origem: auditoria de UX feita em 2026-05-25 (registrada em
> [`instrucoes/memoria.md`](../instrucoes/memoria.md)). Princípios norteadores
> em [`docs/UX_PRINCIPLES.md`](UX_PRINCIPLES.md).

**Legenda de status:** 🔴 não iniciado · 🟡 em andamento · 🟢 concluído
**Legenda de impacto:** 🔥🔥🔥 alto · 🔥🔥 médio · 🔥 baixo
**Legenda de esforço:** S (≤ 1d) · M (2–4d) · L (1–2 sem)

---

## Sprint 1 — Fundação (destrava todo o resto)

### UX-01 · Instalar shadcn/ui e migrar componentes-base
- **Status:** 🔴 · **Impacto:** 🔥🔥 · **Esforço:** M
- **Por quê:** Hoje `apps/web/src/components/ui/` está vazio apesar do CLAUDE.md
  declarar shadcn no stack. Cada `<button>`, `<input>`, `<select>` é
  reimplementado inline com Tailwind cru. Sem isso, qualquer melhoria de UX é
  retrabalho.
- **Critérios de pronto:**
  - [ ] `npx shadcn@latest init` executado, `components.json` versionado
  - [ ] Componentes mínimos adicionados: `Button`, `Input`, `Label`, `Select`,
    `Dialog`, `Toast` (sonner), `Skeleton`, `Badge`, `Card`, `Tabs`, `Tooltip`,
    `Checkbox`, `Switch`, `DropdownMenu`, `Form` (react-hook-form + zod)
  - [ ] Login refatorado para usar `Input`/`Label`/`Button`/`Form` (prova de
    conceito)
  - [ ] `eslint` regra sugerindo componentes shadcn em vez de tags cruas (ou
    decisão documentada de não adotar)

### UX-02 · Sistema de toast + camada de tradução de erro
- **Status:** 🔴 · **Impacto:** 🔥🔥 · **Esforço:** S
- **Por quê:** Princípio [P5](UX_PRINCIPLES.md#p5). Hoje erros somem na próxima
  navegação ou aparecem como `e.message` cru da Meta/SES.
- **Critérios de pronto:**
  - [ ] `<Toaster>` (sonner) instalado no root layout, posição `top-right`
  - [ ] `apps/web/src/lib/errors/error-mapper.ts` criado com `mapearErroProvedor()`
  - [ ] Mapeamentos iniciais: top 10 erros Meta (token inválido, número não
    registrado, template não aprovado, janela 24h, rate limit Meta, etc.) +
    top 5 SES + top 3 Asaas
  - [ ] Backend (`AllExceptionsFilter`) devolve `{ code, message, providerCode, retryable }`
  - [ ] `apiFetch` propaga código estruturado para o handler de toast
  - [ ] Toast tem botão "Copiar detalhes técnicos" (código original em
    `<details>` para o usuário enviar para o suporte)

### UX-03 · Skeleton em todas as listas, empty states com CTA
- **Status:** 🔴 · **Impacto:** 🔥🔥 · **Esforço:** S
- **Por quê:** Princípio [P8](UX_PRINCIPLES.md#p8). Hoje o produto parece
  quebrado nos primeiros 800ms. Empty state vazio não converte.
- **Critérios de pronto:**
  - [ ] Componente `<EmptyState icon title description action>` em `components/ui/`
  - [ ] `<ListSkeleton>` reusável (linhas com bullets cinza)
  - [ ] Aplicado em: `/contatos`, `/segmentos`, `/templates`, `/conexoes`
  - [ ] CTA específico para cada empty (`Importar CSV` em contatos, `Criar
    primeira lista` em segmentos, etc.)

### UX-04 · Reformular dashboard (`/`)
- **Status:** 🔴 · **Impacto:** 🔥🔥 · **Esforço:** M
- **Por quê:** Hoje é "Olá, joão" + 4 cards genéricos. Não responde a nenhuma
  pergunta do usuário ao chegar.
- **Critérios de pronto:**
  - [ ] Acima da dobra:
    - Widget "Saldo / consumo do mês" (Princípio [P3](UX_PRINCIPLES.md#p3))
    - Widget "Próxima campanha agendada" (ou CTA "Criar primeira campanha" se zero)
    - Widget "Saúde dos canais" (WhatsApp + Email com semáforo)
  - [ ] Logo abaixo: sparkline 7 dias de enviadas/entregues/lidas/respondidas
  - [ ] Checklist de onboarding persistente enquanto incompleto (estilo Linear/Notion):
    - [x] Cadastrar empresa
    - [ ] Conectar WhatsApp ou Email
    - [ ] Importar pelo menos 1 contato
    - [ ] Criar primeiro template
    - [ ] Disparar campanha de teste
  - [ ] "Tenant" → "Empresa" (Princípio [P1](UX_PRINCIPLES.md#p1))
  - [ ] Plano + dias restantes do trial com badge destacado

---

## Sprint 2 — Coração do produto (criar e acompanhar campanha)

### UX-05 · `/signup` self-service + onboarding guiado
- **Status:** 🔴 · **Impacto:** 🔥🔥🔥 · **Esforço:** M
- **Por quê:** Sem isso o TTV < 30min prometido no [`docs/PRD.md`](PRD.md) é
  fantasia. Hoje signup é admin onboarding manual (anotado em F4.5 da memória).
- **Critérios de pronto:**
  - [ ] `/signup` com campos: razão social, CNPJ (com validação), nome
    responsável, email, senha (com indicador de força)
  - [ ] Validação CNPJ inline (algoritmo + opcional consulta CNPJWS)
  - [ ] Email de verificação obrigatório antes do primeiro login
  - [ ] Redirect para `/onboarding/passo-1` (conectar canal) após verificação
  - [ ] Trial de 14 dias iniciado automaticamente, banner persistente com
    contagem regressiva
  - [ ] Wizard de onboarding tem 4 telas guiadas (conectar → importar → template
    → primeira campanha teste) e cada passo é skipável mas marcado como pendente
    no checklist do dashboard

### UX-06 · Wizard de criação de campanha em 5 etapas
- **Status:** 🔴 · **Impacto:** 🔥🔥🔥 · **Esforço:** L
- **Por quê:** **Núcleo do produto.** Não existe hoje (rota `/campanhas/nova`
  ausente).
- **Critérios de pronto:**
  - [ ] `/campanhas` lista (com toolbar + filtros + busca)
  - [ ] `/campanhas/nova` em 5 passos:
    1. **Nomear** — nome interno + responsável + tag opcional
    2. **Para quem** — segmento existente / criar novo inline / "toda a base" +
       contagem em tempo real
    3. **Canal e conteúdo** — escolher Email/WhatsApp/ambos + template + preview
       lado a lado + merge tags com exemplos do primeiro contato selecionado
    4. **Quando** — agora / agendar / janela útil (8h–18h dias úteis) com toggle
    5. **Confirmar** — resumo + custo estimado (Princípio [P3](UX_PRINCIPLES.md#p3))
       + botão **"Enviar para 5 contatos de teste primeiro"** (Princípio [P2](UX_PRINCIPLES.md#p2))
  - [ ] Botão "Disparar para todos" só habilita após teste OK **OU** se o
    tenant já tem ≥ 1 disparo bem-sucedido nos últimos 30 dias
  - [ ] Disparo > 100 contatos exige digitar o nome da campanha
  - [ ] Disparo > 1000 contatos exige confirmar o teto de custo

### UX-07 · `/campanhas/[id]` com timeline em tempo real
- **Status:** 🔴 · **Impacto:** 🔥🔥🔥 · **Esforço:** L
- **Por quê:** Sem isso o usuário disparou e ficou no escuro. Não existe hoje.
- **Critérios de pronto:**
  - [ ] Header com status (RASCUNHO / AGENDADA / DISPARANDO X de Y / PAUSADA /
    FINALIZADA / CANCELADA) e botão Pausar/Cancelar sempre visível enquanto
    disparando
  - [ ] Cards de métricas: enviadas, entregues, lidas, respondidas, opt-outs,
    falhas + taxa de cada (porcentagem)
  - [ ] Custo real corrente + estimado
  - [ ] Tabela de erros agrupados por motivo (telefone inválido, opt-out, fora
    da janela 24h, template rejeitado, etc.) com contagem e link "Ver contatos
    afetados"
  - [ ] Atualização via polling 5s enquanto DISPARANDO (ou WebSocket se já houver
    infraestrutura)
  - [ ] Botão "Re-disparar para quem falhou" quando FINALIZADA
  - [ ] Aba "Mensagens" com lista paginada de contato → status → motivo

### UX-08 · Banner "envio de teste" e estimativa de custo permanente
- **Status:** 🔴 · **Impacto:** 🔥🔥🔥 · **Esforço:** S
- **Por quê:** Princípios [P2](UX_PRINCIPLES.md#p2) e [P3](UX_PRINCIPLES.md#p3).
  Salva o quality rating WhatsApp do tenant. Sem isso vão queimar o número no
  primeiro mês.
- **Critérios de pronto:**
  - [ ] Card permanente na tela de criar campanha com custo estimado atualizado
    em tempo real
  - [ ] Dashboard mostra saldo Meta + saldo SES + consumo do mês
  - [ ] Toast pós-disparo: "Custo real: R$ X (estimado: R$ Y)"
  - [ ] Página `/configuracoes/custos` explica unitário corrente + link "Por que
    esse preço?"

---

## Sprint 3 — Qualidade, escala e diferencial

### UX-09 · Refatorar FiltroBuilder para campos estruturados
- **Status:** 🔴 · **Impacto:** 🔥🔥 · **Esforço:** M
- **Por quê:** Princípio [P1](UX_PRINCIPLES.md#p1). Hoje o componente
  ([`filtro-builder.tsx`](../apps/web/src/components/segmentos/filtro-builder.tsx))
  pede input livre de campo (`extras.regiao`) com datalist. Usuário PME não vai
  entender — vão mandar pra base inteira sempre.
- **Critérios de pronto:**
  - [ ] Campo: dropdown estruturado (nome, email, telefone, tags, opt-in email,
    opt-in WhatsApp, criado em, fonte, e grupo "Campos personalizados" populado
    dinamicamente)
  - [ ] Operador: depende do tipo (texto → contém/igual; tag → tem/não tem;
    opt-in → sim/não; data → antes/depois/entre)
  - [ ] Valor: input apropriado por tipo (texto, chip-multiselect com autocomplete
    para tags existentes, switch, date-picker)
  - [ ] Templates de segmento comuns no topo: "Quem nunca recebeu campanha",
    "Opt-in WhatsApp e tag X", "Cadastrado nos últimos 30d"
  - [ ] Preview de até 5 contatos exemplo abaixo da contagem total
  - [ ] Tipos `Grupo`/`Condicao` migrados para `packages/shared` (débito de F4.5)

### UX-10 · `/inbox` com janela de 24h destacada
- **Status:** 🔴 · **Impacto:** 🔥🔥 · **Esforço:** L
- **Por quê:** Núcleo da promessa WhatsApp 2-vias. Não existe hoje. Janela 24h
  da Meta é regra de negócio crítica que o usuário **não sabe que existe**.
- **Critérios de pronto:**
  - [ ] Layout 2 colunas (conversas à esquerda, thread à direita)
  - [ ] Mobile: stack vertical com navegação
  - [ ] Em cada conversa: indicador de janela 24h (relógio com contagem regressiva)
  - [ ] Quando a janela expira: campo de resposta vira "Use um template" com
    seletor dos templates aprovados na Meta
  - [ ] Indicador "Aguardando resposta há X horas" para SLA
  - [ ] Filtros: não lidas, em janela 24h, expirando em 1h
  - [ ] Busca por contato/telefone/conteúdo

### UX-11 · Painel `/conexoes` com saúde acionável
- **Status:** 🔴 · **Impacto:** 🔥🔥 · **Esforço:** M
- **Por quê:** Hoje status crus (`status: ATIVA`, `qualityRating: GREEN`) sem
  contexto. Tenant descobre que número foi banido pelo cliente reclamando.
- **Critérios de pronto:**
  - [ ] WhatsApp: badge colorido (verde/amarelo/vermelho) + tooltip explicando
    estado + quality rating como semáforo com texto "Excelente / Atenção / Risco
    de banimento" + link "Como melhorar"
  - [ ] Métricas das últimas 24h por conexão: enviadas, entregues, taxa de erro
  - [ ] Última mensagem enviada e recebida
  - [ ] Webhook URL/secret sob revelação (botão "Mostrar"), com aviso de rotação
    ao revelar
  - [ ] Email: checklist DKIM + SPF + DMARC com instruções "Como configurar no
    Registro.br / CloudFlare"
  - [ ] Alerta proativo (toast + email opt-in) quando quality rating cai para
    YELLOW ou RED

### UX-12 · Wizard WhatsApp BYOA — refinos
- **Status:** 🔴 · **Impacto:** 🔥 · **Esforço:** M
- **Por quê:** [`whatsapp-wizard.tsx`](../apps/web/src/components/conexoes/whatsapp-wizard.tsx)
  já está acima da média. Refinos pequenos com alto retorno.
- **Critérios de pronto:**
  - [ ] Passo 1 (pré-requisitos): cada item vira checkbox interativo, botão
    "Continuar" só habilita se todos marcados
  - [ ] Passo 2 (token): screenshots anotados ou GIF curto do Meta Business
    Manager — texto puro hoje
  - [ ] Passo 3 (dados): warning explícito **antes** do botão sobre token não
    ser reexibido
  - [ ] Passo 4 (webhook): botão "Já configurei na Meta — verificar" que faz
    chamada de teste e mostra ✓ verde quando o GET de verify chegar
  - [ ] Erros do passo 3 passam pelo `errorMapper` (UX-02)
  - [ ] Stepper permite navegar para passos completos (hoje só `← Voltar` linear)

### UX-13 · Aba Compliance LGPD no dashboard
- **Status:** 🔴 · **Impacto:** 🔥🔥 · **Esforço:** M
- **Por quê:** Princípio [P4](UX_PRINCIPLES.md#p4). Diferencial competitivo
  ninguém oferece no Brasil.
- **Critérios de pronto:**
  - [ ] `/compliance` com 7 indicadores do P4
  - [ ] Botão de exportar dossiê do titular (já implementado no backend em
    `/lgpd/titular/dados` — só falta UI)
  - [ ] Exportação de **relatório PDF mensal** "Saúde LGPD da sua base"
  - [ ] QR code do link de opt-in para imprimir no balcão (PNG + PDF A6)

### UX-14 · Importação de contatos com mapeamento de colunas
- **Status:** 🔴 · **Impacto:** 🔥🔥 · **Esforço:** M
- **Por quê:** Backend já existe (F2.1), mas não há UI. Usuário hoje precisa do
  CSV no formato exato — não funciona com export de ERP variado.
- **Critérios de pronto:**
  - [ ] `/contatos/importar` com drop zone + preview das 5 primeiras linhas
  - [ ] Mapeamento manual de coluna CSV → campo Total Campanha (com palpite
    automático por header)
  - [ ] Detecção de duplicatas com opção "atualizar" / "ignorar"
  - [ ] Validação inline (telefone E.164, email válido) com contagem antes de
    confirmar
  - [ ] Para imports > 1.000: usa job assíncrono já existente, com tela de
    progresso polling

### UX-15 · Mobile-first audit e correção
- **Status:** 🔴 · **Impacto:** 🔥 · **Esforço:** M
- **Por quê:** Princípio [P6](UX_PRINCIPLES.md#p6). PME brasileira acessa muito
  por celular.
- **Critérios de pronto:**
  - [ ] Audit em Chrome DevTools (iPhone SE + Galaxy S8) de todas as páginas
    autenticadas
  - [ ] Dashboard: 1 widget por linha em ≤ 640px (não `lg:grid-cols-4` espremido)
  - [ ] Tabelas viram `<dl>` empilhado em mobile
  - [ ] Ação primária sempre acima da dobra de 640px
  - [ ] Botão "Pausar campanha" alcançável no inbox/dashboard em mobile

### UX-16 · Acessibilidade — primeira leva
- **Status:** 🔴 · **Impacto:** 🔥 · **Esforço:** M
- **Por quê:** Princípio [P7](UX_PRINCIPLES.md#p7). Hoje 0 aria-labels no
  projeto (`grep aria-label` em `apps/web/src` = 0 matches).
- **Critérios de pronto:**
  - [ ] `<html lang="pt-BR">` em `app/layout.tsx`
  - [ ] Foco visível custom (`focus-visible:ring-2`) em todos os interativos
  - [ ] Labels (visíveis ou `aria-label`) em todos os inputs
  - [ ] Cores: trocar `text-gray-500` sobre `bg-gray-50` por `text-gray-600`
    (contraste 4.5:1)
  - [ ] Toast com `role="status"` ou `role="alert"`
  - [ ] Mudança de modo no login (credenciais → 2FA) anuncia via `aria-live="polite"`
  - [ ] Rodar `axe-core` ou Lighthouse em cada página principal — score ≥ 95

---

## Backlog estendido (Fase 2)

### UX-17 · Super Admin painel
- Lista de tenants com MRR, status, último login, custo Meta+SES mês vs
  receita (margem por tenant), botão impersonar com motivo obrigatório
  registrado em audit_logs. Alertas: tenant com quality rating caindo, tenant
  com custo > 80% do plano. Backend parcial (F6.1).

### UX-18 · `/configuracoes` (tenant)
- Marca (logo + cor primária para opt-in público)
- Equipe (convidar usuários, roles)
- Faturamento (plano, fatura, método de pagamento)
- LGPD (DPA, DPO, link público)
- Notificações (alerta de quality rating, falha de campanha, opt-out spike)

### UX-19 · Reset de senha — telas
- Backend já entrega o token (F1.2). Faltam `/auth/forgot` e `/auth/reset` no
  frontend. Hoje token é retornado em dev, em prod precisa do MailService SES.

### UX-20 · i18n base
- Migrar strings para `apps/web/src/lib/i18n/pt-BR.ts` conforme Princípio
  [P10](UX_PRINCIPLES.md#p10). Não trocar libs de i18n até segundo idioma
  aparecer.

### UX-21 · A/B testing de templates
- Phase 2 do PRD. Permite testar 2 versões de mesma campanha com split
  configurável.

### UX-22 · Sugestões de copy por IA
- Phase 2 do PRD. Azure OpenAI gera sugestões de copy para template baseado em
  vertical + tom + tamanho. Custo entra em `usage_log` como qualquer outra
  chamada paga.

---

## Métricas para acompanhar (Application Insights)

| Métrica | Meta | Como medir |
|---|---|---|
| **TTV** (signup → primeira campanha disparada) | P50 < 30min | Event `campanha_disparada` − Event `tenant_criado` |
| **Funil de onboarding** | drop em qualquer etapa < 30% | Eventos `onboarding_passo_concluido` |
| **% que usa "envio de teste"** antes do 1º disparo real | > 80% | Event `campanha_teste_disparada` / `campanha_disparada` (1ª de cada tenant) |
| **% de tenants com quality rating GREEN aos 30 dias** | > 90% | Sample diário de `ConexaoWhatsapp.qualityRating` |
| **Cliques em "Importar CSV" vs cadastro manual** | confirmar necessidade | Events `contato_importar_aberto` / `contato_criado_manual` |
| **Tempo médio na tela de criar campanha** | < 5min | Page view duration + event `campanha_disparada` |
| **% de tenants que criaram ≥ 1 segmento** | > 50% após 14 dias | Query no banco semanalmente |

---

## Concluído

_(vazio até o primeiro item ser entregue.)_
