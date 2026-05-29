'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '../../../lib/auth/context';
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

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const lista = await api<SegmentoItem[]>({ path: '/segmentos' });
        if (!ativo) return;
        setItens(lista);
        // Contagem de contatos por segmento (best-effort, em paralelo).
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

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Grupos</h1>
        <Link
          href="/segmentos/novo"
          className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        >
          Novo grupo
        </Link>
      </div>
      <p className="text-xs text-gray-500 mb-4">Grupos de contatos para mirar nas campanhas.</p>

      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
          {erro}
        </p>
      )}

      {itens === null ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : itens.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm font-medium text-gray-900">Nenhum grupo ainda.</p>
          <p className="mt-1 text-sm text-gray-600">
            Um grupo reúne contatos (ex.: clientes com opt-in de WhatsApp) para você enviar de uma
            vez.
          </p>
          <Link
            href="/segmentos/novo"
            className="mt-4 inline-block rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-700"
          >
            Novo grupo
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {itens.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-gray-200 bg-white p-3 text-sm flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{s.nome}</div>
                <div className="text-xs text-gray-500">
                  Criado em {new Date(s.createdAt).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div className="text-xs text-gray-600 shrink-0 tabular-nums">
                {s.id in contagens
                  ? `${contagens[s.id]} contato${contagens[s.id] === 1 ? '' : 's'}`
                  : '…'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
