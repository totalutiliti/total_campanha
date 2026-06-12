'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LogoTotal } from '../../components/logo-total';
import { AlertErro } from '../../components/ui/alerts';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { PasswordInput } from '../../components/ui/password-input';
import { useAuth } from '../../lib/auth/context';
import { mensagemErro } from '../../lib/erro';

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
      setErro(mensagemErro(err, 'E-mail ou senha incorretos.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md px-4">
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex flex-col items-center gap-3">
              <LogoTotal className="h-10 w-auto mx-auto" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground mt-1">
                  {modo === 'credenciais' && 'Campanhas de WhatsApp e e-mail'}
                  {modo === '2fa' && 'Confirme o código do seu aplicativo autenticador.'}
                  {modo === 'multi-tenant' && 'Escolha a empresa para entrar.'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {modo === 'multi-tenant' && estado.tipo === 'precisa-escolher-tenant' ? (
              <ul className="space-y-2">
                {estado.tenants.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selecionarTenant(t.id)}
                      className="w-full text-left rounded-md border p-3 transition-colors hover:border-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="text-sm font-medium">{t.razaoSocial}</div>
                      <div className="text-xs text-muted-foreground">{t.slug}</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <form onSubmit={aoSubmeter} className="space-y-4">
                {modo === 'credenciais' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="senha">Senha</Label>
                        <Link
                          href="/esqueci-senha"
                          className="text-xs text-primary hover:underline"
                        >
                          Esqueci minha senha
                        </Link>
                      </div>
                      <PasswordInput
                        id="senha"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}

                {modo === '2fa' && (
                  <div className="space-y-2">
                    <Label htmlFor="totp">Código de 6 dígitos</Label>
                    <Input
                      id="totp"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      autoFocus
                      value={totp}
                      onChange={(e) => setTotp(e.target.value)}
                      required
                      className="text-center text-lg font-mono tracking-widest"
                    />
                  </div>
                )}

                {erro && <AlertErro>{erro}</AlertErro>}

                <Button type="submit" className="w-full" disabled={enviando}>
                  {enviando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : modo === '2fa' ? (
                    'Confirmar código'
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            )}
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Total Campanha — Campanhas de WhatsApp e E-mail
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
