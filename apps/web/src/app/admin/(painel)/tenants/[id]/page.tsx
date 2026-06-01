'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAdminAuth } from '../../../../../lib/admin/context';
import { brl, data, PLANO_LABEL, ROLE_LABEL } from '../../../../../lib/admin/format';
import { BadgeStatusTenant, EstatCartao, MensagemErro } from '../../../../../lib/admin/ui';

interface Usuario {
  id: string;
  email: string;
  role: string;
}

interface TenantDetalhe {
  id: string;
  slug: string;
  razaoSocial: string;
  cnpj: string;
  plano: string;
  status: string;
  trialAteEm: string | null;
  createdAt: string;
  usuarios: Usuario[];
  metricas: { contatos: number; campanhas: number; custoTotalBrl: string };
}

/** Chave compartilhada com o AuthProvider do tenant para entrar em modo impersonação. */
const IMPERSONATE_KEY = 'tc:impersonate';

export default function TenantDetalhePage() {
  const { api } = useAdminAuth();
  const params = useParams<{ id: string }>();
  const id = (params?.id as string) ?? '';

  const [t, setT] = useState<TenantDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [acao, setAcao] = useState<'suspender' | 'impersonar' | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await api<TenantDetalhe>({ path: `/admin/tenants/${id}` });
      setT(r);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar.');
    }
  }, [api, id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function suspender() {
    if (!t) return;
    if (
      !window.confirm(
        `Suspender o tenant "${t.razaoSocial}"? Os usuários dele perdem o acesso até a reativação.`,
      )
    ) {
      return;
    }
    setAcao('suspender');
    setErro(null);
    setAviso(null);
    try {
      await api({ method: 'POST', path: `/admin/tenants/${id}/suspender` });
      setAviso('Tenant suspenso.');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao suspender.');
    } finally {
      setAcao(null);
    }
  }

  async function impersonar() {
    if (!t) return;
    if (
      !window.confirm(
        `Entrar como "${t.razaoSocial}"? Você verá a plataforma como este cliente (sessão de 15 min, ação auditada).`,
      )
    ) {
      return;
    }
    setAcao('impersonar');
    setErro(null);
    try {
      const r = await api<{ accessToken: string; expiraEm: string }>({
        method: 'POST',
        path: `/admin/tenants/${id}/impersonate`,
      });
      try {
        sessionStorage.setItem(
          IMPERSONATE_KEY,
          JSON.stringify({
            token: r.accessToken,
            expiraEm: r.expiraEm,
            tenantId: id,
            tenantNome: t.razaoSocial,
          }),
        );
      } catch {
        // sessionStorage indisponível — aborta a impersonação.
        throw new Error('Não foi possível iniciar a sessão de impersonação neste navegador.');
      }
      // Navega para o app do tenant com reload — o AuthProvider do tenant pega o token.
      window.location.assign('/');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao entrar como cliente.');
      setAcao(null);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/tenants" className="text-sm text-gray-500 hover:text-gray-700">
        ← Tenants
      </Link>

      {erro && <MensagemErro>{erro}</MensagemErro>}
      {aviso && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-md p-3">
          {aviso}
        </p>
      )}

      {t === null && !erro ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : t ? (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold">{t.razaoSocial}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                <span>{t.slug}</span>
                <span aria-hidden>·</span>
                <BadgeStatusTenant status={t.status} />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={impersonar}
                disabled={acao !== null}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
                title="Abre a plataforma vendo como este cliente (sessão de 15 min, auditada)"
              >
                {acao === 'impersonar' ? 'Entrando…' : 'Entrar como cliente'}
              </button>
              {t.status !== 'SUSPENSO' && (
                <button
                  type="button"
                  onClick={suspender}
                  disabled={acao !== null}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:outline-none"
                >
                  {acao === 'suspender' ? 'Suspendendo…' : 'Suspender'}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <EstatCartao titulo="Contatos" valor={t.metricas.contatos} />
            <EstatCartao titulo="Campanhas" valor={t.metricas.campanhas} />
            <EstatCartao titulo="Custo total" valor={brl(t.metricas.custoTotalBrl)} />
          </div>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3">Dados</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <Linha rotulo="CNPJ" valor={t.cnpj} />
              <Linha rotulo="Plano" valor={PLANO_LABEL[t.plano] ?? t.plano} />
              <Linha rotulo="Identificador" valor={t.slug} />
              <Linha rotulo="Em teste até" valor={data(t.trialAteEm)} />
              <Linha rotulo="Criado em" valor={data(t.createdAt)} />
            </dl>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3">
              Usuários ({t.usuarios.length})
            </h2>
            {t.usuarios.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum usuário.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {t.usuarios.map((u) => (
                  <li key={u.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{u.email}</span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 sm:block">
      <dt className="text-gray-500">{rotulo}</dt>
      <dd className="font-medium text-gray-900">{valor}</dd>
    </div>
  );
}
