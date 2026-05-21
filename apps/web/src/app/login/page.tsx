'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth/context';

type Modo = 'credenciais' | '2fa' | 'multi-tenant';

export default function LoginPage() {
  const router = useRouter();
  const { login, selecionarTenant, estado } = useAuth();

  const [modo, setModo] = useState<Modo>('credenciais');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [totp, setTotp] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Redireciona automaticamente quando o estado vai para 'autenticado'.
  useEffect(() => {
    if (estado.tipo === 'autenticado') {
      router.replace('/');
    } else if (estado.tipo === 'precisa-escolher-tenant') {
      setModo('multi-tenant');
    }
  }, [estado, router]);

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await login(email, senha, modo === '2fa' ? totp : undefined);
      if (r === '2fa') setModo('2fa');
      else if (r === 'multi-tenant') setModo('multi-tenant');
      // 'ok' → o useEffect acima cuida do redirect.
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Email ou senha incorretos.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-lg border border-gray-200 p-6">
        <header className="mb-4">
          <h1 className="text-xl font-semibold">Total Campanha</h1>
          <p className="text-sm text-gray-500">
            {modo === 'credenciais' && 'Entre com seu email e senha.'}
            {modo === '2fa' && 'Confirme o código do seu autenticador.'}
            {modo === 'multi-tenant' && 'Escolha a empresa.'}
          </p>
        </header>

        {modo === 'multi-tenant' && estado.tipo === 'precisa-escolher-tenant' ? (
          <ul className="space-y-2">
            {estado.tenants.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => selecionarTenant(t.id)}
                  className="w-full text-left rounded-md border border-gray-200 p-3 hover:border-gray-900"
                >
                  <div className="font-medium">{t.razaoSocial}</div>
                  <div className="text-xs text-gray-500">{t.slug}</div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <form onSubmit={aoSubmeter} className="space-y-3">
            {modo === 'credenciais' && (
              <>
                <Campo label="Email">
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Campo>
                <Campo label="Senha">
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </Campo>
              </>
            )}

            {modo === '2fa' && (
              <Campo label="Código 2FA">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoFocus
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg font-mono tracking-widest"
                />
              </Campo>
            )}

            {erro && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-md bg-gray-900 text-white py-2 text-sm font-medium disabled:opacity-60"
            >
              {enviando ? 'Entrando…' : modo === '2fa' ? 'Confirmar código' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
