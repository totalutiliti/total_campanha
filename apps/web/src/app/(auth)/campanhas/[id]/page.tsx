'use client';

import { ArrowLeft, Loader2, Pause, Play, Send, Trash2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AlertAviso, AlertErro, AlertSucesso } from '../../../../components/ui/alerts';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Dialog, DialogFooter, DialogHeader } from '../../../../components/ui/dialog';
import { useAuth } from '../../../../lib/auth/context';
import { canalLabel, statusCampanha } from '../../../../lib/campanha-status';
import { cn } from '../../../../lib/cn';
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

type PreviewMsg =
  | { canal: 'EMAIL'; assunto: string; html: string }
  | {
      canal: 'WHATSAPP';
      metaTemplateName: string | null;
      metaLanguage: string | null;
      variaveisAplicadas: Record<string, string>;
    };

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
  const [mensagemPreview, setMensagemPreview] = useState<PreviewMsg | null>(null);
  const [conexaoAtiva, setConexaoAtiva] = useState<boolean | null>(null);
  const [estimativa, setEstimativa] = useState<Estimativa | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [acaoMsg, setAcaoMsg] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  // Dialog de confirmação (substitui window.confirm — mesmo efeito, só apresentação).
  const [confirmando, setConfirmando] = useState<'cancelar' | 'excluir' | null>(null);

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
        api<PreviewMsg>({
          method: 'POST',
          path: `/templates/${c.templateId}/preview`,
          body: { variaveis: {} },
        })
          .then((p) => ativo && setMensagemPreview(p))
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
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando campanha…
      </p>
    );
  }
  if (erroCarga || !campanha) {
    return (
      <div>
        <Link
          href="/campanhas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para campanhas
        </Link>
        <AlertErro className="mt-3">{erroCarga ?? 'Campanha não encontrada.'}</AlertErro>
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
      <Link
        href="/campanhas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para campanhas
      </Link>
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{campanha.nome}</h1>
        <Badge
          variant="outline"
          className={cn('shrink-0 border-transparent', st.classe)}
        >
          {st.label}
        </Badge>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
        <Item label="Canal">{canalLabel(campanha.canal)}</Item>
        <Item label="Mensagem">
          <Link
            href={`/templates/${campanha.templateId}`}
            className="font-medium text-primary hover:underline"
          >
            {templateNome ?? 'ver mensagem'}
          </Link>
        </Item>
        <Item label="Grupo">{segmentoNome ?? '—'}</Item>
        {campanha.agendadoPara && (
          <Item label="Agendada para">
            {new Date(campanha.agendadoPara).toLocaleString('pt-BR')}
          </Item>
        )}
      </div>

      {mensagemPreview && (
        <div className="mt-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
          <h2 className="mb-2 text-sm font-medium">Prévia da mensagem</h2>
          {mensagemPreview.canal === 'EMAIL' ? (
            <div>
              <div className="mb-1 text-xs text-muted-foreground">
                Assunto: <strong className="text-foreground">{mensagemPreview.assunto}</strong>
              </div>
              <iframe
                title="Prévia do e-mail"
                srcDoc={mensagemPreview.html}
                sandbox=""
                className="h-64 w-full rounded-md border bg-white"
              />
            </div>
          ) : (
            <div className="text-sm">
              <div>
                Template Meta: <strong>{mensagemPreview.metaTemplateName ?? '—'}</strong>
                {mensagemPreview.metaLanguage ? ` (${mensagemPreview.metaLanguage})` : ''}
              </div>
              {Object.keys(mensagemPreview.variaveisAplicadas ?? {}).length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Variáveis:{' '}
                  {Object.entries(mensagemPreview.variaveisAplicadas)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ')}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                O texto do WhatsApp é o aprovado na Meta; aqui mostramos a referência e os exemplos
                das variáveis.
              </p>
            </div>
          )}
        </div>
      )}

      {acaoMsg && <AlertSucesso className="mt-4">{acaoMsg}</AlertSucesso>}
      {acaoErro && <AlertErro className="mt-4">{acaoErro}</AlertErro>}

      {/* RASCUNHO: estimativa + gate + disparar */}
      {isRascunho && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            <h2 className="mb-3 text-sm font-medium">Antes de disparar</h2>
            <div className="grid grid-cols-2 gap-3">
              <Kpi
                label="Vão receber"
                valor={estimativa ? String(estimativa.destinatarios) : '…'}
                sub="contatos com opt-in no grupo"
              />
              <Kpi
                label="Custo estimado"
                valor={estimativa ? brl(estimativa.custoEstimadoBrl) : '…'}
                sub={estimativa ? `${brl(estimativa.custoUnitarioBrl)} por envio` : ''}
              />
            </div>
            {estimativa?.destinatarios === 0 && (
              <AlertAviso className="mt-3">
                Nenhum contato com opt-in de {canalLabel(campanha.canal)} neste grupo. Ajuste o
                grupo ou marque o opt-in dos contatos antes de disparar.
              </AlertAviso>
            )}
          </div>

          {conexaoAtiva === false && (
            <AlertAviso>
              Você ainda não tem {canalLabel(campanha.canal)} conectado.{' '}
              <Link href="/conexoes" className="font-medium underline">
                Conectar agora
              </Link>{' '}
              para poder disparar.
            </AlertAviso>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => acao('disparar')}
              disabled={processando || conexaoAtiva !== true || estimativa?.destinatarios === 0}
            >
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando…
                </>
              ) : campanha.agendadoPara ? (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Agendar disparo
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Disparar agora
                </>
              )}
            </Button>
            {conexaoAtiva === null && (
              <span className="text-xs text-muted-foreground">verificando conexão…</span>
            )}
          </div>
        </div>
      )}

      {/* Acompanhamento (enviando / pausada / concluída / cancelada) */}
      {!isRascunho && analytics && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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

          <div className="rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
            <Item label="Custo real">{brl(Number(analytics.custo.realBrl ?? analytics.custo.estimadoBrl))}</Item>
          </div>

          {analytics.porMotivoFalha.length > 0 && (
            <div className="rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
              <h3 className="mb-2 font-medium">Falhas por motivo</h3>
              <ul className="space-y-1 text-muted-foreground">
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
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Atualizando automaticamente a cada 5 segundos…
            </p>
          )}
        </div>
      )}

      {/* Ações de ciclo de vida */}
      <div className="mt-8 flex flex-wrap gap-2">
        {isPausada && (
          <Button
            type="button"
            onClick={() => acao('disparar')}
            disabled={processando || conexaoAtiva !== true}
          >
            <Play className="mr-2 h-4 w-4" />
            Retomar envio
          </Button>
        )}
        {podePausar && (
          <Button type="button" variant="outline" onClick={() => acao('pausar')} disabled={processando}>
            <Pause className="mr-2 h-4 w-4" />
            Pausar
          </Button>
        )}
        {podeCancelar && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmando('cancelar')}
            disabled={processando}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancelar campanha
          </Button>
        )}
        {podeExcluir && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmando('excluir')}
            disabled={processando}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        )}
      </div>

      {podeDisparar && conexaoAtiva === true && (
        <p className="mt-3 text-xs text-muted-foreground">
          Ao disparar, criamos uma mensagem por contato e enviamos com intervalo de segurança
          (respeitando os limites do seu {canalLabel(campanha.canal)}).
        </p>
      )}

      {/* Confirmações (Dialog do kit no lugar de window.confirm) */}
      <Dialog open={confirmando !== null} onOpenChange={(aberto) => !aberto && setConfirmando(null)}>
        {confirmando === 'cancelar' ? (
          <>
            <DialogHeader
              titulo="Cancelar esta campanha?"
              descricao="As mensagens que ainda não saíram não serão enviadas. Isso não pode ser desfeito."
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmando(null)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmando(null);
                  acao('cancelar');
                }}
              >
                Sim, cancelar campanha
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader
              titulo="Excluir esta campanha?"
              descricao="Ela some da sua lista. Esta ação não pode ser desfeita."
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmando(null)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmando(null);
                  excluir();
                }}
              >
                Sim, excluir
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function Kpi({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{valor}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
