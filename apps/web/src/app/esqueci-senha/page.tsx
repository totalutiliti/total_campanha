'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { LogoTotal } from '../../components/logo-total';
import { AlertErro, AlertSucesso } from '../../components/ui/alerts';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { apiPostPublic } from '../../lib/api';
import { mensagemErro } from '../../lib/erro';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await apiPostPublic('/auth/forgot', { email });
      setEnviado(true);
    } catch (err) {
      setErro(mensagemErro(err));
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
              <p className="text-sm text-muted-foreground text-center">
                Digite o e-mail que você usa para entrar. Se ele estiver cadastrado, enviamos um
                link para criar uma senha nova.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {enviado ? (
              <div className="space-y-4">
                <AlertSucesso>
                  Pronto! Se o e-mail estiver cadastrado, o link chega em alguns minutos. Olhe
                  também a caixa de spam.
                </AlertSucesso>
                <Link href="/login" className="block text-center text-sm text-primary hover:underline">
                  Voltar para o login
                </Link>
              </div>
            ) : (
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
                {erro && <AlertErro>{erro}</AlertErro>}
                <Button type="submit" className="w-full" disabled={enviando}>
                  {enviando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar link de recuperação'
                  )}
                </Button>
                <Link href="/login" className="block text-center text-sm text-primary hover:underline">
                  Voltar para o login
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
