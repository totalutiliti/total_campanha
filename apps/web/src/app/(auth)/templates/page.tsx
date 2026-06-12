'use client';

import { Loader2, MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AlertErro } from '../../../components/ui/alerts';
import { Badge } from '../../../components/ui/badge';
import { buttonVariants } from '../../../components/ui/button';
import { useAuth } from '../../../lib/auth/context';
import { cn } from '../../../lib/cn';
import { mensagemErro } from '../../../lib/erro';

interface Template {
  id: string;
  canal: 'EMAIL' | 'WHATSAPP';
  nome: string;
  assunto: string | null;
  metaTemplateName: string | null;
  metaLanguage: string | null;
  createdAt: string;
}

const BADGE_CANAL: Record<Template['canal'], string> = {
  EMAIL: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  WHATSAPP: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300',
};

export default function TemplatesListPage() {
  const { api } = useAuth();
  const [itens, setItens] = useState<Template[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItens(await api<Template[]>({ path: '/templates' }));
      } catch (e) {
        setErro(mensagemErro(e));
      }
    })();
  }, [api]);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Mensagens</h1>
        <Link href="/templates/novo" className={cn(buttonVariants(), 'gap-2')}>
          <Plus className="h-4 w-4" />
          Nova mensagem
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Os textos que você dispara nas campanhas, de WhatsApp ou e-mail.
      </p>

      {erro && <AlertErro className="mb-3">{erro}</AlertErro>}

      {itens === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando mensagens…
        </p>
      ) : itens.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Nenhuma mensagem ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie a mensagem que você vai enviar nas campanhas (WhatsApp ou e-mail).
          </p>
          <Link href="/templates/novo" className={cn(buttonVariants(), 'mt-4 gap-2')}>
            <Plus className="h-4 w-4" />
            Nova mensagem
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {itens.map((t) => (
            <li key={t.id}>
              <Link
                href={`/templates/${t.id}`}
                className="block rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.nome}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.canal === 'EMAIL'
                        ? `Assunto: ${t.assunto ?? '—'}`
                        : `${t.metaTemplateName ?? '—'} (${t.metaLanguage ?? '—'})`}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('shrink-0 border-transparent', BADGE_CANAL[t.canal])}
                  >
                    {t.canal === 'EMAIL' ? 'E-mail' : 'WhatsApp'}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
