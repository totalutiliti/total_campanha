'use client';

import { useState } from 'react';

import { paraE164 } from '../../lib/telefone';

export interface ContatoPayload {
  nome: string | null;
  email: string | null;
  telefoneE164: string | null;
  tags: string[];
  optInEmail: boolean;
  optInWhatsapp: boolean;
}

export interface ContatoInicial {
  nome?: string | null;
  email?: string | null;
  telefoneE164?: string | null;
  tags?: string[];
  optInEmail?: boolean;
  optInWhatsapp?: boolean;
}

/**
 * Formulário reutilizável de contato (criar e editar). Normaliza o telefone
 * para E.164 com a mesma função usada na importação, valida que há ao menos
 * e-mail ou telefone, e devolve um payload limpo para o caller persistir.
 */
export function ContatoForm({
  inicial,
  salvando,
  erroServidor,
  textoBotao,
  hrefCancelar = '/contatos',
  onSalvar,
}: {
  inicial?: ContatoInicial;
  salvando: boolean;
  erroServidor: string | null;
  textoBotao: string;
  hrefCancelar?: string;
  onSalvar: (p: ContatoPayload) => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [email, setEmail] = useState(inicial?.email ?? '');
  const [telefone, setTelefone] = useState(inicial?.telefoneE164 ?? '');
  const [tags, setTags] = useState((inicial?.tags ?? []).join(', '));
  const [optInEmail, setOptInEmail] = useState(inicial?.optInEmail ?? false);
  const [optInWhatsapp, setOptInWhatsapp] = useState(inicial?.optInWhatsapp ?? false);
  const [erro, setErro] = useState<string | null>(null);

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const emailLimpo = email.trim().toLowerCase();
    const telLimpo = telefone.trim();
    if (!emailLimpo && !telLimpo) {
      setErro('Informe ao menos um e-mail ou um telefone.');
      return;
    }
    let telefoneE164: string | null = null;
    if (telLimpo) {
      telefoneE164 = paraE164(telLimpo);
      if (!telefoneE164) {
        setErro('Telefone inválido. Use o DDD — ex.: (11) 98765-4321.');
        return;
      }
    }
    const tagsArr = Array.from(
      new Set(
        tags
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      ),
    );
    onSalvar({
      nome: nome.trim() || null,
      email: emailLimpo || null,
      telefoneE164,
      tags: tagsArr,
      optInEmail,
      optInWhatsapp,
    });
  }

  const mensagem = erro ?? erroServidor;

  return (
    <form onSubmit={submeter} className="space-y-4 max-w-lg">
      <Campo label="Nome">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Auto Peças Silva"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        />
      </Campo>

      <Campo label="E-mail">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contato@empresa.com.br"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        />
      </Campo>

      <Campo label="Telefone (com DDD)">
        <input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(11) 98765-4321"
          inputMode="tel"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          Pode digitar com parênteses e traços — ajustamos o formato automaticamente.
        </p>
      </Campo>

      <Campo label="Tags">
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="cliente-ativo, regiao-oeste"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">Separe por vírgula. Use para criar segmentos depois.</p>
      </Campo>

      <fieldset className="rounded-md border border-gray-200 p-3">
        <legend className="px-1 text-xs font-medium text-gray-700">Pode receber campanhas por</legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={optInEmail}
              onChange={(e) => setOptInEmail(e.target.checked)}
              className="accent-gray-900"
            />
            <span>E-mail</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={optInWhatsapp}
              onChange={(e) => setOptInWhatsapp(e.target.checked)}
              className="accent-gray-900"
            />
            <span>WhatsApp</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Marque só se você tem o consentimento da pessoa (LGPD). Sem isso, ela não entra nas
          campanhas daquele canal.
        </p>
      </fieldset>

      {mensagem && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {mensagem}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {salvando ? 'Salvando…' : textoBotao}
        </button>
        <a
          href={hrefCancelar}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      {children}
    </label>
  );
}
