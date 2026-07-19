'use client';

import { ArrowLeft } from 'lucide-react';
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

      await api<{ id: string }>({ method: 'POST', path: '/contatos', body });
      router.push('/contatos');
    } catch (e) {
      setErro(mensagemErro(e));
      setSalvando(false);
    }
  }

  return (
    <div>
      <Link
        href="/contatos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para contatos
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Adicionar contato</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Cadastre os dados do cliente. O envio de campanhas só é liberado após consentimento
        comprovado na página pública de opt-in.
      </p>
      <ContatoForm
        salvando={salvando}
        erroServidor={erro}
        textoBotao="Adicionar contato"
        onSalvar={salvar}
      />
    </div>
  );
}
