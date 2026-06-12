'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LogoTotal } from '../../../components/logo-total';
import { AlertErro } from '../../../components/ui/alerts';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { PasswordInput } from '../../../components/ui/password-input';
import { useAdminAuth } from '../../../lib/admin/context';
import { mensagemErro } from '../../../lib/erro';

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
      setErro(mensagemErro(err, 'E-mail ou senha incorretos.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md px-4">
        <Card className="border-0 shadow-xl">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex flex-col items-center gap-3">
              <LogoTotal className="h-10 w-auto mx-auto" />
              <div className="text-center">
                <h1 className="text-xl font-semibold tracking-tight">Painel Super Admin</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Acesso restrito à operação da plataforma.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={aoSubmeter} className="space-y-4">
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
                <Label htmlFor="senha">Senha</Label>
                <PasswordInput
                  id="senha"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </div>

              {erro && <AlertErro>{erro}</AlertErro>}

              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Total Campanha — ferramenta interna de operação
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
