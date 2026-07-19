import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '../../../../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../../../../components/ui/card';
import { apiGet } from '../../../../../lib/api';
import { cn } from '../../../../../lib/cn';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ConfirmarOptInPage({ params }: PageProps) {
  const { token } = await params;
  let confirmado = false;
  try {
    await apiGet(`/p/opt-in/confirmar/${encodeURIComponent(token)}`);
    confirmado = true;
  } catch {
    confirmado = false;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            {confirmado ? (
              <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden />
            ) : (
              <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
            )}
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              {confirmado ? 'E-mail confirmado' : 'Link inválido ou expirado'}
            </h1>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {confirmado
              ? 'Seu consentimento foi registrado. Você poderá cancelar o recebimento em um clique em qualquer mensagem.'
              : 'Solicite um novo link na página de cadastro da empresa. Nenhum opt-in foi ativado por este link.'}
          </p>
          <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
            Voltar ao início
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
