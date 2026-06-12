'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import {
  DadosForm,
  ResultadoConexao,
  WhatsappWizard,
} from '../../../../../components/conexoes/whatsapp-wizard';
import { useAuth } from '../../../../../lib/auth/context';

export default function NovaConexaoWhatsappPage() {
  const { api } = useAuth();

  async function salvar(dados: DadosForm): Promise<ResultadoConexao> {
    return api<ResultadoConexao>({
      method: 'POST',
      path: '/conexoes/whatsapp',
      body: dados,
    });
  }

  return (
    <div>
      <Link
        href="/conexoes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para conexões
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Conectar WhatsApp</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Ligue a conta WhatsApp Business (Meta) da sua empresa à plataforma, em 4 passos.
      </p>
      <WhatsappWizard salvar={salvar} />
    </div>
  );
}
