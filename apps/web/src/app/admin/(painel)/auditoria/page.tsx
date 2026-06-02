'use client';

import { useEffect, useState } from 'react';

import { useAdminAuth } from '../../../../lib/admin/context';
import { dataHora } from '../../../../lib/admin/format';
import { MensagemErro, Vazio } from '../../../../lib/admin/ui';

interface Entrada {
  id: string;
  tenantId: string | null;
  userId: string | null;
  acao: string;
  recurso: string | null;
  dados: unknown;
  createdAt: string;
}

function curto(id: string | null): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function resumirDados(dados: unknown): string {
  if (dados === null || dados === undefined) return '';
  if (typeof dados === 'object' && Object.keys(dados as object).length === 0) return '';
  try {
    return JSON.stringify(dados);
  } catch {
    return '';
  }
}

export default function AuditoriaPage() {
  const { api } = useAdminAuth();
  const [itens, setItens] = useState<Entrada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await api<Entrada[]>({ path: '/admin/audit?limite=100' });
        if (ativo) setItens(r);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
      }
    })();
    return () => {
      ativo = false;
    };
  }, [api]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Auditoria</h1>
        {itens && <span className="text-xs text-gray-500">{itens.length} eventos recentes</span>}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Ações sensíveis registradas na plataforma (mais recentes primeiro).
      </p>

      {erro && <MensagemErro>{erro}</MensagemErro>}

      {itens === null ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : itens.length === 0 ? (
        <Vazio>Nenhum evento registrado ainda.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Quando</th>
                <th className="px-4 py-2 font-medium">Ação</th>
                <th className="px-4 py-2 font-medium">Recurso</th>
                <th className="px-4 py-2 font-medium">Tenant</th>
                <th className="px-4 py-2 font-medium">Usuário</th>
                <th className="px-4 py-2 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 align-top">
              {itens.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">
                    {dataHora(e.createdAt)}
                  </td>
                  <td className="px-4 py-2">
                    <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{e.acao}</code>
                  </td>
                  <td
                    className="px-4 py-2 font-mono text-xs text-gray-500"
                    title={e.recurso ?? ''}
                  >
                    {curto(e.recurso)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500" title={e.tenantId ?? 'plataforma'}>
                    {e.tenantId ? curto(e.tenantId) : <span className="text-gray-400">plataforma</span>}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500" title={e.userId ?? ''}>
                    {curto(e.userId)}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    <div className="max-w-xs truncate" title={resumirDados(e.dados)}>
                      {resumirDados(e.dados)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
