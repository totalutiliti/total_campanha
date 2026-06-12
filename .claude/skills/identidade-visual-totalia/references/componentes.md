# Componentes — receitas com classes exatas

Fonte da verdade: `frontend/src/components/ui/` e exemplos reais citados por
path. Importe e reuse esses componentes; só crie markup novo quando não houver
componente equivalente — e aí siga as receitas abaixo à risca.

Utilitário obrigatório: `cn()` de `frontend/src/lib/utils.ts` (clsx +
tailwind-merge) para compor classes.

## Botões (`components/ui/button.tsx`)

Base (sempre presente):

```
inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm
font-medium ring-offset-background transition-colors focus-visible:outline-none
focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50
```

| Variante      | Classes                                                                  | Quando usar                     |
| ------------- | ------------------------------------------------------------------------ | ------------------------------- |
| `default`     | `bg-primary text-primary-foreground hover:bg-primary/90`                 | Ação principal (1 por contexto) |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90`     | Excluir, cancelar definitivo    |
| `outline`     | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` | Ação secundária ("Cancelar" em modais) |
| `secondary`   | `bg-secondary text-secondary-foreground hover:bg-secondary/80`           | Ação terciária                  |
| `ghost`       | `hover:bg-accent hover:text-accent-foreground`                           | Ações em toolbars/ícones        |
| `link`        | `text-primary underline-offset-4 hover:underline`                        | Ação que parece link            |

Tamanhos: `default` = `h-10 px-4 py-2` · `sm` = `h-9 rounded-md px-3` ·
`lg` = `h-11 rounded-md px-8` · `icon` = `h-10 w-10`.

Botão com ícone (gap padrão):

```tsx
<Button onClick={...} className="gap-2">
  <Send className="h-4 w-4" />
  Enviar Transmitida
</Button>
```

Exceção verde de sucesso (ex.: enviar transmitida, `app/declaracoes/page.tsx`):
`className="gap-2 bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-600"`.

Estado de loading:

```tsx
<Button disabled={isSubmitting}>
  {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : 'Salvar'}
</Button>
```

## Inputs e formulários (`components/ui/input.tsx`, `label.tsx`, `password-input.tsx`)

Input:

```
flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
ring-offset-background placeholder:text-muted-foreground
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
```

Label: `text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70`

Campo completo (padrão de form — espaçamento `space-y-2` por campo,
`space-y-4` entre campos):

```tsx
<form onSubmit={handleSubmit} className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="email">E-mail</Label>
    <Input id="email" type="email" placeholder="seu@email.com" />
  </div>
</form>
```

PasswordInput (input com `pr-10` + botão de olho):

```tsx
<div className="relative">
  <input type={show ? 'text' : 'password'} className="(classes do Input) pr-10" />
  <button type="button" onClick={() => setShow(v => !v)}
    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
  </button>
</div>
```

Busca em listas/modais (variação compacta vista em `app/declaracoes/page.tsx`):

```tsx
<input type="text" placeholder="Buscar por nome ou CPF..."
  className="w-full rounded border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
```

Checkbox / radio / select nativos estilizados:

```tsx
<input type="checkbox" className="rounded accent-primary h-4 w-4" />
<select className="rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary">...</select>
```

Erros de validação: alert inline de erro (ver `cores-e-tokens.md`) acima do
botão de submit — não há mensagens por campo no padrão atual.

## Cards (`components/ui/card.tsx`)

```tsx
<Card>        // rounded-lg border bg-card text-card-foreground shadow-sm
  <CardHeader>   // flex flex-col space-y-1.5 p-6
    <CardTitle>     // text-2xl font-semibold leading-none tracking-tight
    <CardDescription> // text-sm text-muted-foreground
  </CardHeader>
  <CardContent>  // p-6 pt-0
</Card>
```

KPIs de dashboard: valor em `text-2xl font-bold`, rótulo em
`text-sm text-muted-foreground`.

## Badges (`components/ui/badge.tsx`)

