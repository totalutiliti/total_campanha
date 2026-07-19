import { AlertErro, AlertSucesso } from '../../../../components/ui/alerts';
import { Card, CardContent, CardHeader } from '../../../../components/ui/card';
import { apiGet } from '../../../../lib/api';
import { mensagemErro } from '../../../../lib/erro';

interface PageProps {
  params: Promise<{ token: string }>;
}

interface OptOutResposta {
  ok: true;
  razaoSocial: string;
  canal: 'EMAIL' | 'WHATSAPP';
}

export default async function OptOutPage({ params }: PageProps) {
  // Opt-out one-click é GET para que cliques em links de email funcionem
  // sem JS (RULES 5.2). A API faz o trabalho no GET /p/opt-out/:token.
  let result: OptOutResposta | null = null;
  let erro: string | null = null;
  try {
    const { token } = await params;
    result = await apiGet<OptOutResposta>(`/p/opt-out/${encodeURIComponent(token)}`);
  } catch (e) {
    erro = mensagemErro(e, 'Link inválido ou expirado.');
  }

  // Página pública do TENANT: o nome da empresa é o título (sem logo da plataforma).
  return (
    <main className="flex min-h-screen items-start justify-center bg-muted/40 px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Card className="shadow-sm">
          <CardHeader>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              {result ? result.razaoSocial : 'Descadastro'}
            </h1>
            <p className="text-sm text-muted-foreground">Pedido para não receber mais mensagens</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {result ? (
              <AlertSucesso>
                <p className="text-base font-medium">Pronto!</p>
                <p className="mt-1">
                  Você foi removido da lista de {result.razaoSocial} para o canal{' '}
                  {result.canal === 'EMAIL' ? 'e-mail' : 'WhatsApp'}.
                </p>
              </AlertSucesso>
            ) : (
              <AlertErro>
                <p className="text-base font-medium">Não foi possível processar.</p>
                <p className="mt-1">{erro ?? 'Link inválido ou expirado.'}</p>
              </AlertErro>
            )}
            <p className="text-xs text-muted-foreground">
              {result
                ? 'Seu pedido foi registrado conforme a LGPD e vale para o canal indicado acima.'
                : 'Se o problema continuar, entre em contato com a empresa que enviou a mensagem.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
