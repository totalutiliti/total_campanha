'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '../../../../../lib/auth/context';

interface RegistroDns {
  tipo: 'CNAME' | 'TXT' | 'MX';
  nome: string;
  valor: string;
  descricao: string;
}

interface Resultado {
  id: string;
  dominio: string;
  remetente: string;
  status: string;
  registrosDns: RegistroDns[];
}

export default function NovaConexaoEmailPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [dominio, setDominio] = useState('');
  const [remetente, setRemetente] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiou, setCopiou] = useState<number | null>(null);

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await api<Resultado>({
        method: 'POST',
        path: '/conexoes/email',
        body: { dominio, remetente },
      });
      setResultado(r);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setEnviando(false);
    }
  }

  function copiar(texto: string, idx: number) {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiou(idx);
      setTimeout(() => setCopiou(null), 1500);
    });
  }

  if (resultado) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Identidade criada. Configure estes registros DNS no seu provedor (Registro.br, Cloudflare,
          etc). A verificação pode levar de minutos a algumas horas.
        </div>

        <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {resultado.registrosDns.map((r, i) => (
              <tr key={i} className="border-t border-gray-200 align-top">
                <td className="px-3 py-2">{r.tipo}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.nome}</td>
                <td className="px-3 py-2 font-mono text-xs break-all">{r.valor}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => copiar(r.valor, i)}
                    className="text-xs rounded border border-gray-300 px-2 py-1"
                  >
                    {copiou === i ? 'Copiado' : 'Copiar valor'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={() => router.push('/conexoes')}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={aoSubmeter} className="space-y-4 max-w-md">
      <h1 className="text-2xl font-semibold">Conectar domínio de email</h1>

      <label className="block">
        <span className="text-sm font-medium">Domínio de envio</span>
        <input
          value={dominio}
          onChange={(e) => setDominio(e.target.value)}
          required
          placeholder="campanhas.suaempresa.com.br"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Remetente (From)</span>
        <input
          type="email"
          value={remetente}
          onChange={(e) => setRemetente(e.target.value)}
          required
          placeholder="no-reply@campanhas.suaempresa.com.br"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>

      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {enviando ? 'Criando…' : 'Criar identidade no SES'}
      </button>
    </form>
  );
}