Base: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors`

| Variante      | Classes                                                  |
| ------------- | -------------------------------------------------------- |
| `default`     | `border-transparent bg-primary text-primary-foreground`  |
| `secondary`   | `border-transparent bg-secondary text-secondary-foreground` |
| `destructive` | `border-transparent bg-destructive text-destructive-foreground` |
| `outline`     | `text-foreground`                                        |

Para status do pipeline, passe o par do mapa `STATUS_COLORS` via `className`
(ex.: `<Badge className="bg-emerald-200 text-emerald-800">Transmitida</Badge>`);
mapa completo em `cores-e-tokens.md`.

## Dialog / Modal / Pop-up (`components/ui/dialog.tsx`)

Implementação própria (sem Radix). Anatomia completa:

```tsx
// Overlay + posicionamento
<div className="fixed inset-0 z-50">
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
  <div className="fixed inset-0 flex items-center justify-center p-4">

    {/* DialogContent */}
    <div className={cn(
      'relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg',
      'animate-in fade-in-0 zoom-in-95',
    )}>
      {/* Botão X de fechar */}
      <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <X className="h-4 w-4" />
      </button>

      {/* DialogHeader */}
      <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
        <h2 className="text-lg font-semibold">Título</h2>
        <p className="text-sm text-muted-foreground">Descrição opcional</p>
      </div>

      {/* corpo */}

      {/* DialogFooter */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={handleConfirm}>Confirmar</Button>
      </div>
    </div>
  </div>
</div>
```

Convenções de modal:

- Overlay sempre `bg-black/50` (com ou sem `backdrop-blur-sm`); clicar fora fecha.
- Container: `w-full max-w-lg rounded-lg border p-6` + `bg-background shadow-lg`
  (dialog.tsx) ou `bg-card shadow-xl` (modais custom, ex.
  `components/reprocess/reprocess-modal.tsx:128`); `max-w-2xl`+ para conteúdo largo.
- Header de modal custom: `text-xl font-bold` + X em
  `text-muted-foreground hover:text-foreground`.
- Footer: Cancelar (`variant="outline"`) à esquerda do CTA; gap `gap-2` ou `sm:space-x-2`.
- Confirmação destrutiva: CTA `variant="destructive"`, título claro
  ("Excluir cliente?"), consequência no corpo em `text-sm text-muted-foreground`.
- Animação de entrada: `animate-in fade-in-0 zoom-in-95` (plugin tailwindcss-animate).

## Toast / notificação flutuante (`components/update-toast.tsx`)

Padrão: fixo na parte inferior central, branco/escuro com borda colorida pelo
tom da mensagem (azul = informativo):

```tsx
<div role="alert"
  className="fixed bottom-4 left-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-blue-200 bg-white shadow-xl dark:border-blue-900 dark:bg-gray-900">
  <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Título</p>
    <button className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
      <X className="h-4 w-4" />
    </button>
  </div>
  <div className="space-y-4 px-5 py-4">{/* conteúdo */}</div>
</div>
```

Não há lib de toast (react-hot-toast/sonner) — não adicione; siga esse padrão.
Feedback de sucesso/erro pós-ação dentro de modais usa os alerts inline.

## Tabelas

```tsx
<table className="w-full">
  <thead>
    <tr className="border-b bg-muted/50">
      <th className="p-2 text-left text-xs font-medium">CPF</th>
      ...
    </tr>
  </thead>
  <tbody>
    <tr className="border-b last:border-0">
      <td className="p-2 text-sm">...</td>
    </tr>
  </tbody>
</table>
```

Linhas com hover: `hover:bg-muted/50`. Células de status recebem `<Badge>` com
o par de cores do status.

## Ícones (lucide-react)

Tamanho padrão `h-4 w-4` (inline/botões) ou `h-5 w-5` (headers/destaques).
Vocabulário em uso: navegação `Menu Search Filter ChevronDown ChevronRight`;
ações `Plus Play RefreshCw Download Upload Send ExternalLink`; status
`AlertTriangle AlertCircle CheckCircle2 X`; loading `Loader2` (com
`animate-spin`); campos `Eye EyeOff Folder FolderOpen File`; dados `BarChart3`.
Antes de importar um ícone novo, verifique se um destes já comunica a ideia.

## Espaçamento, borda e sombra (resumo)

- Padding: `p-6` (cards/modais), `px-3 py-2` (inputs), `p-2` (células).
- Vertical entre seções: `space-y-4` a `space-y-6`; entre campos: `space-y-2`.
- Gaps: `gap-2` (botões/ícones), `gap-3`/`gap-4` (blocos).
- Cantos: `rounded-lg` (superfícies), `rounded-md` (controles), `rounded-full`
  (badges), `rounded-xl` (toasts).
- Sombras: `shadow-sm` (cards em página), `shadow-lg`/`shadow-xl` (flutuantes).
- Transições: `transition-colors` em tudo interativo.
