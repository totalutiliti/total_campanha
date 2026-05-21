'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '../../../lib/auth/context';

interface Template {
  id: string;
  canal: 'EMAIL' | 'WHATSAPP';
  nome: string;
  assunto: string | null;
  metaTemplateName: string | null;
  metaLanguage: string | null;
  createdAt: string;
}

export default function TemplatesListPage() {
  const { api } = useAuth();
  const [itens, setItens] = useState<Template[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItens(await api<Template[]>({ path: '/templates' }));
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [api]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Templates</h1>
      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
          {erro}
        </p>
      )}
      {itens === null ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum template criado.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-gray-200 bg-white p-3 text-sm flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{t.nome}</div>
                <div className="text-xs text-gray-500">
                  {t.canal === 'EMAIL'
                    ? `Assunto: ${t.assunto ?? '—'}`
                    : `${t.metaTemplateName} (${t.metaLanguage})`}
                </div>
              </div>
              <span
                className={`text-xs rounded px-2 py-0.5 ${t.canal === 'EMAIL' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}
              >
                {t.canal}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
