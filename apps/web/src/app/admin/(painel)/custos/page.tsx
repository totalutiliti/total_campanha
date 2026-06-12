'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { useAdminAuth } from '../../../../lib/admin/context';
import { brl } from '../../../../lib/admin/format';
import { EstatCartao, MensagemErro, Vazio } from '../../../../lib/admin/ui';
import { mensagemErro } from '../../../../lib/erro';

interface Resumo {
  hojeBrl: number;
  semanaBrl: number;
  mesBrl: number;
}

interface PorTenant {
  tenantId: string;
  slug: string;
  razaoSocial: string;
  chamadas: number;
  custoBrl: number;
}

interface PorServico {
  servico: string;
  chamadas: number;
  custoBrl: number;
}

export default function CustosPage() {
  const { api } = useAdminAuth();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [porTenant, setPorTenant] = useState<PorTenant[] | null>(null);
  const [porServico, setPorServico] = useState<PorServico[] | null>(null);
  const [desde, setDesde] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  // Resumo (hoje/semana/mês) — carrega uma vez.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await api<Resumo>({ path: '/admin/usage' });
        if (ativo) setResumo(r);
      } catch (e) {
        if (ativo) setErro(mensagemErro(e, 'Falha ao carregar.'));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [api]);

  const carregarDetalhe = useCallback(async () => {
    setErro(null);
    const q = desde ? `?desde=${encodeURIComponent(desde)}` : '';
    try {
      const [pt, ps] = await Promise.all([
        api<PorTenant[]>({ path: `/admin/usage/por-tenant${q}` }),
        api<PorServico[]>({ path: `/admin/usage/por-servico${q}` }),
      ]);
      setPorTenant(pt);
      setPorServico(ps);
    } catch (e) {
      setErro(mensagemErro(e, 'Falha ao carregar.'));
    }
  }, [api, desde]);

  useEffect(() => {
    carregarDetalhe();
  }, [carregarDetalhe]);

  const totalDetalhe = (porTenant ?? []).reduce((s, x) => s + x.custoBrl, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Custos</h1>

      {erro && <MensagemErro>{erro}</MensagemErro>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <EstatCartao titulo="Hoje" valor={resumo ? brl(resumo.hojeBrl) : '…'} />
        <EstatCartao titulo="Últimos 7 dias" valor={resumo ? brl(resumo.semanaBrl) : '…'} />
        <EstatCartao titulo="Mês atual" valor={resumo ? brl(resumo.mesBrl) : '…'} />
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-2">
          <Label htmlFor="desde">A partir de</Label>
          <Input
            id="desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="h-9 w-auto"
          />
        </div>
        {desde && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDesde('')}>
            Limpar
          </Button>
        )}
        <span className="text-xs text-muted-foreground pb-2">
          Filtra as tabelas abaixo. Em branco, mostra desde o início.
        </span>
      </div>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          Por tenant{' '}
          {porTenant && porTenant.length > 0 && (
            <span className="text-muted-foreground/70">· total {brl(totalDetalhe)}</span>
          )}
        </h2>
        {porTenant === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : porTenant.length === 0 ? (
          <Vazio>
            Nenhum custo registrado no período. Os valores aparecem aqui quando houver disparos reais
            (WhatsApp / e-mail).
          </Vazio>
        ) : (
          <Tabela
            colunas={[
              { label: 'Empresa' },
              { label: 'Chamadas', num: true },
              { label: 'Custo', num: true },
            ]}
            linhas={porTenant.map((x) => [x.razaoSocial || x.slug, x.chamadas, brl(x.custoBrl)])}
          />
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Por serviço</h2>
        {porServico === null ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : porServico.length === 0 ? (
          <Vazio>Nenhum custo registrado no período.</Vazio>
        ) : (
          <Tabela
            colunas={[
              { label: 'Serviço' },
              { label: 'Chamadas', num: true },
              { label: 'Custo', num: true },
            ]}
            linhas={porServico.map((x) => [x.servico, x.chamadas, brl(x.custoBrl)])}
          />
        )}
      </section>
    </div>
  );
}

function Tabela({
  colunas,
  linhas,
}: {
  colunas: { label: string; num?: boolean }[];
  linhas: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            {colunas.map((c) => (
              <th
                key={c.label}
                className={`p-2 text-xs font-medium ${c.num ? 'text-right' : 'text-left'}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
              {linha.map((cel, j) => (
                <td
                  key={j}
                  className={`p-2 text-sm ${colunas[j]?.num ? 'text-right tabular-nums' : ''}`}
                >
                  {cel}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
