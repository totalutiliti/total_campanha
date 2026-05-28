'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ContatoForm, ContatoPayload } from '../../../../components/contatos/contato-form';
import { useAuth } from '../../../../lib/auth/context';
import { mensagemErro } from '../../../../lib/erro';

interface Contato {
  id: string;
  nome: string | null;
  email: string | null;
  telefoneE164: string | null;
  tags: string[];
  optInEmail: boolean;
  optInWhatsapp: boolean;
}

export default function EditarContatoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuth();

  const [contato, setContato] = useState<Contato | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [lgpd, setLgpd] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setContato(await api<Contato>({ path: `/contatos/${id}` }));
      } catch (e) {
        setErroCarga(mensagemErro(e));
      } finally {
        setCarregando(false);
      }
    })();
  }, [api, id]);

  async function salvar(p: ContatoPayload) {
    setSalvando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = {
        email: p.email,
        telefoneE164: p.telefoneE164,
        tags: p.tags,
        optInEmail: p.optInEmail,
        optInWhatsapp: p.optInWhatsapp,
      };
      if (p.nome) body.nome = p.nome;
      await api({ method: 'PATCH', path: `/contatos/${id}`, body });
      router.push('/contatos');
    } catch (e) {
      setErro(mensagemErro(e));
      setSalvando(false);
    }
  }

  async function excluir() {
    const msg = lgpd
      ? 'Apagar definitivamente este contato e anonimizar o histórico de mensagens? Isso não pode ser desfeito.'
      : 'Excluir este contato? Ele deixa de aparecer na lista e não recebe mais campanhas.';
    if (!window.confirm(msg)) return;
    setExcluindo(true);
    setErro(null);
    try {
      await api({ method: 'DELETE', path: `/contatos/${id}${lgpd ? '?lgpd=true' : ''}` });
      router.push('/contatos');
    } catch (e) {
      setErro(mensagemErro(e));
      setExcluindo(false);
    }
  }

  return (
    <div>
      <Link href="/contatos" className="text-xs text-gray-600 hover:text-gray-900">
        ← Voltar para contatos
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold">Editar contato</h1>

      {carregando ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : erroCarga ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {erroCarga}
        </p>
      ) : contato ? (
        <>
          <ContatoForm
            inicial={contato}
            salvando={salvando}
            erroServidor={erro}
            textoBotao="Salvar alterações"
            onSalvar={salvar}
          />

          <div className="mt-10 max-w-lg rounded-md border border-red-200 bg-red-50/40 p-4">
            <h2 className="text-sm font-medium text-red-800">Excluir contato</h2>
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={lgpd}
                onChange={(e) => setLgpd(e.target.checked)}
                className="accent-red-700"
              />
              Apagar definitivamente (direito ao esquecimento — LGPD)
            </label>
            <button
              type="button"
              onClick={excluir}
              disabled={excluindo}
              className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:outline-none disabled:opacity-60"
            >
              {excluindo ? 'Excluindo…' : 'Excluir contato'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
