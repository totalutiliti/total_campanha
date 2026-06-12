'use client';

import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { AlertErro, AlertSucesso } from '../../../components/ui/alerts';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Dialog, DialogFooter, DialogHeader } from '../../../components/ui/dialog';
import { useAuth } from '../../../lib/auth/context';
import { cn } from '../../../lib/cn';
import { mensagemErro } from '../../../lib/erro';

interface BillingAtual {
  plano: 'STARTER' | 'PRO' | 'ENTERPRISE';
  status: 'TRIAL' | 'ATIVO' | 'INADIMPLENTE' | 'SUSPENSO' | 'CANCELADO';
  valorMensalBrl: number;
  trialAteEm: string | null;
  temAssinatura: boolean;
  linkPagamento: string | null;
}

const PLANOS = [
  {
    id: 'STARTER' as const,
    nome: 'Starter',
    preco: 97,
    descricao: 'Para começar a vender mais',
    beneficios: ['Campanhas de WhatsApp e e-mail', 'Até 1.000 contatos', 'Respostas no sistema'],
  },
  {
    id: 'PRO' as const,
    nome: 'Pro',
    preco: 297,
    descricao: 'Para quem envia toda semana',
    beneficios: ['Tudo do Starter', 'Até 10.000 contatos', 'Vários domínios de e-mail'],
  },
  {
    id: 'ENTERPRISE' as const,
    nome: 'Enterprise',
    preco: 997,
    descricao: 'Para operações grandes',
    beneficios: ['Tudo do Pro', 'Contatos ilimitados', 'Atendimento prioritário'],
  },
];

const STATUS_LABEL: Record<BillingAtual['status'], { texto: string; classes: string }> = {
  TRIAL: { texto: 'Em teste', classes: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  ATIVO: { texto: 'Ativo', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  INADIMPLENTE: { texto: 'Pagamento pendente', classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  SUSPENSO: { texto: 'Suspenso', classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  CANCELADO: { texto: 'Cancelado', classes: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

/** Plano e cobrança — visível só para o Administrador (item filtrado na nav). */
export default function PlanoPage() {
  const { api } = useAuth();
  const [billing, setBilling] = useState<BillingAtual | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<(typeof PLANOS)[number] | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [linkPagamento, setLinkPagamento] = useState<string | null>(null);

  const carregar = useCallback(() => {
    api<BillingAtual>({ method: 'GET', path: '/billing/atual' })
      .then((b) => {
        setBilling(b);
        setLinkPagamento(b.linkPagamento);
      })
      .catch((e) => setErro(mensagemErro(e)));
  }, [api]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function confirmarPlano() {
    if (!confirmando || !billing) return;
    setProcessando(true);
    setErro(null);
    setSucesso(null);
    try {
      if (billing.temAssinatura) {
        await api({ method: 'POST', path: '/billing/atualizar-plano', body: { plano: confirmando.id } });
        setSucesso(`Plano alterado para ${confirmando.nome}. O novo valor vale a partir da próxima cobrança.`);
      } else {
        const r = await api<{ linkPagamento: string | null }>({
          method: 'POST',
          path: '/billing/assinar',
          body: { plano: confirmando.id },
        });
        setLinkPagamento(r.linkPagamento);
        setSucesso(
          r.linkPagamento
            ? `Assinatura do plano ${confirmando.nome} criada! Agora é só pagar a primeira cobrança no link abaixo.`
            : `Assinatura do plano ${confirmando.nome} criada! O link de pagamento chega por e-mail.`,
        );
      }
      setConfirmando(null);
      carregar();
    } catch (err) {
      setErro(mensagemErro(err));
      setConfirmando(null);
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarCancelamento() {
    setProcessando(true);
    setErro(null);
    try {
      await api({ method: 'POST', path: '/billing/cancelar' });
      setSucesso('Assinatura cancelada.');
      setCancelando(false);
      carregar();
    } catch (err) {
      setErro(mensagemErro(err));
      setCancelando(false);
    } finally {
      setProcessando(false);
    }
  }

  if (!billing) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Plano</h1>
        {erro ? <AlertErro>{erro}</AlertErro> : <p className="text-sm text-muted-foreground">Carregando…</p>}
      </div>
    );
  }

  const statusInfo = STATUS_LABEL[billing.status];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Plano</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Veja como está sua conta e escolha o plano do tamanho da sua operação.
        </p>
      </div>

      {erro && <AlertErro>{erro}</AlertErro>}
      {sucesso && <AlertSucesso>{sucesso}</AlertSucesso>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Sua conta hoje</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Plano</p>
            <p className="text-2xl font-bold">
              {PLANOS.find((p) => p.id === billing.plano)?.nome ?? billing.plano}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Situação</p>
            <Badge className={statusInfo.classes}>{statusInfo.texto}</Badge>
          </div>
          {billing.status === 'TRIAL' && billing.trialAteEm && (
            <div>
              <p className="text-sm text-muted-foreground">Teste grátis até</p>
              <p className="text-sm font-medium">
                {new Date(billing.trialAteEm).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}
          {linkPagamento && billing.status !== 'ATIVO' && (
            <a href={linkPagamento} target="_blank" rel="noreferrer" className="ml-auto">
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Pagar agora
              </Button>
            </a>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANOS.map((p) => {
          const atual = billing.plano === p.id && billing.temAssinatura;
          return (
            <Card key={p.id} className={cn('flex flex-col', atual && 'border-primary ring-1 ring-primary')}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{p.nome}</CardTitle>
                  {atual && <Badge>Seu plano</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{p.descricao}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <p className="text-3xl font-bold">
                  R$ {p.preco}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm flex-1">
                  {p.beneficios.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={atual ? 'outline' : 'default'}
                  disabled={atual}
                  onClick={() => setConfirmando(p)}
                >
                  {atual ? 'Plano atual' : billing.temAssinatura ? 'Mudar para este' : 'Assinar este plano'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {billing.temAssinatura && billing.status !== 'CANCELADO' && (
        <div className="rounded-lg border border-destructive/30 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium">Cancelar assinatura</p>
            <p className="text-xs text-muted-foreground">
              Os envios param e a conta fica somente leitura.
            </p>
          </div>
          <Button variant="destructive" onClick={() => setCancelando(true)}>
            Cancelar assinatura
          </Button>
        </div>
      )}

      <Dialog open={confirmando !== null} onOpenChange={(v) => !v && setConfirmando(null)}>
        <DialogHeader
          titulo={
            billing.temAssinatura
              ? `Mudar para o plano ${confirmando?.nome}?`
              : `Assinar o plano ${confirmando?.nome}?`
          }
          descricao={`R$ ${confirmando?.preco}/mês. ${
            billing.temAssinatura
              ? 'O novo valor vale a partir da próxima cobrança.'
              : 'Você recebe o link de pagamento na hora.'
          }`}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmando(null)} disabled={processando}>
            Voltar
          </Button>
          <Button onClick={confirmarPlano} disabled={processando}>
            {processando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={cancelando} onOpenChange={setCancelando}>
        <DialogHeader
          titulo="Cancelar a assinatura?"
          descricao="Suas campanhas param de ser enviadas e a conta fica somente leitura. Você pode assinar de novo quando quiser."
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setCancelando(false)} disabled={processando}>
            Manter assinatura
          </Button>
          <Button variant="destructive" onClick={confirmarCancelamento} disabled={processando}>
            {processando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelando...
              </>
            ) : (
              'Cancelar assinatura'
            )}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
