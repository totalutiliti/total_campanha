'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ContatoForm, ContatoPayload } from '../../../../components/contatos/contato-form';
import { useAuth } from '../../../../lib/auth/context';
import { mensagemErro } from '../../../../lib/erro';

export default function NovoContatoPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(p: ContatoPayload) {
    setSalvando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = { tags: p.tags };
      if (p.nome) body.nome = p.nome;
      if (p.email) body.email = p.email;
      if (p.telefoneE164) body.telefoneE164 = p.telefoneE164;

      const criado = await api<{ id: string }>({ method: 'POST', path: '/contatos', body });

      // opt-ins não fazem parte do cadastro inicial — aplica via PATCH se marcados.
      if (p.optInEmail || p.optInWhatsapp) {
        await api({
          method: 'PATCH',
          path: `/contatos/${criado.id}`,
          body: { optInEmail: p.optInEmail, optInWhatsapp: p.optInWhatsapp },
        });
      }
      router.push('/contatos');
    } catch (e) {
      setErro(mensagemErro(e));
      setSalvando(false);
    }
  }

  return (
    <div>
      <Link href="/contatos" className="text-xs text-gray-600 hover:text-gray-900">
        ← Voltar para contatos
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold">Adicionar contato</h1>
      <ContatoForm
        salvando={salvando}
        erroServidor={erro}
        textoBotao="Adicionar contato"
        onSalvar={salvar}
      />
    </div>
  );
}
