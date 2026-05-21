'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FiltroBuilderComPreview } from '../../../../components/segmentos/filtro-builder';
import { grupoVazio, Grupo } from '../../../../components/segmentos/filtros-tipos';
import { useAuth } from '../../../../lib/auth/context';

export default function NovoSegmentoPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [nome, setNome] = useState('');
  const [filtros, setFiltros] = useState<Grupo>(grupoVazio);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api({
        method: 'POST',
        path: '/segmentos',
        body: { nome, filtros },
      });
      router.replace('/segmentos');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <h1 className="text-2xl font-semibold">Novo segmento</h1>

      <label className="block">
        <span className="text-sm font-medium">Nome do segmento</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          maxLength={120}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <FiltroBuilderComPreview
        valor={filtros}
        onChange={setFiltros}
        fetchPreview={(g) => api({ method: 'POST', path: '/segmentos/previa', body: { filtros: g } })}
      />

      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enviando || !nome.trim()}
          className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {enviando ? 'Salvando…' : 'Salvar segmento'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
