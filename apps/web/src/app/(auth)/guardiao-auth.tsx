'use client';

import {
  BookOpen,
  CreditCard,
  Home,
  Inbox,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Plug,
  UserCog,
  Users,
  FolderOpen,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LogoTotal } from '../../components/logo-total';
import { ThemeToggle } from '../../components/theme-toggle';
import { useAuth } from '../../lib/auth/context';
import { cn } from '../../lib/cn';

import { BannerConta } from './banner-conta';
import { secaoDaRota } from './manual/secoes';

interface ItemNav {
  nome: string;
  href: string;
  icone: typeof Home;
  somenteAdmin?: boolean;
  /** Item do Manual: o href é contextual (abre filtrado pela aba atual). */
  manual?: boolean;
}

/**
 * Navegação pensada para o vendedor: nomes do dia a dia, sem jargão.
 * "Plano" só aparece para o Administrador (RBAC no servidor continua valendo).
 */
const ITENS_NAV: ItemNav[] = [
  { nome: 'Início', href: '/', icone: Home },
  { nome: 'Campanhas', href: '/campanhas', icone: Megaphone },
  { nome: 'Contatos', href: '/contatos', icone: Users },
  { nome: 'Grupos', href: '/segmentos', icone: FolderOpen },
  { nome: 'Mensagens', href: '/templates', icone: MessageSquare },
  { nome: 'Respostas', href: '/respostas', icone: Inbox },
  { nome: 'Conexões', href: '/conexoes', icone: Plug },
  { nome: 'Manual', href: '/manual', icone: BookOpen, manual: true },
  { nome: 'Plano', href: '/plano', icone: CreditCard, somenteAdmin: true },
  { nome: 'Minha conta', href: '/minha-conta', icone: UserCog },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  EDITOR_CAMPANHA: 'Editor de campanha',
  VISUALIZADOR: 'Visualizador',
};

/**
 * Redireciona para /login se não autenticado. Quando autenticado, renderiza o
 * app shell da identidade: sidebar w-64 (logo, navegação, usuário/sair/tema).
 */
export function GuardiaoAuth({ children }: { children: React.ReactNode }) {
  const { estado, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (estado.tipo === 'anonimo' || estado.tipo === 'precisa-escolher-tenant') {
      router.replace('/login');
    }
  }, [estado, router]);

  // Fecha o menu mobile ao navegar.
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  if (estado.tipo === 'carregando') {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </main>
    );
  }

  if (estado.tipo !== 'autenticado') {
    return null;
  }

  const { me } = estado;
  const itens = ITENS_NAV.filter((i) => !i.somenteAdmin || me.role === 'ADMIN');

  function sairImpersonacao() {
    try {
      sessionStorage.removeItem('tc:impersonate');
    } catch {
      // ignora
    }
    window.location.assign('/admin/tenants');
  }

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center justify-between gap-2 border-b px-6">
        <Link href="/" aria-label="Início">
          <LogoTotal className="h-8 w-auto" />
        </Link>
        <button
          type="button"
          className="md:hidden rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={() => setMenuAberto(false)}
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {itens.map((item) => {
          // O Manual abre filtrado pela aba atual (?secao=...).
          const href = item.manual ? `/manual?secao=${secaoDaRota(pathname)}` : item.href;
          const ativo = item.manual
            ? pathname.startsWith('/manual')
            : item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const Icone = item.icone;
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                ativo
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icone className="h-4 w-4" />
              {item.nome}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="mb-3">
          <p className="text-sm font-medium truncate">{me.tenantAtual?.razaoSocial}</p>
          <p className="text-xs text-muted-foreground truncate">{me.email}</p>
          {me.role ? (
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[me.role] ?? me.role}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen flex-col">
      {estado.impersonando && (
        <div className="bg-amber-400 text-amber-950 text-sm px-4 py-2 flex items-center justify-center gap-3 flex-wrap">
          <span>
            👁 Você está vendo como <strong>{estado.impersonando.nome}</strong> — modo Super Admin.
          </span>
          <button
            type="button"
            onClick={sairImpersonacao}
            className="underline font-medium hover:text-amber-900 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-900"
          >
            Sair da visão
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <div className="hidden md:block">{sidebar}</div>

        {/* Sidebar mobile (overlay) */}
        {menuAberto && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setMenuAberto(false)}
              aria-hidden
            />
            <div className="fixed inset-y-0 left-0 z-50">{sidebar}</div>
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Topbar mobile */}
          <div className="flex h-14 items-center gap-3 border-b bg-card px-4 md:hidden">
            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <LogoTotal className="h-7 w-auto" />
          </div>

          <main className="flex-1 overflow-auto bg-background">
            <BannerConta isAdmin={me.role === 'ADMIN'} />
            <div className="p-4 md:p-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
