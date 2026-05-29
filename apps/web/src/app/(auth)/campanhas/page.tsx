'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '../../../lib/auth/context';
import { canalLabel, statusCampanha } from '../../../lib/campanha-status';
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
      <div className="flex items-center justify-between gap-4 mb-1 flex-wrap">
        <h1 className="text-2xl font-semibold">Campanhas</h1>
        <Link
          href="/campanhas/nova"
          className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        >
          Nova campanha
        </Link>
      </div>
      <p className="text-xs text-gray-500 mb-4">Envie uma mensagem para um grupo de contatos.</p>

      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3">{erro}</p>
      )}

      {itens === null ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : itens.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm font-medium text-gray-900">Nenhuma campanha ainda.</p>
          <p className="mt-1 text-sm text-gray-600">
            Uma campanha junta uma mensagem (template) com um grupo de contatos (segmento) e dispara.
          </p>
          <Link
            href="/campanhas/nova"
            className="mt-4 inline-block rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-700"
          >
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
                  className="block rounded-lg border border-gray-200 bg-white p-3 text-sm hover:border-gray-400 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.nome}</div>
                      <div className="text-xs text-gray-500">
                        {canalLabel(c.canal)}
                        {c.totalDestinatarios > 0 &&
                          ` · ${c.totalEnviados}/${c.totalDestinatarios} enviados`}
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs rounded px-2 py-0.5 ${st.classe}`}>
                      {st.label}
                    </span>
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
