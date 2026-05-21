import { apiGet } from '../../../../lib/api';

interface PageProps {
  params: { token: string };
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
    result = await apiGet<OptOutResposta>(`/p/opt-out/${encodeURIComponent(params.token)}`);
  } catch (e) {
    erro = e instanceof Error ? e.message : 'Erro inesperado.';
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 flex items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        {result ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h1 className="font-medium text-green-900">Pronto!</h1>
            <p className="text-sm text-green-800 mt-1">
              Você foi removido da lista de {result.razaoSocial} para o canal{' '}
              {result.canal === 'EMAIL' ? 'Email' : 'WhatsApp'}.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h1 className="font-medium text-red-900">Não foi possível processar.</h1>
            <p className="text-sm text-red-800 mt-1">
              {erro ?? 'Link inválido ou expirado.'}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
