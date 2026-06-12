---
name: identidade-visual-totalia
description: >-
  Identidade visual oficial da Total IA Contábil (produto IRPF — imposto_app).
  Use SEMPRE que for criar ou alterar qualquer coisa visual: telas e páginas do
  frontend, componentes React, modais/pop-ups/dialogs, toasts e notificações,
  formulários, tela de login, dashboards, badges de status — e também materiais
  fora do app (apresentações, e-mails HTML, landing pages, PDFs, mockups,
  protótipos). Contém a paleta oficial (tokens claro/escuro + hex), a logo, a
  tipografia, as variantes de botões/inputs/cards/badges e receitas prontas de
  modal e toast. Consulte esta skill antes de escrever qualquer JSX/CSS novo,
  mesmo que o pedido não mencione "identidade visual" — ex.: "crie um modal",
  "adicione uma tela", "faça um slide com a logo da empresa".
---

# Identidade Visual — Total IA Contábil

Guia oficial de marca e UI do produto de automação de IRPF. Tudo aqui foi
extraído do código real do frontend (`frontend/` — Next.js 15 + React 19 +
Tailwind 3.4). Em caso de dúvida, o código é a fonte da verdade; os paths
exatos estão indicados em cada seção.

## A marca em 30 segundos

- **Nome**: Total IA Contábil (escrito "total**ia** CONTABIL" na logo).
- **Tagline**: "Automação Fiscal" / "Sistema de Automação IRPF".
- **Logo**: 3 barras de gráfico em verde crescente + wordmark. Componente
  canônico: `frontend/src/components/logo-totalia.tsx` (`<LogoTotalia />`).
  Versões standalone para uso fora do app: `assets/logo-totalia-light.svg`
  (fundos claros) e `assets/logo-totalia-dark.svg` (fundos escuros).
- **Verdes da marca** (use apenas na logo, em destaques da marca e em ações de
  sucesso): `#2ECC71` (claro), `#27AE60` (médio), `#1B7A3D` (escuro).
- **Azul de ação** (cor primária de TODA a UI — botões, links, foco, item de
  nav ativo): `#2563EB` no tema claro, `#3B82F6` no escuro.

Essa separação importa: o verde identifica a *marca*; o azul comanda a
*interface*. Não pinte botões comuns de verde nem a logo de azul.

## Stack visual do frontend

- Tailwind CSS 3.4 com tokens semânticos em variáveis CSS HSL
  (`frontend/src/app/globals.css`) — padrão shadcn/ui (base Slate).
- Componentes próprios em `frontend/src/components/ui/` (button, card, dialog,
  badge, input, label, password-input) com CVA (`class-variance-authority`) +
  `cn()` de `frontend/src/lib/utils.ts`. **Não há Radix nem MUI** — dialogs são
  implementação própria; não introduza essas dependências.
- Ícones: **lucide-react** (tamanhos `h-4 w-4` ou `h-5 w-5`).
- Fonte: **Inter** via `next/font` (`frontend/src/app/layout.tsx`).
- Dark mode: classe `dark` no `<html>` via **next-themes**
  (`defaultTheme="light"`, `enableSystem={false}`).

## Paleta essencial (tokens semânticos)

Dentro do app, use SEMPRE as classes de token — nunca hex ou cores Tailwind
cruas para superfícies/texto/ações. Os tokens já resolvem claro/escuro
sozinhos; hex hardcoded quebra o dark mode.

| Token (classe)              | Papel                          | Claro     | Escuro    |
| --------------------------- | ------------------------------ | --------- | --------- |
| `bg-background`             | Fundo da página                | `#FFFFFF` | `#020817` |
| `text-foreground`           | Texto principal                | `#020817` | `#F8FAFC` |
| `bg-card`                   | Cards, modais, sidebar         | `#FFFFFF` | `#030C21` |
| `bg-primary`                | Botões/ações primárias, links  | `#2563EB` | `#3B82F6` |
| `text-primary-foreground`   | Texto sobre primário           | `#F8FAFC` | `#0F172A` |
| `bg-secondary` / `bg-muted` / `bg-accent` | Fundos sutis, hover  | `#F1F5F9` | `#1E293B` |
| `text-muted-foreground`     | Texto secundário, placeholders | `#64748B` | `#94A3B8` |
| `bg-destructive`            | Ações destrutivas, erros       | `#EF4444` | `#D03232` |
| `border` (cor `border`)     | Bordas e divisores             | `#E2E8F0` | `#1E293B` |
| `ring` (anel de foco)       | `focus-visible:ring-2`         | `#2563EB` | `#1D4ED8` |

