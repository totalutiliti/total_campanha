'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { buttonVariants } from '../../../../components/ui/button';
import { useAdminAuth } from '../../../../lib/admin/context';
import { brl, data, PLANO_LABEL } from '../../../../lib/admin/format';
import { BadgeStatusTenant, MensagemErro, Vazio } from '../../../../lib/admin/ui';
import { cn } from '../../../../lib/cn';
import { mensagemErro } from '../../../../lib/erro';

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
        if (ativo) setErro(mensagemErro(e, 'Falha ao carregar.'));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [api]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
        <div className="flex items-center gap-3">
          {itens && (
            <span className="text-xs text-muted-foreground">
              {itens.length} {itens.length === 1 ? 'tenant' : 'tenants'}
            </span>
          )}
          <Link
            href="/admin/tenants/novo"
            className={cn(buttonVariants({ size: 'sm' }), 'gap-2')}
          >
            <Plus className="h-4 w-4" />
            Novo tenant
          </Link>
        </div>
      </div>

      {erro && <MensagemErro>{erro}</MensagemErro>}

      {itens === null ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : itens.length === 0 ? (
        <Vazio>Nenhum tenant cadastrado ainda.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left text-xs font-medium">Empresa</th>
                <th className="p-2 text-left text-xs font-medium">Plano</th>
                <th className="p-2 text-left text-xs font-medium">Status</th>
                <th className="p-2 text-right text-xs font-medium">Usuários</th>
                <th className="p-2 text-right text-xs font-medium">MRR</th>
                <th className="p-2 text-left text-xs font-medium">Último disparo</th>
                <th className="p-2 text-left text-xs font-medium">Criado</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="p-2 text-sm">
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {t.razaoSocial}
                    </Link>
                    <div className="text-xs text-muted-foreground">{t.slug}</div>
                  </td>
                  <td className="p-2 text-sm">{PLANO_LABEL[t.plano] ?? t.plano}</td>
                  <td className="p-2 text-sm">
                    <BadgeStatusTenant status={t.status} />
                  </td>
                  <td className="p-2 text-sm text-right tabular-nums">{t.usuarios}</td>
                  <td className="p-2 text-sm text-right tabular-nums">{brl(t.mrrBrl)}</td>
                  <td className="p-2 text-sm whitespace-nowrap">{data(t.ultimoDisparo)}</td>
                  <td className="p-2 text-sm whitespace-nowrap">{data(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
