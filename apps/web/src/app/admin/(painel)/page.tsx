'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAdminAuth } from '../../../lib/admin/context';
import { brl } from '../../../lib/admin/format';
import { EstatCartao, MensagemErro } from '../../../lib/admin/ui';

interface Usage {
  hojeBrl: number;
  semanaBrl: number;
  mesBrl: number;
}

interface TenantLinha {
  id: string;
  status: string;
}

export default function AdminHome() {
  const { api } = useAdminAuth();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [tenants, setTenants] = useState<TenantLinha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [u, t] = await Promise.all([
          api<Usage>({ path: '/admin/usage' }),
          api<TenantLinha[]>({ path: '/admin/tenants' }),
        ]);
        if (!ativo) return;
        setUsage(u);
        setTenants(t);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
      }
    })();
    return () => {
      ativo = false;
    };
  }, [api]);

  const total = tenants?.length ?? 0;
  const ativos = tenants?.filter((t) => t.status === 'ATIVO').length ?? 0;
  const trial = tenants?.filter((t) => t.status === 'TRIAL').length ?? 0;
  const suspensos = tenants?.filter((t) => t.status === 'SUSPENSO').length ?? 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Visão geral</h1>

      {erro && <MensagemErro>{erro}</MensagemErro>}

      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Custos da plataforma</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <EstatCartao titulo="Hoje" valor={usage ? brl(usage.hojeBrl) : '…'} />
          <EstatCartao titulo="Últimos 7 dias" valor={usage ? brl(usage.semanaBrl) : '…'} />
          <EstatCartao titulo="Mês atual" valor={usage ? brl(usage.mesBrl) : '…'} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Custo estimado das chamadas a serviços externos (WhatsApp, e-mail).{' '}
          <Link href="/admin/custos" className="underline hover:text-gray-700">
            Ver detalhe por tenant →
          </Link>
        </p>
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Tenants</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <EstatCartao titulo="Total" valor={tenants ? total : '…'} />
          <EstatCartao titulo="Ativos" valor={tenants ? ativos : '…'} />
          <EstatCartao titulo="Em teste" valor={tenants ? trial : '…'} />
          <EstatCartao titulo="Suspensos" valor={tenants ? suspensos : '…'} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          <Link href="/admin/tenants" className="underline hover:text-gray-700">
            Gerenciar tenants →
          </Link>
        </p>
      </section>
    </div>
  );
}
