'use client';

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
      <h1 className="text-2xl font-semibold mb-4">Conectar WhatsApp</h1>
      <WhatsappWizard salvar={salvar} />
    </div>
  );
}
