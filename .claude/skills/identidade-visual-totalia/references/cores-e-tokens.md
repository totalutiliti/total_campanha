# Cores e tokens — Total IA Contábil

Fonte da verdade: `frontend/src/app/globals.css` (variáveis),
`frontend/tailwind.config.ts` (mapeamento) e `frontend/src/lib/utils.ts`
(status). Valores HSL são os literais do CSS; hex são as conversões exatas para
uso fora do Tailwind (slides, e-mails, SVG, PDFs).

## Variáveis CSS — tema claro (`:root`)

| Variável                   | HSL                  | Hex       | Equivalente Tailwind |
| -------------------------- | -------------------- | --------- | -------------------- |
| `--background`             | `0 0% 100%`          | `#FFFFFF` | white                |
| `--foreground`             | `222.2 84% 4.9%`     | `#020817` | ≈ slate-950          |
| `--card`                   | `0 0% 100%`          | `#FFFFFF` | white                |
| `--card-foreground`        | `222.2 84% 4.9%`     | `#020817` | ≈ slate-950          |
| `--primary`                | `221.2 83.2% 53.3%`  | `#2563EB` | blue-600             |
| `--primary-foreground`     | `210 40% 98%`        | `#F8FAFC` | slate-50             |
| `--secondary`              | `210 40% 96.1%`      | `#F1F5F9` | slate-100            |
| `--secondary-foreground`   | `222.2 47.4% 11.2%`  | `#0F172A` | slate-900            |
| `--muted`                  | `210 40% 96.1%`      | `#F1F5F9` | slate-100            |
| `--muted-foreground`       | `215.4 16.3% 46.9%`  | `#64748B` | slate-500            |
| `--accent`                 | `210 40% 96.1%`      | `#F1F5F9` | slate-100            |
| `--accent-foreground`      | `222.2 47.4% 11.2%`  | `#0F172A` | slate-900            |
| `--destructive`            | `0 84.2% 60.2%`      | `#EF4444` | red-500              |
| `--destructive-foreground` | `210 40% 98%`        | `#F8FAFC` | slate-50             |
| `--border`                 | `214.3 31.8% 91.4%`  | `#E2E8F0` | slate-200            |
| `--input`                  | `214.3 31.8% 91.4%`  | `#E2E8F0` | slate-200            |
| `--ring`                   | `221.2 83.2% 53.3%`  | `#2563EB` | blue-600             |
| `--radius`                 | `0.5rem` (8px)       | —         | —                    |

## Variáveis CSS — tema escuro (`.dark`)

| Variável                   | HSL                  | Hex       | Equivalente Tailwind |
| -------------------------- | -------------------- | --------- | -------------------- |
| `--background`             | `222.2 84% 4.9%`     | `#020817` | ≈ slate-950          |
| `--foreground`             | `210 40% 98%`        | `#F8FAFC` | slate-50             |
| `--card`                   | `222.2 84% 7%`       | `#030C21` | —                    |
| `--card-foreground`        | `210 40% 98%`        | `#F8FAFC` | slate-50             |
| `--primary`                | `217.2 91.2% 59.8%`  | `#3B82F6` | blue-500             |
| `--primary-foreground`     | `222.2 47.4% 11.2%`  | `#0F172A` | slate-900            |
| `--secondary`              | `217.2 32.6% 17.5%`  | `#1E293B` | slate-800            |
| `--secondary-foreground`   | `210 40% 98%`        | `#F8FAFC` | slate-50             |
| `--muted`                  | `217.2 32.6% 17.5%`  | `#1E293B` | slate-800            |
| `--muted-foreground`       | `215 20.2% 65.1%`    | `#94A3B8` | slate-400            |
| `--accent`                 | `217.2 32.6% 17.5%`  | `#1E293B` | slate-800            |
| `--accent-foreground`      | `210 40% 98%`        | `#F8FAFC` | slate-50             |
| `--destructive`            | `0 62.8% 50.6%`      | `#D03232` | ≈ red-600            |
| `--destructive-foreground` | `210 40% 98%`        | `#F8FAFC` | slate-50             |
| `--border` / `--input`     | `217.2 32.6% 17.5%`  | `#1E293B` | slate-800            |
| `--ring`                   | `224.3 76.3% 48%`    | `#1D4ED8` | blue-700             |

Regras globais do `globals.css`: `* { @apply border-border; }` e
`body { @apply bg-background text-foreground; }` — toda borda já nasce na cor
certa; não redefina cor de borda sem motivo.

## Cores da logo (fixas, independem do tema)

| Elemento                  | Hex       | Observação                              |
| ------------------------- | --------- | --------------------------------------- |
| Barra curta (esquerda)    | `#2ECC71` | Verde claro — também o "ia" do wordmark |
| Barra média               | `#27AE60` | Verde médio                             |
| Barra alta (direita)      | `#1B7A3D` | Verde escuro                            |
| Texto "total" / "CONTABIL"| `currentColor` | Adapta ao tema (componente React)  |

