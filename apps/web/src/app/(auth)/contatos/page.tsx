'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '../../../lib/auth/context';

interface Contato {
  id: string;
  nome: string | null;
  email: string | null;
  telefoneE164: string | null;
  tags: string[];
  optInEmail: boolean;
  optInWhatsapp: boolean;
  createdAt: string;
}

interface Resposta {
  itens: Contato[];
  paginacao: { pagina: number; porPagina: number; total: number; totalPaginas: number };
}

export default function ContatosListPage() {
  const { api } = useAuth();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setDados(await api<Resposta>({ path: '/contatos?porPagina=50' }));
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [api]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Contatos</h1>
      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
          {erro}
        </p>
      )}
      {dados === null ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">
            {dados.paginacao.total} contato{dados.paginacao.total === 1 ? '' : 's'} no total.
          </p>
          <ul className="space-y-2">
            {dados.itens.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-gray-200 bg-white p-3 text-sm flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{c.nome ?? '(sem nome)'}</div>
                  <div className="text-xs text-gray-500">
                    {c.email ?? '—'} · {c.telefoneE164 ?? '—'}
                  </div>
                  {c.tags.length > 0 && (
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          className="text-xs rounded bg-gray-100 px-1.5 py-0.5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-right">
                  {c.optInEmail && <div className="text-green-700">✓ Email</div>}
                  {c.optInWhatsapp && <div className="text-green-700">✓ WhatsApp</div>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
