'use client';

import { useState } from 'react';

import { FiltroBuilderComPreview } from '../../../components/segmentos/filtro-builder';
import { grupoVazio, Grupo } from '../../../components/segmentos/filtros-tipos';

/**
 * Página de demonstração em /dev/segmentos.
 *
 * Renderiza o FiltroBuilder com preview que aponta para a API. Como a
 * autenticação ainda não está plugada no Next.js, a chamada de preview
 * vai falhar com 401 — mas a interação visual com a árvore de filtros
 * já funciona aqui.
 *
 * Quando o painel autenticado entrar (próxima iteração frontend),
 * esta página vira `/segmentos/novo` e usa o auth context.
 */
export default function DevSegmentosPage() {
  const [filtros, setFiltros] = useState<Grupo>(grupoVazio);

  async function fetchPreview(g: Grupo): Promise<{ total: number }> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    const r = await fetch(`${baseUrl}/segmentos/previa`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filtros: g }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Segmentos — Construtor de filtros</h1>
        <p className="text-sm text-gray-600 mt-1">
          Página de demonstração. A integração com auth do painel chega quando
          o frontend autenticado for criado.
        </p>
      </header>

      <FiltroBuilderComPreview
        valor={filtros}
        onChange={setFiltros}
        fetchPreview={fetchPreview}
      />

      <section className="mt-8">
        <h2 className="text-sm font-semibold mb-2">JSON do filtro:</h2>
        <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-md overflow-auto">
          {JSON.stringify(filtros, null, 2)}
        </pre>
      </section>
    </main>
  );
}