Raio de borda: `--radius: 0.5rem` → `rounded-lg` (cards/modais), `rounded-md`
(botões/inputs), `rounded-full` (badges).

**Exceções permitidas a cores literais**: a logo (verdes fixos), os chips de
status do pipeline (mapa fixo `STATUS_COLORS` em `frontend/src/lib/utils.ts`)
e alerts inline (receitas em `references/cores-e-tokens.md`), que usam pares
light/dark explícitos (`bg-red-50 ... dark:bg-red-950/20`).

## Tipografia

Inter em todo o produto. Escala em uso:

| Uso                    | Classes                                      |
| ---------------------- | -------------------------------------------- |
| Título de página       | `text-3xl font-bold`                         |
| Título de card/modal   | `text-2xl font-semibold tracking-tight` (card) / `text-xl font-bold` (modal) |
| Título de seção        | `text-lg font-semibold`                      |
| Corpo e inputs         | `text-sm`                                    |
| Labels                 | `text-sm font-medium leading-none`           |
| Legendas/ajuda         | `text-xs text-muted-foreground`              |

## Regras de ouro

1. **Tokens semânticos sempre** (`bg-background`, `text-foreground`,
   `border`, `bg-primary`…). Se você digitou `bg-white`, `text-gray-900` ou um
   hex num componente do app, pare e troque pelo token.
2. **Todo visual novo precisa funcionar nos dois temas.** Tokens resolvem 90%;
   para o resto, forneça par `dark:` explícito. Teste mentalmente: "como isso
   fica com `--background: #020817`?"
3. **Reuse os componentes de `components/ui/`** (Button, Card, Badge, Input,
   Label, PasswordInput, Dialog) em vez de recriar markup. Variantes novas
   entram via CVA no componente, não como classes soltas na página.
4. **Botão verde é exceção de sucesso** (ex.: "Enviar Transmitida":
   `bg-green-600 text-white hover:bg-green-700`). Ação padrão é azul
   (`variant="default"`); destrutiva é vermelha (`variant="destructive"`).
5. **Português do Brasil** em todos os textos de UI ("Cancelar", "Salvar",
   "Entrar", "Esqueci minha senha").
6. **Fora do app** (slides, e-mails, docs): use a tabela hex acima + logo dos
   assets; fundo claro `#FFFFFF`/`#F1F5F9` ou escuro `#020817`, texto Inter (ou
   system-ui), ações em `#2563EB`, marca em `#2ECC71`.

## Onde aprofundar (references/)

Leia o arquivo certo antes de construir:

- **`references/cores-e-tokens.md`** — variáveis CSS completas (claro/escuro)
  com hex, mapa completo de cores/labels de status do pipeline
  (TRANSMITIDA, PRONTA, ERRO…), receitas de alerts (erro/sucesso/aviso/info) e
  cores da logo. Leia para: badges de status, alerts, materiais externos.
- **`references/componentes.md`** — anatomia e código exato de Dialog/modal,
  toast, botões (todas as variantes CVA), inputs, cards, badges, tabelas,
  checkbox/radio/select. Leia para: qualquer componente novo, pop-up, form.
- **`references/layout-e-telas.md`** — app shell, sidebar (item ativo/inativo,
  footer com usuário/sair/toggle de tema), tela de login completa, theme
  provider/toggle e metadata. Leia para: páginas novas, navegação, login,
  qualquer coisa de tema claro/escuro.

## Checklist antes de entregar UI nova

- [ ] Só tokens semânticos (ou exceção documentada com par `dark:`)?
- [ ] Funciona em claro E escuro?
- [ ] Reusa `components/ui/*` e ícones lucide-react?
- [ ] Foco visível (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`)?
- [ ] Estados disabled (`disabled:opacity-50`) e loading (`Loader2` girando) cobertos?
- [ ] Textos em pt-BR?
- [ ] Espaçamentos do padrão (`p-6` em cards/modais, `space-y-4` entre seções, `gap-2` em grupos de botões)?
