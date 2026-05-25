# UX_PRINCIPLES.md — Total Campanha

> Princípios perenes que regem TODA decisão de UX no produto. Quando uma escolha
> de design entrar em conflito com um destes princípios, o princípio vence —
> ou o princípio é debatido e revisado, mas nunca silenciosamente ignorado.
>
> Público-alvo do produto: **dono/operador comercial de PME B2B brasileira**
> (autopeças, distribuidoras, floriculturas, perfumarias, materiais de construção,
> óticas, papelarias). 200 – 10.000 contatos. Não é developer, não é growth hacker,
> não conhece RD Station nem HubSpot. **Quer disparar campanha sem quebrar nada.**
>
> Cliente piloto: Cardans Tencar (autopeças, ~250 contatos).

---

## P1 — Falar a língua do dono da PME, não a do desenvolvedor

A linguagem do produto é a linguagem do João da autopeça, não a do time de
plataforma. Termos técnicos são **traduzidos** ou **escondidos atrás de tooltip**.

**Vocabulário oficial:**

| Em vez de… | Use… |
|---|---|
| Tenant | Empresa |
| Workspace | Conta |
| Segment / Filter | Lista / Grupo |
| Opt-in | "Aceitou receber" |
| Quality rating | Saúde do número |
| Webhook | "Aviso automático da Meta" (em tooltip) |
| WABA | "Conta WhatsApp Business" |
| Phone Number ID | "Identificador do número" (em tooltip, e só na tela técnica) |
| Throttle / Rate limit | "Ritmo de envio" |
| Render | "Visualizar como vai ficar" |
| Trigger | "Disparar" |
| Provider | "Canal" ou "Serviço" |

**Como aplicar:**
- Toda string nova em frontend passa por esse filtro antes de virar `commit`.
- Termo técnico inevitável (Meta exige "Phone Number ID" no formulário BYOA) vem
  sempre com `<Tooltip>` que explica em uma frase humana.
- Mensagens de erro **nunca** contêm jargão de stack (`InvalidParameterException`,
  `prisma.contato.create`, `500 Internal Server Error`).

---

## P2 — Decisões caras precisam de fricção; decisões baratas precisam de fluidez

A UX modula o atrito de acordo com o **custo de errar**. Não há um "design pattern
único" para botões de ação — o botão de criar contato e o botão de disparar
campanha são fundamentalmente diferentes.

**Categorias de custo:**

| Categoria | Exemplos | UX |
|---|---|---|
| **Reversível e barato** | criar contato, criar segmento, salvar template rascunho | 1 clique, sem confirmação, undo via toast |
| **Reversível mas com efeito externo** | importar 5k contatos, ativar template | confirmação inline, status visível |
| **Caro e irreversível** | disparar campanha para >N contatos, conectar WhatsApp, hard delete LGPD | confirmação com digitar nome/palavra, envio de teste obrigatório quando aplicável, log de auditoria |
| **Catastrófico** | excluir empresa, transferir titularidade, super-admin impersonate | 2FA na hora, confirmação dupla, e-mail de notificação |

**Regra dos disparos** (específica do produto):
- Toda criação de campanha **obriga** uso do botão "Enviar para 5 contatos de teste"
  antes do botão "Disparar para todos" virar habilitado, **a menos que** o tenant
  já tenha disparado pelo menos 1 campanha bem-sucedida nos últimos 30 dias.
- Disparo para > 100 contatos exige digitar o **nome da campanha** para confirmar
  (estilo "delete repo" do GitHub).
- Disparo para > 1.000 contatos exige confirmação adicional do **custo estimado**
  como número (`"Confirmo gastar até R$ ___,___"`).

---

## P3 — O custo é parte da UI, sempre

Toda ação que consome serviço externo pago (Meta Cloud API, SES, Resend, Asaas)
mostra o **custo estimado antes** da ação, e o **custo real depois**.

**Implementação obrigatória:**

- Tela de criar campanha: card permanente "Custo estimado: R$ X,XX
  (Y contatos × R$ Z,ZZ/msg)" atualizado em tempo real quando o segmento muda.
