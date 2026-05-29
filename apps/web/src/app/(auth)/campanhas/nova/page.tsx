'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../../../lib/auth/context';
import { canalLabel } from '../../../../lib/campanha-status';
import { mensagemErro } from '../../../../lib/erro';

type Canal = 'EMAIL' | 'WHATSAPP';
interface Template {
  id: string;
  nome: string;
  canal: Canal;
}
interface Segmento {
  id: string;
  nome: string;
}

export default function NovaCampanhaPage() {
  const router = useRouter();
  const { api } = useAuth();

  const [nome, setNome] = useState('');
  const [canal, setCanal] = useState<Canal>('WHATSAPP');
  const [templateId, setTemplateId] = useState('');
  const [segmentoId, setSegmentoId] = useState('');
  const [agendar, setAgendar] = useState(false);
  const [agendadoPara, setAgendadoPara] = useState('');

  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [segmentos, setSegmentos] = useState<Segmento[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setSegmentos(await api<Segmento[]>({ path: '/segmentos' }));
      } catch (e) {
        setErro(mensagemErro(e));
      }
    })();
  }, [api]);

  useEffect(() => {
    let cancelado = false;
    setTemplates(null);
    setTemplateId('');
    (async () => {
      try {
        const ts = await api<Template[]>({ path: `/templates?canal=${canal}` });
        if (!cancelado) setTemplates(ts);
      } catch (e) {
        if (!cancelado) setErro(mensagemErro(e));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [api, canal]);

  // Pré-seleciona o grupo vindo da seleção manual de contatos (?segmento=ID).
  useEffect(() => {
    const seg = new URLSearchParams(window.location.search).get('segmento');
    if (seg) setSegmentoId(seg);
  }, []);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) return setErro('Dê um nome para a campanha.');
    if (!templateId) return setErro('Escolha a mensagem (template) que será enviada.');
    if (!segmentoId) return setErro('Escolha o segmento de contatos que vai receber.');
    if (agendar && !agendadoPara) return setErro('Informe a data e a hora do agendamento.');

    setSalvando(true);
    try {
      const body: Record<string, unknown> = { nome: nome.trim(), canal, templateId, segmentoId };
      if (agendar && agendadoPara) body.agendadoPara = new Date(agendadoPara).toISOString();
      const criada = await api<{ id: string }>({ method: 'POST', path: '/campanhas', body });
      router.push(`/campanhas/${criada.id}`);
    } catch (err) {
      setErro(mensagemErro(err));
      setSalvando(false);
    }
  }

  return (
    <div>
      <Link href="/campanhas" className="text-xs text-gray-600 hover:text-gray-900">
        ← Voltar para campanhas
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold">Nova campanha</h1>

      <form onSubmit={submeter} className="space-y-5 max-w-lg">
        <label className="block">
          <span className="text-sm font-medium text-gray-900">Nome da campanha</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Promoção de novembro"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
          />
          <span className="mt-1 block text-xs text-gray-500">Só para você identificar — o contato não vê.</span>
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-gray-900 mb-1">Canal</legend>
          <div className="flex gap-4">
            {(['WHATSAPP', 'EMAIL'] as Canal[]).map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="canal"
                  checked={canal === c}
                  onChange={() => setCanal(c)}
                  className="accent-gray-900"
                />
                <span>{canalLabel(c)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-sm font-medium text-gray-900">Mensagem (template)</span>
          {templates === null ? (
            <p className="mt-1 text-sm text-gray-500">carregando…</p>
          ) : templates.length === 0 ? (
            <p className="mt-1 text-sm text-gray-600">
              Você ainda não tem template de {canalLabel(canal)}.{' '}
              <Link href="/templates/novo" className="text-gray-900 underline">
                Criar um agora
              </Link>
              .
            </p>
          ) : (
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
            >
              <option value="">Selecione…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-900">Quem vai receber (segmento)</span>
          {segmentos === null ? (
            <p className="mt-1 text-sm text-gray-500">carregando…</p>
          ) : segmentos.length === 0 ? (
            <p className="mt-1 text-sm text-gray-600">
              Você ainda não tem segmentos.{' '}
              <Link href="/segmentos/novo" className="text-gray-900 underline">
                Criar um agora
              </Link>
              .
            </p>
          ) : (
            <select
              value={segmentoId}
              onChange={(e) => setSegmentoId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
            >
              <option value="">Selecione…</option>
              {segmentos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          )}
          <span className="mt-1 block text-xs text-gray-500">
            Só recebem os contatos com opt-in para {canalLabel(canal)}.
          </span>
        </label>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={agendar}
              onChange={(e) => setAgendar(e.target.checked)}
              className="accent-gray-900"
            />
            <span>Agendar para depois</span>
          </label>
          {agendar && (
            <input
              type="datetime-local"
              value={agendadoPara}
              onChange={(e) => setAgendadoPara(e.target.value)}
              className="mt-2 rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
            />
          )}
        </div>

        {erro && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
            {erro}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={salvando}
            className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {salvando ? 'Criando…' : 'Criar campanha'}
          </button>
          <Link
            href="/campanhas"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
          >
            Cancelar
          </Link>
        </div>
        <p className="text-xs text-gray-500">
          Criar não envia nada — você confere o número de destinatários e o custo na próxima tela antes
          de disparar.
        </p>
      </form>
    </div>
  );
}
