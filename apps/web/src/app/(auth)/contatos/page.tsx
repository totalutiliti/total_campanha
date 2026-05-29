'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../../lib/auth/context';
import { mensagemErro } from '../../../lib/erro';

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
  const router = useRouter();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const timer = setTimeout(
      async () => {
        try {
          const q = new URLSearchParams({ porPagina: '200' });
          if (busca.trim()) q.set('busca', busca.trim());
          const r = await api<Resposta>({ path: `/contatos?${q.toString()}` });
          if (!cancelado) {
            setDados(r);
            setErro(null);
          }
        } catch (e) {
          if (!cancelado) setErro(mensagemErro(e));
        }
      },
      busca ? 300 : 0,
    );
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [api, busca]);

  function alternar(id: string) {
    setSel((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function criarGrupoECampanha() {
    const nome = window.prompt(
      'Dê um nome para este grupo de contatos selecionados:',
      'Selecionados',
    );
    if (!nome || !nome.trim()) return;
    setCriando(true);
    setErro(null);
    try {
      const grupo = await api<{ id: string }>({
        method: 'POST',
        path: '/segmentos',
        body: {
          nome: nome.trim(),
          filtros: {
            modo: 'or',
            condicoes: [{ campo: 'id', operador: 'in', valor: Array.from(sel) }],
          },
        },
      });
      router.push(`/campanhas/nova?segmento=${grupo.id}`);
    } catch (e) {
      setErro(mensagemErro(e));
      setCriando(false);
    }
  }

  const total = dados?.paginacao.total ?? 0;
  const mostrando = dados?.itens.length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Contatos</h1>
        <div className="flex gap-2">
          <Link
            href="/contatos/importar"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
          >
            Importar contatos
          </Link>
          <Link
            href="/contatos/novo"
            className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
          >
            Adicionar contato
          </Link>
        </div>
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, e-mail ou telefone…"
        className="mb-3 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
      />

      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 mb-3">
          {erro}
        </p>
      )}

      {sel.size > 0 && (
        <div className="mb-3 flex items-center gap-3 flex-wrap rounded-md border border-gray-900 bg-gray-50 px-3 py-2 text-sm">
          <span className="font-medium">
            {sel.size} selecionado{sel.size === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={criarGrupoECampanha}
            disabled={criando}
            className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none disabled:opacity-60"
          >
            {criando ? 'Criando grupo…' : 'Criar grupo e campanha'}
          </button>
          <button
            type="button"
            onClick={() => setSel(new Set())}
            className="text-gray-600 hover:underline"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {dados === null ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : total === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          {busca ? (
            <p className="text-sm text-gray-600">Nenhum contato encontrado para “{busca}”.</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900">Sua base de contatos está vazia.</p>
              <p className="mt-1 text-sm text-gray-600">
                Importe sua planilha de clientes ou adicione um contato manualmente para começar.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Link
                  href="/contatos/importar"
                  className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-700"
                >
                  Importar contatos
                </Link>
                <Link
                  href="/contatos/novo"
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Adicionar contato
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">
            {total} contato{total === 1 ? '' : 's'} no total
            {mostrando < total ? ` · mostrando os primeiros ${mostrando}` : ''} · marque para criar um
            grupo e enviar.
          </p>
          <ul className="space-y-2">
            {dados.itens.map((c) => (
              <li
                key={c.id}
                className={`flex items-center gap-3 rounded-lg border bg-white p-3 text-sm ${
                  sel.has(c.id) ? 'border-gray-900' : 'border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sel.has(c.id)}
                  onChange={() => alternar(c.id)}
                  aria-label={`Selecionar ${c.nome ?? 'contato'}`}
                  className="accent-gray-900 shrink-0 h-4 w-4"
                />
                <Link
                  href={`/contatos/${c.id}`}
                  className="flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none rounded"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.nome ?? '(sem nome)'}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {c.email ?? '—'} · {c.telefoneE164 ?? '—'}
                      </div>
                      {c.tags.length > 0 && (
                        <div className="mt-1 flex gap-1 flex-wrap">
                          {c.tags.map((t) => (
                            <span key={t} className="text-xs rounded bg-gray-100 px-1.5 py-0.5">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-right shrink-0">
                      {c.optInEmail && <div className="text-green-700">✓ E-mail</div>}
                      {c.optInWhatsapp && <div className="text-green-700">✓ WhatsApp</div>}
                      {!c.optInEmail && !c.optInWhatsapp && (
                        <div className="text-gray-400">sem opt-in</div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
