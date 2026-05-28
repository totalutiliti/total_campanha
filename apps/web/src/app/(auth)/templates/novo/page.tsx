'use client';

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
      <Link href="/templates" className="text-xs text-gray-600 hover:text-gray-900">
        ← Voltar para templates
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold">Novo template</h1>

      {!canal ? (
        <div>
          <p className="text-sm text-gray-600 mb-3">Para qual canal é esta mensagem?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            <button
              type="button"
              onClick={() => setCanal('WHATSAPP')}
              className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
            >
              <div className="font-medium">WhatsApp</div>
              <div className="text-xs text-gray-500 mt-1">
                Aponta para um template aprovado na sua conta Meta.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCanal('EMAIL')}
              className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
            >
              <div className="font-medium">E-mail</div>
              <div className="text-xs text-gray-500 mt-1">
                Escreva o assunto e o conteúdo aqui mesmo.
              </div>
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-4">
            Canal: <strong>{canal === 'EMAIL' ? 'E-mail' : 'WhatsApp'}</strong>{' '}
            <button
              type="button"
              onClick={() => setCanal(null)}
              className="text-gray-500 hover:underline"
            >
              (trocar)
            </button>
          </p>
          <TemplateForm
            canal={canal}
            salvando={salvando}
            erroServidor={erro}
            textoBotao="Criar template"
            onSalvar={salvar}
          />
        </>
      )}
    </div>
  );
}
