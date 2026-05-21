'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '../../../lib/auth/context';

interface SegmentoItem {
  id: string;
  nome: string;
  createdAt: string;
  filtros: unknown;
}

export default function SegmentosListPage() {
  const { api } = useAuth();
  const [itens, setItens] = useState<SegmentoItem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItens(await api<SegmentoItem[]>({ path: '/segmentos' }));
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [api]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Segmentos</h1>
        <Link
          href="/segmentos/novo"
          className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium"
        >
          Novo segmento
        </Link>
      </div>

      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
          {erro}
        </p>
      )}

      {itens === null ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum segmento criado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-gray-200 bg-white p-3 text-sm flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{s.nome}</div>
                <div className="text-xs text-gray-500">
                  Criado em {new Date(s.createdAt).toLocaleString('pt-BR')}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
