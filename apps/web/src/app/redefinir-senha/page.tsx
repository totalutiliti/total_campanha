'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { LogoTotal } from '../../components/logo-total';
import { AlertErro, AlertSucesso } from '../../components/ui/alerts';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { PasswordInput } from '../../components/ui/password-input';
import { apiPostPublic } from '../../lib/api';
import { mensagemErro } from '../../lib/erro';

function FormRedefinir() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== confirma) {
      setErro('As duas senhas precisam ser iguais.');
      return;
    }
    if (senha.length < 8) {
      setErro('A senha precisa de pelo menos 8 caracteres.');
      return;
    }
    setEnviando(true);
    try {
      await apiPostPublic('/auth/reset', { token, novaSenha: senha });
      setOk(true);
      setTimeout(() => router.replace('/login'), 2500);
    } catch (err) {
      setErro(
        mensagemErro(
          err,
          'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
        ),
      );
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <AlertErro>
          Este link está incompleto. Abra o link mais recente que enviamos por e-mail, ou peça um
          novo.
        </AlertErro>
        <Link href="/esqueci-senha" className="block text-center text-sm text-primary hover:underline">
          Pedir um novo link
        </Link>
      </div>
    );
  }

  if (ok) {
    return (
      <AlertSucesso>Senha alterada! Levando você para o login…</AlertSucesso>
    );
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="senha">Senha nova</Label>
        <PasswordInput
          id="senha"
          autoComplete="new-password"
          placeholder="Pelo menos 8 caracteres"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirma">Repita a senha nova</Label>
        <PasswordInput
          id="confirma"
          autoComplete="new-password"
          placeholder="Digite de novo para confirmar"
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          required
        />
      </div>
      {erro && <AlertErro>{erro}</AlertErro>}
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Salvar senha nova'
        )}
      </Button>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md px-4">
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-4 pb-2">
            <div className="flex flex-col items-center gap-3">
              <LogoTotal className="h-10 w-auto mx-auto" />
              <p className="text-sm text-muted-foreground text-center">
                Crie uma senha nova para a sua conta.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <FormRedefinir />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
