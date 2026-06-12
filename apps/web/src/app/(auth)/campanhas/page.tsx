'use client';

import { Loader2, Megaphone, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AlertErro } from '../../../components/ui/alerts';
import { Badge } from '../../../components/ui/badge';
import { buttonVariants } from '../../../components/ui/button';
import { useAuth } from '../../../lib/auth/context';
import { canalLabel, statusCampanha } from '../../../lib/campanha-status';
import { cn } from '../../../lib/cn';
import { mensagemErro } from '../../../lib/erro';

interface Campanha {
  id: string;
  nome: string;
  canal: 'EMAIL' | 'WHATSAPP';
  status: string;
  totalDestinatarios: number;
  totalEnviados: number;
  createdAt: string;
}

export default function CampanhasListPage() {
  const { api } = useAuth();
  const [itens, setItens] = useState<Campanha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItens(await api<Campanha[]>({ path: '/campanhas' }));
      } catch (e) {
        setErro(mensagemErro(e));
      }
    })();
  }, [api]);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Campanhas</h1>
        <Link href="/campanhas/nova" className={cn(buttonVariants(), 'gap-2')}>
          <Plus className="h-4 w-4" />
          Nova campanha
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Envie uma mensagem para um grupo de contatos de uma vez.
      </p>

      {erro && <AlertErro className="mb-3">{erro}</AlertErro>}

      {itens === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando campanhas…
        </p>
      ) : itens.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Nenhuma campanha ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Uma campanha junta uma mensagem com um grupo de contatos e dispara.
          </p>
          <Link href="/campanhas/nova" className={cn(buttonVariants(), 'mt-4 gap-2')}>
            <Plus className="h-4 w-4" />
            Criar primeira campanha
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {itens.map((c) => {
            const st = statusCampanha(c.status);
            return (
              <li key={c.id}>
                <Link
                  href={`/campanhas/${c.id}`}
                  className="block rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {canalLabel(c.canal)}
                        {c.totalDestinatarios > 0 &&
                          ` · ${c.totalEnviados}/${c.totalDestinatarios} enviados`}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn('shrink-0 border-transparent', st.classe)}
                    >
                      {st.label}
                    </Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
