'use client';

import { FolderOpen, Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AlertErro } from '../../../components/ui/alerts';
import { Button, buttonVariants } from '../../../components/ui/button';
import { useAuth } from '../../../lib/auth/context';
import { cn } from '../../../lib/cn';
import { mensagemErro } from '../../../lib/erro';

interface SegmentoItem {
  id: string;
  nome: string;
  createdAt: string;
}

export default function SegmentosListPage() {
  const { api } = useAuth();
  const [itens, setItens] = useState<SegmentoItem[] | null>(null);
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const lista = await api<SegmentoItem[]>({ path: '/segmentos' });
        if (!ativo) return;
        setItens(lista);
        // Contagem de contatos por grupo (best-effort, em paralelo).
        lista.forEach((s) => {
          api<{ total: number }>({ path: `/segmentos/${s.id}/contatos/contagem` })
            .then((r) => ativo && setContagens((c) => ({ ...c, [s.id]: r.total })))
            .catch(() => {});
        });
      } catch (e) {
        if (ativo) setErro(mensagemErro(e));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [api]);

  async function excluir(id: string, nome: string) {
    if (
      !window.confirm(
        `Excluir o grupo "${nome}"? As campanhas que já usaram ele não são afetadas.`,
      )
    ) {
      return;
    }
    setExcluindo(id);
    setErro(null);
    try {
      await api({ method: 'DELETE', path: `/segmentos/${id}` });
      setItens((atual) => (atual ? atual.filter((s) => s.id !== id) : atual));
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Grupos</h1>
        <Link href="/segmentos/novo" className={cn(buttonVariants(), 'gap-2')}>
          <Plus className="h-4 w-4" />
          Novo grupo
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Grupos de contatos para escolher quem recebe cada campanha.
      </p>

      {erro && <AlertErro className="mb-3">{erro}</AlertErro>}

      {itens === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando grupos…
        </p>
      ) : itens.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Nenhum grupo ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Um grupo reúne contatos (ex.: clientes com opt-in de WhatsApp) para você enviar de uma
            vez.
          </p>
          <Link href="/segmentos/novo" className={cn(buttonVariants(), 'mt-4 gap-2')}>
            <Plus className="h-4 w-4" />
            Novo grupo
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {itens.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-sm transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{s.nome}</div>
                <div className="text-xs text-muted-foreground">
                  Criado em {new Date(s.createdAt).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {s.id in contagens
                    ? `${contagens[s.id]} contato${contagens[s.id] === 1 ? '' : 's'}`
                    : '…'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => excluir(s.id, s.nome)}
                  disabled={excluindo === s.id}
                  className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {excluindo === s.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Excluindo…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </>
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
