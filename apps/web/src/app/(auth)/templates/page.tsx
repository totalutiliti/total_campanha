'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '../../../lib/auth/context';
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
      <div className="flex items-center justify-between gap-4 mb-1 flex-wrap">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <Link
          href="/templates/novo"
          className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        >
          Novo template
        </Link>
      </div>
      <p className="text-xs text-gray-500 mb-4">As mensagens que você dispara nas campanhas.</p>

      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3">{erro}</p>
      )}

      {itens === null ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : itens.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm font-medium text-gray-900">Nenhum template ainda.</p>
          <p className="mt-1 text-sm text-gray-600">
            Crie a mensagem que você vai enviar nas campanhas (WhatsApp ou e-mail).
          </p>
          <Link
            href="/templates/novo"
            className="mt-4 inline-block rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-700"
          >
            Novo template
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {itens.map((t) => (
            <li key={t.id}>
              <Link
                href={`/templates/${t.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-3 text-sm hover:border-gray-400 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.nome}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {t.canal === 'EMAIL'
                        ? `Assunto: ${t.assunto ?? '—'}`
                        : `${t.metaTemplateName ?? '—'} (${t.metaLanguage ?? '—'})`}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-xs rounded px-2 py-0.5 ${t.canal === 'EMAIL' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}
                  >
                    {t.canal === 'EMAIL' ? 'E-mail' : 'WhatsApp'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
