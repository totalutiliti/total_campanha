'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../../../lib/auth/context';
import { canalLabel, statusCampanha } from '../../../../lib/campanha-status';
import { mensagemErro } from '../../../../lib/erro';

interface Campanha {
  id: string;
  nome: string;
  canal: 'EMAIL' | 'WHATSAPP';
  status: string;
  templateId: string;
  segmentoId: string;
  agendadoPara: string | null;
  totalDestinatarios: number;
  totalEnviados: number;
  custoEstimadoBrl: string | null;
}

interface Estimativa {
  destinatarios: number;
  canal: string;
  custoUnitarioBrl: number;
  custoEstimadoBrl: number;
}

interface Analytics {
  status: string;
  totais: {
    destinatarios: number;
    enviadas: number;
    entregues: number;
    lidas: number;
    respondidas: number;
    falhas: number;
  };
  taxas: { entrega: number; leitura: number; resposta: number; falha: number };
  custo: { estimadoBrl: string | null; realBrl: string | null };
  porMotivoFalha: { motivo: string; total: number }[];
}

const brl = (n: number | null | undefined) =>
  n == null || !isFinite(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function CampanhaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuth();

  const [campanha, setCampanha] = useState<Campanha | null>(null);
  const [templateNome, setTemplateNome] = useState<string | null>(null);
  const [segmentoNome, setSegmentoNome] = useState<string | null>(null);
  const [conexaoAtiva, setConexaoAtiva] = useState<boolean | null>(null);
  const [estimativa, setEstimativa] = useState<Estimativa | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [acaoMsg, setAcaoMsg] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  async function buscarCampanhaEStatus(): Promise<Campanha> {
    const c = await api<Campanha>({ path: `/campanhas/${id}` });
    setCampanha(c);
    if (c.status === 'RASCUNHO') {
      setAnalytics(null);
      try {
        setEstimativa(
          await api<Estimativa>({ method: 'POST', path: `/campanhas/${id}/calcular-estimativa` }),
        );
      } catch {
        /* estimativa é best-effort */
      }
    } else {
      setEstimativa(null);
      try {
        setAnalytics(await api<Analytics>({ path: `/campanhas/${id}/analytics` }));
      } catch {
        /* analytics best-effort */
      }
    }
    return c;
  }

  // Carga inicial: campanha + nomes + conexão.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const c = await buscarCampanhaEStatus();
        if (!ativo) return;
        api<{ nome: string }>({ path: `/templates/${c.templateId}` })
          .then((t) => ativo && setTemplateNome(t.nome))
          .catch(() => {});
        api<{ nome: string }>({ path: `/segmentos/${c.segmentoId}` })
          .then((s) => ativo && setSegmentoNome(s.nome))
          .catch(() => {});
        verificarConexao(c.canal).then((v) => ativo && setConexaoAtiva(v));
      } catch (e) {
        if (ativo) setErroCarga(mensagemErro(e));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [id]);

  // Auto-atualiza enquanto está enviando/agendada.
  useEffect(() => {
    if (campanha?.status !== 'DISPARANDO' && campanha?.status !== 'AGENDADA') return;
    const t = setInterval(() => {
      buscarCampanhaEStatus().catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [campanha?.status]);

  async function verificarConexao(canal: 'EMAIL' | 'WHATSAPP'): Promise<boolean> {
    try {
      if (canal === 'WHATSAPP') {
        const w = await api<{ status: string }>({ path: '/conexoes/whatsapp' });
        return w?.status === 'ATIVA';
      }
      const es = await api<{ status: string }[]>({ path: '/conexoes/email' });
      return Array.isArray(es) && es.some((e) => e.status === 'ATIVA');
    } catch {
      return false;
    }
  }

  async function acao(caminho: 'disparar' | 'pausar' | 'cancelar') {
    if (caminho === 'cancelar' && !window.confirm('Cancelar esta campanha? Mensagens ainda não enviadas não serão enviadas.')) {
      return;
    }
    setProcessando(true);
    setAcaoErro(null);
    setAcaoMsg(null);
    try {
      const r = await api<{ status?: string; mensagensCriadas?: number }>({
        method: 'POST',
        path: `/campanhas/${id}/${caminho}`,
      });
      if (caminho === 'disparar' && r?.mensagensCriadas != null) {
        setAcaoMsg(`Disparo iniciado — ${r.mensagensCriadas} mensagem(ns) na fila.`);
      }
      await buscarCampanhaEStatus();
    } catch (e) {
      setAcaoErro(mensagemErro(e));
    } finally {
      setProcessando(false);
    }
  }

  async function excluir() {
    if (!window.confirm('Excluir esta campanha? Esta ação não pode ser desfeita.')) return;
    setProcessando(true);
    setAcaoErro(null);
    try {
      await api({ method: 'DELETE', path: `/campanhas/${id}` });
      router.push('/campanhas');
    } catch (e) {
      setAcaoErro(mensagemErro(e));
      setProcessando(false);
    }
  }

  if (carregando) {
    return <p className="text-sm text-gray-500">carregando…</p>;
  }
  if (erroCarga || !campanha) {
    return (
      <div>
        <Link href="/campanhas" className="text-xs text-gray-600 hover:text-gray-900">
          ← Voltar para campanhas
        </Link>
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {erroCarga ?? 'Campanha não encontrada.'}
        </p>
      </div>
    );
  }

  const st = statusCampanha(campanha.status);
  const isRascunho = campanha.status === 'RASCUNHO';
  const isPausada = campanha.status === 'PAUSADA';
  const podeDisparar = isRascunho || isPausada;
  const podePausar = campanha.status === 'DISPARANDO' || campanha.status === 'AGENDADA';
  const podeCancelar = ['AGENDADA', 'DISPARANDO', 'PAUSADA'].includes(campanha.status);
  const podeExcluir = isRascunho || campanha.status === 'CANCELADA';

  return (
    <div className="max-w-3xl">
      <Link href="/campanhas" className="text-xs text-gray-600 hover:text-gray-900">
        ← Voltar para campanhas
      </Link>
      <div className="mt-2 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">{campanha.nome}</h1>
        <span className={`text-xs rounded px-2 py-0.5 ${st.classe}`}>{st.label}</span>
      </div>

      {/* Resumo */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm grid grid-cols-2 gap-3">
        <Item label="Canal">{canalLabel(campanha.canal)}</Item>
        <Item label="Mensagem">
          <Link href={`/templates/${campanha.templateId}`} className="text-gray-900 underline">
            {templateNome ?? 'ver template'}
          </Link>
        </Item>
        <Item label="Segmento">{segmentoNome ?? '—'}</Item>
        {campanha.agendadoPara && (
          <Item label="Agendada para">
            {new Date(campanha.agendadoPara).toLocaleString('pt-BR')}
          </Item>
        )}
      </div>

      {acaoMsg && (
        <p role="status" className="mt-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-md p-3">
          {acaoMsg}
        </p>
      )}
      {acaoErro && (
        <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {acaoErro}
        </p>
      )}

      {/* RASCUNHO: estimativa + gate + disparar */}
      {isRascunho && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-medium text-gray-900 mb-3">Antes de disparar</h2>
            <div className="grid grid-cols-2 gap-3">
              <Kpi
                label="Vão receber"
                valor={estimativa ? String(estimativa.destinatarios) : '…'}
                sub="contatos com opt-in no segmento"
              />
              <Kpi
                label="Custo estimado"
                valor={estimativa ? brl(estimativa.custoEstimadoBrl) : '…'}
                sub={estimativa ? `${brl(estimativa.custoUnitarioBrl)} por envio` : ''}
              />
            </div>
            {estimativa?.destinatarios === 0 && (
              <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Nenhum contato com opt-in de {canalLabel(campanha.canal)} neste segmento. Ajuste o
                segmento ou marque o opt-in dos contatos antes de disparar.
              </p>
            )}
          </div>

          {conexaoAtiva === false && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Você ainda não tem {canalLabel(campanha.canal)} conectado.{' '}
              <Link href="/conexoes" className="underline font-medium">
                Conectar agora
              </Link>{' '}
              para poder disparar.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => acao('disparar')}
              disabled={processando || conexaoAtiva !== true || estimativa?.destinatarios === 0}
              className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {processando
                ? 'Processando…'
                : campanha.agendadoPara
                  ? 'Agendar disparo'
                  : 'Disparar agora'}
            </button>
            {conexaoAtiva === null && (
              <span className="text-xs text-gray-500 self-center">verificando conexão…</span>
            )}
          </div>
        </div>
      )}

      {/* Acompanhamento (enviando / pausada / concluída / cancelada) */}
      {!isRascunho && analytics && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Kpi label="Destinatários" valor={String(analytics.totais.destinatarios)} />
            <Kpi label="Enviadas" valor={String(analytics.totais.enviadas)} />
            <Kpi
              label="Entregues"
              valor={String(analytics.totais.entregues)}
              sub={pct(analytics.taxas.entrega)}
            />
            <Kpi label="Lidas" valor={String(analytics.totais.lidas)} sub={pct(analytics.taxas.leitura)} />
            <Kpi
              label="Respondidas"
              valor={String(analytics.totais.respondidas)}
              sub={pct(analytics.taxas.resposta)}
            />
            <Kpi label="Falhas" valor={String(analytics.totais.falhas)} sub={pct(analytics.taxas.falha)} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
            <Item label="Custo real">{brl(Number(analytics.custo.realBrl ?? analytics.custo.estimadoBrl))}</Item>
          </div>

          {analytics.porMotivoFalha.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
              <h3 className="font-medium text-gray-900 mb-2">Falhas por motivo</h3>
              <ul className="space-y-1 text-gray-700">
                {analytics.porMotivoFalha.map((m, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{m.motivo}</span>
                    <span className="tabular-nums">{m.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {campanha.status === 'DISPARANDO' && (
            <p className="text-xs text-gray-500">Atualizando automaticamente a cada 5 segundos…</p>
          )}
        </div>
      )}

      {/* Ações de ciclo de vida */}
      <div className="mt-8 flex flex-wrap gap-2">
        {isPausada && (
          <button
            type="button"
            onClick={() => acao('disparar')}
            disabled={processando || conexaoAtiva !== true}
            className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Retomar envio
          </button>
        )}
        {podePausar && (
          <button
            type="button"
            onClick={() => acao('pausar')}
            disabled={processando}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Pausar
          </button>
        )}
        {podeCancelar && (
          <button
            type="button"
            onClick={() => acao('cancelar')}
            disabled={processando}
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Cancelar campanha
          </button>
        )}
        {podeExcluir && (
          <button
            type="button"
            onClick={excluir}
            disabled={processando}
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Excluir
          </button>
        )}
      </div>

      {podeDisparar && conexaoAtiva === true && (
        <p className="mt-3 text-xs text-gray-500">
          Ao disparar, criamos uma mensagem por contato e enviamos com intervalo de segurança
          (respeitando os limites do seu {canalLabel(campanha.canal)}).
        </p>
      )}
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900">{children}</div>
    </div>
  );
}

function Kpi({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{valor}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
