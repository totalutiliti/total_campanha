'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAdminAuth } from '../../../lib/admin/context';

const LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: '/admin', label: 'Visão geral', exact: true },
  { href: '/admin/tenants', label: 'Tenants' },
  { href: '/admin/custos', label: 'Custos' },
  { href: '/admin/auditoria', label: 'Auditoria' },
];

/**
 * Layout das páginas autenticadas do Super Admin.
 * Guarda: manda para /admin/login se anônimo. Renderiza o chrome (header escuro
 * — visualmente distinto do app do tenant) quando autenticado.
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
      <main className="min-h-screen flex items-center justify-center text-sm text-gray-500">
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6 flex-wrap">
          <Link href="/admin" className="font-semibold whitespace-nowrap">
            Total Campanha <span className="text-gray-400 font-normal">· Super Admin</span>
          </Link>
          <nav className="flex-1 flex gap-4 text-sm">
            {LINKS.map((l) => {
              const ativo = l.exact ? pathname === l.href : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    ativo
                      ? 'text-white font-medium'
                      : 'text-gray-400 hover:text-white focus-visible:text-white'
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="text-right text-xs">
            <div className="text-gray-200">{estado.email}</div>
            <div className="text-gray-500">sessão até {expira}</div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-xs text-gray-300 hover:text-white focus-visible:text-white"
          >
            Sair
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">{children}</main>
    </div>
  );
}