- Dashboard: widget "Consumo do mês: R$ X de R$ Y do seu plano" sempre visível.
- Toast de pós-disparo: "Campanha enviada — custo real: R$ X,XX (estimado:
  R$ Y,YY)."
- Conexões: WhatsApp e Email mostram custo unitário corrente (R$/msg) e link
  "Por que esse preço?" explicando que é repasse Meta/SES sem markup.

**Razão**: o usuário PME brasileiro **não sabe** que WhatsApp template Meta custa
R$ 0,05 – 0,15 por mensagem. Sem essa visibilidade, a primeira fatura é o churn.
Esconder custo é hostil ao usuário e é falha de produto, não decisão comercial.

---

## P4 — Conformidade LGPD é visível, não escondida

A LGPD é tratada como **feature de produto vendável**, não como capítulo de
termos de uso. O tenant precisa **ver** seu compliance e usá-lo como vantagem
competitiva. Ninguém no mercado brasileiro de disparo faz isso bem.

**Indicadores obrigatórios em /compliance (aba do dashboard):**

1. **% de contatos com opt-in registrado** (com timestamp + origem + IP + UA).
2. **% com fonte de coleta documentada** (landing pública, QR, formulário manual, importação).
3. **Opt-outs nos últimos 30 dias** com gráfico.
4. **Link público de opt-in** com botão de copiar e gerar QR code para imprimir
   no balcão.
5. **DPA assinado** (data, versão) — link para baixar PDF.
6. **Encarregado (DPO) cadastrado** — campo editável (nome, email, telefone).
7. **Última exportação de dados (Art. 18 II/V)** — quando, por quem, para qual
   titular.

**Razão dupla:**
- Protege a Total juridicamente (operador faz parte visível, controlador também).
- Vira argumento de venda: "veja seu compliance em tempo real" é diferencial
  contra concorrentes informais.

---

## P5 — Erro de provedor externo é traduzido, sempre

`(#100) Invalid parameter` da Meta, `MessageRejected` do SES e `Error 6` do
Asaas **nunca** chegam ao usuário como string crua. Todo erro de provedor passa
por uma camada `errorMapper` que devolve:

- **Causa em linguagem humana** ("Token não tem permissão `whatsapp_business_management`")
- **Ação concreta** ("Refaça o passo 4 do tutorial e cole o novo token")
- **Link para a etapa relevante** (`/conexoes/whatsapp/novo?step=token`)
- **Código original em `<details>`** para suporte copiar e colar em ticket

**Implementação:**
- Arquivo único `apps/web/src/lib/errors/error-mapper.ts` exporta
  `mapearErroProvedor(erro: unknown): ErroAmigavel`.
- Backend devolve `{ code, message, retryable, providerCode }` — frontend mapeia.
- Erros não catalogados caem em fallback amigável + log para Application Insights
  (para virarem entrada no mapeamento na próxima release).

---

## P6 — Mobile-first não é opcional

Dono de autopeça abre o painel pelo celular entre atender clientes. Toda
funcionalidade-núcleo (ver dashboard, ver inbox, pausar campanha em andamento,
ver erro de entrega) **funciona bem em 360×640**.

**Regras:**

- Dashboard: viewport ≤ 640 mostra **1 widget por linha**, na ordem:
  saldo → próxima campanha → checklist onboarding → atalhos. Nunca grid 4 colunas
  espremido.
- Listas: viewport ≤ 640 esconde colunas secundárias (manter nome + 1 metadado +
  ação primária). Resto vai pra detalhe expansível.
- Tabelas: usar `<dl>` empilhado em mobile, `<table>` em desktop. Nunca scroll
  horizontal em página principal.
- Inputs com `inputMode` apropriado (`numeric`, `tel`, `email`).
- Botão de ação primária em qualquer fluxo crítico (disparar, pausar, opt-out)
  cabe acima da dobra de 640px sem scroll.

**Testar antes de mergear:** Chrome DevTools device toolbar com iPhone SE
(360×667) e Galaxy S8 (360×740). É um check de PR.

---

## P7 — Acessibilidade no nível AA, sempre

