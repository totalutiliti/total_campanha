'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAdminAuth } from '../../../../lib/admin/context';
import { brl, data, PLANO_LABEL } from '../../../../lib/admin/format';
import { BadgeStatusTenant, MensagemErro, Vazio } from '../../../../lib/admin/ui';

interface Tenant {
  id: string;
  slug: string;
  razaoSocial: string;
  cnpj: string;
  plano: string;
  status: string;
  trialAteEm: string | null;
  usuarios: number;
  mrrBrl: number;
  ultimoDisparo: string | null;
  createdAt: string;
}

export default function TenantsPage() {
  const { api } = useAdminAuth();
  const [itens, setItens] = useState<Tenant[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await api<Tenant[]>({ path: '/admin/tenants' });
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
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <div className="flex items-center gap-3">
          {itens && (
            <span className="text-xs text-gray-500">
              {itens.length} {itens.length === 1 ? 'tenant' : 'tenants'}
            </span>
          )}
          <Link
            href="/admin/tenants/novo"
            className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
          >
            Novo tenant
          </Link>
        </div>
      </div>

      {erro && <MensagemErro>{erro}</MensagemErro>}

      {itens === null ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : itens.length === 0 ? (
        <Vazio>Nenhum tenant cadastrado ainda.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Empresa</th>
                <th className="px-4 py-2 font-medium">Plano</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Usuários</th>
                <th className="px-4 py-2 font-medium text-right">MRR</th>
                <th className="px-4 py-2 font-medium">Último disparo</th>
                <th className="px-4 py-2 font-medium">Criado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itens.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="font-medium text-gray-900 hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {t.razaoSocial}
                    </Link>
                    <div className="text-xs text-gray-500">{t.slug}</div>
                  </td>
                  <td className="px-4 py-2">{PLANO_LABEL[t.plano] ?? t.plano}</td>
                  <td className="px-4 py-2">
                    <BadgeStatusTenant status={t.status} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.usuarios}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{brl(t.mrrBrl)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{data(t.ultimoDisparo)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{data(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
