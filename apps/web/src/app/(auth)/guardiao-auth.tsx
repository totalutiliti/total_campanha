'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '../../lib/auth/context';

/**
 * Redireciona para /login se não autenticado.
 * Renderiza o chrome (header com tenant + nav + logout) quando autenticado.
 *
 * Carregando: renderiza placeholder enquanto o boot do AuthProvider termina.
 */
export function GuardiaoAuth({ children }: { children: React.ReactNode }) {
  const { estado, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (estado.tipo === 'anonimo') {
      router.replace('/login');
    } else if (estado.tipo === 'precisa-escolher-tenant') {
      router.replace('/login');
    }
  }, [estado, router]);

  if (estado.tipo === 'carregando') {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Carregando…
      </main>
    );
  }

  if (estado.tipo !== 'autenticado') {
    // Aguardando redirect — placeholder transiente.
    return null;
  }

  const { me } = estado;

  function sairImpersonacao() {
    try {
      sessionStorage.removeItem('tc:impersonate');
    } catch {
      // ignora
    }
    window.location.assign('/admin/tenants');
  }

  return (
    <div className="min-h-screen flex flex-col">
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
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
          <Link href="/" className="font-semibold">
            Total Campanha
          </Link>
          <nav className="flex-1 flex gap-4 text-sm text-gray-700">
            <Link href="/campanhas" className="hover:text-gray-900">
              Campanhas
            </Link>
            <Link href="/contatos" className="hover:text-gray-900">
              Contatos
            </Link>
            <Link href="/segmentos" className="hover:text-gray-900">
              Grupos
</Link>
            <Link href="/templates" className="hover:text-gray-900">
              Mensagens
</Link>
            <Link href="/conexoes" className="hover:text-gray-900">
              Conexões
            </Link>
          </nav>
          <div className="text-right text-xs">
            <div className="font-medium text-gray-900">{me.tenantAtual?.razaoSocial}</div>
            <div className="text-gray-500">{me.email}</div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="text-xs text-gray-600 hover:text-red-700"
          >
            Sair
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">{children}</main>
    </div>
  );
}
