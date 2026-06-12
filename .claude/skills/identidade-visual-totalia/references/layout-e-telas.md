# Layout, login e tema — telas de referência

Fonte da verdade: `frontend/src/components/layout/app-shell.tsx`,
`frontend/src/components/layout/sidebar.tsx`, `frontend/src/app/login/page.tsx`,
`frontend/src/components/theme-provider.tsx`, `frontend/src/components/theme-toggle.tsx`,
`frontend/src/app/layout.tsx`.

## App shell (estrutura de toda página autenticada)

```tsx
<div className="flex h-screen">
  <Sidebar />
  <main className="flex-1 overflow-auto bg-background">
    <div className="p-8">{children}</div>
  </main>
</div>
```

- Conteúdo principal com `p-8` (32px). Páginas novas começam com título
  `text-3xl font-bold` e, em geral, `space-y-6` entre blocos.
- Não existe topbar: navegação e identidade ficam na sidebar.

## Sidebar (`w-64`, fundo `bg-card`)

```tsx
<aside className="flex h-screen w-64 flex-col border-r bg-card">
  {/* Header: logo, 64px de altura */}
  <div className="flex h-16 items-center gap-2 border-b px-6">
    <LogoTotalia className="h-8" />
  </div>

  {/* Navegação */}
  <nav className="flex-1 space-y-1 p-4">
    <Link href={item.href} className={cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    )}>
      <item.icon className="h-4 w-4" />
      {item.name}
    </Link>
  </nav>

  {/* Footer: usuário + sair + toggle de tema */}
  <div className="border-t p-4">
    <div className="mb-3">
      <p className="text-sm font-medium truncate">{user.nome}</p>
      <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
    </div>
    <div className="flex items-center justify-between">
      <button className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
        <LogOut className="h-4 w-4" />
        Sair
      </button>
      <ThemeToggle />
    </div>
  </div>
</aside>
```

Assinaturas visuais a preservar:

- Item ativo: `bg-primary/10 text-primary` (azul a 10% + texto azul) — nunca
  fundo sólido.
- Hover de item inativo: `hover:bg-accent hover:text-accent-foreground`.
- "Sair" fica vermelho só no hover (`hover:bg-destructive/10 hover:text-destructive`).
- Logo na sidebar: `h-8`; itens de nav podem ser filtrados por papel do usuário.

## Tela de login (`app/login/page.tsx`)

Página pública, centralizada, com gradiente suave:

```tsx
<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50">
  <div className="w-full max-w-md px-4">
    <Card className="shadow-xl border-0">
      <CardHeader className="space-y-4 pb-2">
        <div className="flex flex-col items-center gap-3">
          <LogoTotalia className="h-10 mx-auto" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground mt-1">Automação Fiscal</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="seu@email.com" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <PasswordInput id="password" placeholder="••••••••" />
          </div>

          {/* aceite de termos */}
          <div className="flex items-start gap-2">
            <input type="checkbox" id="terms"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
            <label htmlFor="terms" className="text-xs text-muted-foreground leading-tight cursor-pointer">
              Li e aceito a <Link href="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link> e os <Link href="/termos" className="text-primary hover:underline">Termos de Serviço</Link>
            </label>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || !acceptedTerms}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Total IA Contábil - Sistema de Automação IRPF
        </p>
      </CardContent>
    </Card>
  </div>
</div>
```

Padrões a manter em telas públicas (login, esqueci-senha, reset):

- Gradiente `from-slate-100 to-blue-50`, card `max-w-md` `shadow-xl border-0`.
- Logo `h-10` centralizada + tagline em `text-sm text-muted-foreground`.
- CTA de largura total (`className="w-full"`), erro como alert inline acima do
  botão, links em `text-primary hover:underline`.

## Tema claro/escuro

Provider (`components/theme-provider.tsx`) — next-themes:

```tsx
<NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
  {children}
</NextThemesProvider>
```

- `attribute="class"` → classe `dark` no `<html>` (casa com
  `darkMode: ['class']` do tailwind.config.ts).
- Padrão é CLARO e o sistema operacional NÃO manda (`enableSystem={false}`).
  Não mude esses defaults sem decisão explícita do time.

Toggle (`components/theme-toggle.tsx`) — mora no footer da sidebar:

```tsx
<button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
  className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
  title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
  {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
</button>
```

Para qualquer componente novo: tokens semânticos já se adaptam; cores literais
exigem par `dark:` (ex.: `bg-white dark:bg-gray-900`). Componentes que leem
`theme` no cliente precisam de guarda de `mounted` para evitar mismatch de
hidratação (padrão next-themes).

## Tipografia e metadata (`app/layout.tsx`)

```tsx
const inter = Inter({ subsets: ['latin'] });
<body className={inter.className}>

export const metadata: Metadata = {
  title: 'Total IA Contábil - Automação Fiscal',
  description: 'Sistema de automação de declaração de Imposto de Renda',
};
```

- Fonte única: Inter (via `next/font/google`). Não adicione segunda família;
  hierarquia se faz com tamanho/peso (escala na SKILL.md).
- Títulos de página em Title Case natural de pt-BR ("Declarações", "Clientes").
- `title` de páginas novas: `"<Página> | Total IA Contábil"`.
