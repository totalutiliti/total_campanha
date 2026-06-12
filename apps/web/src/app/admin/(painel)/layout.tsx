'use client';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { LogoTotal } from '../../../components/logo-total';
import { useAdminAuth } from '../../../lib/admin/context';
import { cn } from '../../../lib/cn';

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: '/admin', label: 'Visão geral', exact: true },
  { href: '/admin/tenants', label: 'Tenants' },
  { href: '/admin/custos', label: 'Custos' },
  { href: '/admin/auditoria', label: 'Auditoria' },
];

/**
 * Layout das páginas autenticadas do Super Admin.
 * Guarda: manda para /admin/login se anônimo. Renderiza o chrome quando
 * autenticado: header escuro fixo (bg-slate-950 — personalidade de ferramenta
 * interna, visualmente distinto do app do tenant); o resto da página usa os
 * tokens da identidade.
 */
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const { estado, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (estado.tipo === 'anonimo') router.replace('/admin/login');
  }, [estado, router]);

  if (estado.tipo === 'carregando') {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </main>
    );
  }

  if (estado.tipo !== 'autenticado') {
    // Aguardando redirect.
    return null;
  }

  const expira = new Date(estado.expEm).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header escuro fixo: par único claro/escuro (exceção documentada da identidade). */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6 flex-wrap">
          <Link
            href="/admin"
            className="flex items-center gap-2 whitespace-nowrap rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <LogoTotal className="h-8 w-auto" />
            <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
              Super Admin
            </span>
          </Link>
          <nav className="flex-1 flex gap-1 text-sm">
            {LINKS.map((l) => {
              const ativo = l.exact ? pathname === l.href : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                    ativo
                      ? 'bg-white/10 font-medium text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white',
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="text-right text-xs">
            <div className="text-slate-200">{estado.email}</div>
            <div className="text-slate-500">sessão até {expira}</div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">{children}</main>
    </div>
  );
}
