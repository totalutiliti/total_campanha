'use client';

import { WhatsappWizard } from '../../../../components/conexoes/whatsapp-wizard';

/**
 * Página de demonstração do wizard WhatsApp.
 *
 * Quando o painel autenticado existir, mover para `/conexoes/whatsapp/novo`
 * e injetar `salvar` que chama POST /conexoes/whatsapp com Bearer token.
 */
export default function DevConexoesWhatsappPage() {
  return (
    <main className="min-h-screen p-8">
      <header className="mb-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold">Conectar WhatsApp (BYOA)</h1>
        <p className="text-sm text-gray-600 mt-1">
          Página de demonstração — sem auth context, a função <code>salvar</code> não está
          ligada ao backend. O wizard visual está completo.
        </p>
      </header>
      <WhatsappWizard />
    </main>
  );
}