WCAG 2.1 nível AA é piso, não meta. Não há débito técnico de acessibilidade que
"resolvemos depois" — toda PR que introduz UI inacessível é bloqueada.

**Mínimo não-negociável em cada PR de UI:**

1. **Contraste**: texto regular ≥ 4.5:1, texto grande ≥ 3:1. (`text-gray-500`
   sobre `bg-gray-50` está em 3.9:1 — **falha**. Use `text-gray-600` ou darker.)
2. **Foco visível**: `focus-visible:ring-2 focus-visible:ring-gray-900` em todo
   interativo. Nunca `outline: none` sem substituto.
3. **Labels**: `<label htmlFor>` ou `aria-label` em todo input. Placeholder não
   é label.
4. **Anúncios dinâmicos**: toast usa `role="status"` ou `role="alert"`. Mudança
   de modo (login → 2FA) anuncia com `aria-live="polite"`.
5. **Teclado**: tudo acessível por teclado. Modal trapping. `Esc` fecha modal.
6. **Imagens**: `alt` descritivo em conteúdo, `alt=""` em decorativo.
7. **Idioma**: `<html lang="pt-BR">`.

**Razão pragmática:** empresa B2B brasileira que pretende vender ao setor
público (Sebrae, prefeituras, Sicoob) precisa de laudo WCAG. E é mais barato
fazer certo desde o início do que retrofit.

---

## P8 — Loading não é "carregando…"

Skeletons sempre, texto cru nunca. Estado vazio sempre com CTA, nunca só "Sem
dados.".

**Padrão de componentes**:

- **Skeleton**: usar `<Skeleton>` do shadcn em qualquer lugar que hoje seria
  `<p>carregando…</p>`. Replicar visualmente a estrutura final (linhas, cards).
- **Empty state**: `<EmptyState icon title description action>` reusável.
  Toda lista vazia tem botão CTA óbvio:
  - Contatos vazio → "Importar CSV" + "Adicionar manualmente"
  - Segmentos vazio → "Criar primeira lista"
  - Campanhas vazio → "Criar primeira campanha de teste"
- **Erro**: componente `<ErrorState>` com retry + link de suporte.

---

## P9 — Toda lista importante tem busca, filtro e ação em massa

Lista crua de itens (sem busca, sem filtro, sem checkbox em lote) é débito de
UX. Não shipear listas sem essas três coisas em:

- /contatos
- /segmentos
- /templates
- /campanhas
- /inbox

Atalho de teclado: `/` foca a busca em qualquer dessas páginas.

---

## P10 — Internacionalização desde o dia 1, ainda que só em PT-BR

Toda string de UI vive em arquivo de mensagens (`apps/web/src/lib/i18n/pt-BR.ts`
como ponto de partida). Não em JSX hardcoded.

**Razão:**
- Permite revisão única do vocabulário de produto (P1) sem caçar 200 lugares.
- Permite mudar tom (formal/informal por tenant) no futuro.
- Permite EN-US/ES quando o produto for além do Brasil — sem refactor caro.
- Datas, moeda e números usam `Intl.NumberFormat` / `Intl.DateTimeFormat` com
  locale `pt-BR`.

---

## Checklist rápido para revisão de PR de UI

Antes de aprovar uma PR que mexe em frontend, conferir:

- [ ] Strings novas estão no arquivo de mensagens (P10) e respeitam o vocabulário (P1)
- [ ] Custo aparece se a ação consome serviço pago (P3)
- [ ] Erro de provedor passa pelo error-mapper (P5)
- [ ] Loading usa Skeleton, não texto cru (P8)
- [ ] Empty state tem CTA acionável (P8)
- [ ] Contraste ≥ 4.5:1, foco visível, labels em todos os inputs (P7)
- [ ] Testado em 360×640 (P6)
- [ ] Ação cara tem fricção adequada (P2)
- [ ] Acessível por teclado (P7)

---

## Como evoluir este documento

- **Adicionar princípio novo**: PR + discussão. Princípio só vira regra após
  um caso real ter justificado.
- **Mudar princípio**: PR + justificativa em ADR (`docs/adr/`).
- **Citar princípio em código**: comentário curto `// P3 (custo visível)` quando
  for não-óbvio.
