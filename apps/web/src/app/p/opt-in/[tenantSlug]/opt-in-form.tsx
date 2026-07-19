'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { AlertErro, AlertSucesso } from '../../../../components/ui/alerts';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { apiPostPublic } from '../../../../lib/api';
import { mensagemErro } from '../../../../lib/erro';

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
        mensagem: mensagemErro(err, 'Não foi possível enviar. Tente de novo.'),
      });
    }
  }

  if (estado.tipo === 'ok') {
    return (
      <AlertSucesso>
        <h2 className="text-base font-medium">Solicitação registrada</h2>
        <p className="mt-1">
          {canalWhatsapp
            ? ` Seu consentimento para WhatsApp de ${razaoSocial} foi registrado.`
            : ''}
          {canalEmail && estado.doubleOptInEnviado
            ? ' Enviamos um link: o e-mail só será ativado depois que você confirmar.'
            : ''}
          {canalEmail && !estado.doubleOptInEnviado
            ? ' Não conseguimos enviar o link de confirmação do e-mail; tente novamente mais tarde.'
            : ''}
        </p>
      </AlertSucesso>
    );
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-4" noValidate>
      <Campo label="Nome">
        <Input name="nome" type="text" autoComplete="name" />
      </Campo>

      <Campo label="E-mail">
        <Input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required={canalEmail}
        />
      </Campo>

      <Campo label="Telefone (WhatsApp)" hint="Inclua DDD. Ex.: +55 11 99999-9999">
        <Input
          name="telefoneE164"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={canalWhatsapp}
          placeholder="+5511999999999"
        />
      </Campo>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium leading-none">Quero receber por</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={canalEmail}
            onChange={(e) => setCanalEmail(e.target.checked)}
            className="h-4 w-4 rounded accent-primary"
          />
          E-mail
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={canalWhatsapp}
            onChange={(e) => setCanalWhatsapp(e.target.checked)}
            className="h-4 w-4 rounded accent-primary"
          />
          WhatsApp
        </label>
      </fieldset>

      {estado.tipo === 'erro' && <AlertErro>{estado.mensagem}</AlertErro>}

      <Button type="submit" className="w-full" disabled={estado.tipo === 'enviando'}>
        {estado.tipo === 'enviando' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          'Confirmar inscrição'
        )}
      </Button>
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
      <span className="text-sm font-medium leading-none">{label}</span>
      {hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