Componente canônico: `frontend/src/components/logo-totalia.tsx`
(viewBox `0 0 150 50`, alturas usadas: `h-10` no login, `h-8` na sidebar).
Atenção: `frontend/public/logo-totalia.svg` é uma versão LEGADA com cores
ligeiramente diferentes (`#1E8449`, texto `#1a1a2e` fixo) — não a use como
referência; prefira o componente ou os assets desta skill
(`assets/logo-totalia-light.svg` / `assets/logo-totalia-dark.svg`).

## Status do pipeline de declarações

Mapa completo de `frontend/src/lib/utils.ts` (funções `getStatusColor()` e
`getStatusLabel()`). Use exatamente estas combinações em badges/chips — elas
são a linguagem de cor que os contadores já conhecem:

| Status                  | Label exibido               | Classes                          |
| ----------------------- | --------------------------- | -------------------------------- |
| `AGUARDANDO_EXTRACAO`   | Aguardando Extração         | `bg-gray-100 text-gray-700`      |
| `EXTRAINDO_PDF`         | Extraindo PDF               | `bg-blue-100 text-blue-700`      |
| `PDF_EXTRAIDO`          | PDF Extraído                | `bg-blue-100 text-blue-700`      |
| `DI_PROCESSANDO`        | Processando OCR             | `bg-yellow-100 text-yellow-700`  |
| `DI_COMPLETO`           | OCR Completo                | `bg-yellow-100 text-yellow-700`  |
| `GPT_EXTRAINDO`         | IA Extraindo                | `bg-purple-100 text-purple-700`  |
| `GPT_COMPLETO`          | Processando dados fiscais...| `bg-purple-100 text-purple-700`  |
| `GERANDO_PERGUNTAS`     | Gerando Perguntas           | `bg-purple-100 text-purple-700`  |
| `EXTRACAO_COMPLETA`     | Extração Completa           | `bg-green-100 text-green-700`    |
| `QUESTIONARIO_ENVIADO`  | Aguardando envio            | `bg-orange-100 text-orange-700`  |
| `QUESTIONARIO_PARCIAL`  | Parcialmente Respondido     | `bg-orange-100 text-orange-700`  |
| `QUESTIONARIO_COMPLETO` | Totalmente Respondido       | `bg-green-100 text-green-700`    |
| `VALIDACAO_IA`          | Validação IA                | `bg-indigo-100 text-indigo-700`  |
| `PRONTA`                | Pronta                      | `bg-emerald-100 text-emerald-700`|
| `TRANSMITIDA`           | Transmitida                 | `bg-emerald-200 text-emerald-800`|
| `ERRO`                  | Erro                        | `bg-red-100 text-red-700`        |
| `CPF_INVALIDO`          | CPF Inválido                | `bg-red-100 text-red-700`        |
| `CALIBRACAO_NECESSARIA` | Calibração Necessária       | `bg-amber-100 text-amber-700`    |

Lógica das famílias: cinza = aguardando; azul = extração de PDF; amarelo = OCR;
roxo = IA; laranja = esperando o cliente; verde/esmeralda = concluído (esmeralda
escuro = transmitida, o estado final); vermelho = erro; âmbar = atenção. Um
status novo deve entrar na família semântica correspondente.

## Alerts inline (mensagens dentro de forms/modais)

Receitas em uso no código (ícones lucide-react ao lado do texto):

```tsx
// Erro
<div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
  <AlertCircle className="h-4 w-4 shrink-0" />
  {mensagem}
</div>

// Sucesso
<div className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
  <CheckCircle2 className="h-4 w-4" />
  {mensagem}
</div>

// Aviso
<div className="rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 p-4 flex items-start gap-2">
  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
  {conteudo}
</div>

// Informação/nota
<div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
  {nota}
</div>
```

Observação: os alerts de erro claro (`bg-red-50 border-red-200`) não têm par
`dark:` no código atual — ao criar um novo, adicione
(`dark:bg-red-950/20 dark:border-red-900 dark:text-red-400`), seguindo o padrão
dos de sucesso/aviso.

## Paleta para materiais externos (slides, e-mail, docs, landing)

- Fundo claro: `#FFFFFF`; superfície alternativa `#F1F5F9`.
- Fundo escuro: `#020817`; superfície `#1E293B`.
- Texto: `#020817` sobre claro, `#F8FAFC` sobre escuro; secundário `#64748B`/`#94A3B8`.
- Ação/links: `#2563EB` (sobre claro) ou `#3B82F6` (sobre escuro).
- Marca/acentos de sucesso: `#2ECC71` / `#27AE60` / `#1B7A3D`.
- Erro: `#EF4444`. Bordas: `#E2E8F0` / `#1E293B`. Cantos: 8px.
- Fonte: Inter (fallback `system-ui, -apple-system, 'Segoe UI', Arial`).
- Gradiente de fundo do login (bom para heros): `linear-gradient(to bottom right, #F1F5F9, #EFF6FF)` (slate-100 → blue-50).
