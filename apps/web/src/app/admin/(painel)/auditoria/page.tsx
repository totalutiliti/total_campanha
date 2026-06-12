'use client';

import { useEffect, useState } from 'react';

import { useAdminAuth } from '../../../../lib/admin/context';
import { dataHora } from '../../../../lib/admin/format';
import { MensagemErro, Vazio } from '../../../../lib/admin/ui';
import { mensagemErro } from '../../../../lib/erro';

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
        if (ativo) setErro(mensagemErro(e, 'Falha ao carregar.'));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [api]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
        {itens && (
          <span className="text-xs text-muted-foreground">{itens.length} eventos recentes</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Ações sensíveis registradas na plataforma (mais recentes primeiro).
      </p>

      {erro && <MensagemErro>{erro}</MensagemErro>}

      {itens === null ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : itens.length === 0 ? (
        <Vazio>Nenhum evento registrado ainda.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left text-xs font-medium whitespace-nowrap">Quando</th>
                <th className="p-2 text-left text-xs font-medium">Ação</th>
                <th className="p-2 text-left text-xs font-medium">Recurso</th>
                <th className="p-2 text-left text-xs font-medium">Tenant</th>
                <th className="p-2 text-left text-xs font-medium">Usuário</th>
                <th className="p-2 text-left text-xs font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {itens.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="p-2 text-sm whitespace-nowrap text-muted-foreground">
                    {dataHora(e.createdAt)}
                  </td>
                  <td className="p-2 text-sm">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{e.acao}</code>
                  </td>
                  <td
                    className="p-2 font-mono text-xs text-muted-foreground"
                    title={e.recurso ?? ''}
                  >
                    {curto(e.recurso)}
                  </td>
                  <td
                    className="p-2 font-mono text-xs text-muted-foreground"
                    title={e.tenantId ?? 'plataforma'}
                  >
                    {e.tenantId ? (
                      curto(e.tenantId)
                    ) : (
                      <span className="text-muted-foreground/60">plataforma</span>
                    )}
                  </td>
                  <td
                    className="p-2 font-mono text-xs text-muted-foreground"
                    title={e.userId ?? ''}
                  >
                    {curto(e.userId)}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
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
