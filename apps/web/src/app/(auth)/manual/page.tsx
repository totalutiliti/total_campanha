'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { buttonVariants } from '../../../components/ui/button';
import { cn } from '../../../lib/cn';

import { CONTEUDOS } from './conteudo';
import { existeSecao, SECAO_PADRAO, SECOES } from './secoes';

/**
 * Manual do usuário. Abre filtrado pela aba em que a pessoa estava (o link do
 * menu manda `?secao=`); o índice à esquerda permite navegar todas as seções.
 */
export default function ManualPage() {
  const [secaoId, setSecaoId] = useState<string>(() => {
    if (typeof window === 'undefined') return SECAO_PADRAO;
    const p = new URLSearchParams(window.location.search).get('secao');
    return existeSecao(p) ? p : SECAO_PADRAO;
  });

  const secao = SECOES.find((s) => s.id === secaoId) ?? SECOES[0];
  const Conteudo = CONTEUDOS[secao.id] ?? CONTEUDOS[SECAO_PADRAO];

  function selecionar(id: string) {
    setSecaoId(id);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/manual?secao=${id}`);
    }
    document.getElementById('manual-topo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div id="manual-topo">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Manual</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Passo a passo de cada aba. Ele abre já na aba em que você estava — troque de seção pelo
          índice ao lado.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* Índice de seções */}
        <nav aria-label="Seções do manual" className="lg:sticky lg:top-4 lg:self-start">
          <ul className="space-y-1">
            {SECOES.map((s) => {
              const Icone = s.icone;
              const ativo = s.id === secao.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => selecionar(s.id)}
                    aria-current={ativo ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                      ativo
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <Icone className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{s.titulo}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Conteúdo da seção selecionada */}
        <article className="min-w-0 max-w-3xl">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight">{secao.titulo}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{secao.resumo}</p>
            </div>
            <Link
              href={secao.rota}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 gap-1')}
            >
              Abrir a aba
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <Conteudo />
        </article>
      </div>
    </div>
  );
}
