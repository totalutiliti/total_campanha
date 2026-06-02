'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAdminAuth } from '../../../lib/admin/context';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, estado } = useAdminAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Quando autenticado, vai para o painel.
  useEffect(() => {
    if (estado.tipo === 'autenticado') router.replace('/admin');
  }, [estado, router]);

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(email, senha);
      // 'autenticado' → o useEffect acima redireciona.
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'E-mail ou senha incorretos.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 p-6 shadow-xl">
        <header className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Total Campanha
          </p>
          <h1 className="text-xl font-semibold">Painel Super Admin</h1>
          <p className="mt-1 text-sm text-gray-500">
            Acesso restrito à operação da plataforma.
          </p>
        </header>

        <form onSubmit={aoSubmeter} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-900">E-mail</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-900">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
            />
          </label>

          {erro && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-md bg-gray-900 text-white py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
