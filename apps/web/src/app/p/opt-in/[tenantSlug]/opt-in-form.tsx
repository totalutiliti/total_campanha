'use client';

import { useState } from 'react';

import { apiPostPublic } from '../../../../lib/api';

interface Props {
  tenantSlug: string;
  razaoSocial: string;
}

type Estado =
  | { tipo: 'form' }
  | { tipo: 'enviando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'ok'; doubleOptInEnviado: boolean };

export function OptInForm({ tenantSlug, razaoSocial }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'form' });
  const [canalEmail, setCanalEmail] = useState(true);
  const [canalWhatsapp, setCanalWhatsapp] = useState(true);

  async function aoSubmeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canalEmail && !canalWhatsapp) {
      setEstado({ tipo: 'erro', mensagem: 'Selecione ao menos um canal.' });
      return;
    }

    const form = new FormData(e.currentTarget);
    const nome = (form.get('nome') as string)?.trim() || undefined;
    const email = (form.get('email') as string)?.trim().toLowerCase() || undefined;
    const telefoneE164 =
      (form.get('telefoneE164') as string)?.trim() || undefined;

    setEstado({ tipo: 'enviando' });
    try {
      const r = await apiPostPublic<{ ok: true; doubleOptInEnviado: boolean }>(
        `/p/opt-in/${encodeURIComponent(tenantSlug)}`,
        {
          nome,
          email,
          telefoneE164,
          canais: { email: canalEmail, whatsapp: canalWhatsapp },
          origem: 'landing-tenant',
        },
      );
      setEstado({ tipo: 'ok', doubleOptInEnviado: r.doubleOptInEnviado });
    } catch (err) {
      setEstado({
        tipo: 'erro',
        mensagem: err instanceof Error ? err.message : 'Falha ao enviar.',
      });
    }
  }

  if (estado.tipo === 'ok') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h2 className="font-medium text-green-900">Inscrição confirmada!</h2>
        <p className="text-sm text-green-800 mt-1">
          Obrigado por se inscrever para receber comunicações de {razaoSocial}.
          {estado.doubleOptInEnviado
            ? ' Enviamos um email de confirmação para você.'
            : ''}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-4" noValidate>
      <Campo label="Nome">
        <input
          name="nome"
          type="text"
          autoComplete="name"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        />
      </Campo>

      <Campo label="Email">
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required={canalEmail}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        />
      </Campo>

      <Campo label="Telefone (WhatsApp)" hint="Inclua DDD. Ex.: +55 11 99999-9999">
        <input
          name="telefoneE164"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={canalWhatsapp}
          placeholder="+5511999999999"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
        />
      </Campo>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-900">Quero receber por</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={canalEmail}
            onChange={(e) => setCanalEmail(e.target.checked)}
          />
          Email
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={canalWhatsapp}
            onChange={(e) => setCanalWhatsapp(e.target.checked)}
          />
          WhatsApp
        </label>
      </fieldset>

      {estado.tipo === 'erro' && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {estado.mensagem}
        </p>
      )}

      <button
        type="submit"
        disabled={estado.tipo === 'enviando'}
        className="w-full rounded-md bg-gray-900 text-white py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
      >
        {estado.tipo === 'enviando' ? 'Enviando...' : 'Confirmar opt-in'}
      </button>
    </form>
  );
}

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      {hint ? <span className="block text-xs text-gray-500 mt-0.5">{hint}</span> : null}
      <div className="mt-1">{children}</div>
    </label>
  );
}
