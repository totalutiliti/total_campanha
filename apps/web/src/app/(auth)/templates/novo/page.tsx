'use client';

import { ArrowLeft, Mail, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { TemplateForm, TemplatePayload } from '../../../../components/templates/template-form';
import { useAuth } from '../../../../lib/auth/context';
import { mensagemErro } from '../../../../lib/erro';

type Canal = 'EMAIL' | 'WHATSAPP';

export default function NovoTemplatePage() {
  const router = useRouter();
  const { api } = useAuth();
  const [canal, setCanal] = useState<Canal | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(p: TemplatePayload) {
    if (!canal) return;
    setSalvando(true);
    setErro(null);
    try {
      const criado = await api<{ id: string }>({
        method: 'POST',
        path: '/templates',
        body: { canal, ...p },
      });
      router.push(`/templates/${criado.id}`);
    } catch (e) {
      setErro(mensagemErro(e));
      setSalvando(false);
    }
  }

  return (
    <div>
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para mensagens
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Nova mensagem</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Crie o texto que as suas campanhas vão enviar.
      </p>

      {!canal ? (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">Para qual canal é esta mensagem?</p>
          <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setCanal('WHATSAPP')}
              className="rounded-lg border bg-card p-4 text-left text-card-foreground shadow-sm transition-colors hover:border-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageSquare className="h-5 w-5 text-primary" />
              <div className="mt-2 font-medium">WhatsApp</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Aponta para um template aprovado na sua conta Meta.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCanal('EMAIL')}
              className="rounded-lg border bg-card p-4 text-left text-card-foreground shadow-sm transition-colors hover:border-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Mail className="h-5 w-5 text-primary" />
              <div className="mt-2 font-medium">E-mail</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Escreva o assunto e o conteúdo aqui mesmo.
              </div>
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Canal:{' '}
            <strong className="text-foreground">{canal === 'EMAIL' ? 'E-mail' : 'WhatsApp'}</strong>{' '}
            <button
              type="button"
              onClick={() => setCanal(null)}
              className="text-primary hover:underline"
            >
              (trocar)
            </button>
          </p>
          <TemplateForm
            canal={canal}
            salvando={salvando}
            erroServidor={erro}
            textoBotao="Criar mensagem"
            onSalvar={salvar}
          />
        </>
      )}
    </div>
  );
}
