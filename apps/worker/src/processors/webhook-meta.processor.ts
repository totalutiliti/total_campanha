import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';

import { PrismaService, PrismaTx } from '../common/prisma.service.js';
import { enviarAlertaSlack } from '../common/slack.js';

interface WebhookJob {
  tenantId: string;
  payload: unknown;
}

interface MetaStatus {
  id: string;
  status: string; // sent | delivered | read | failed
  timestamp?: string;
  recipient_id?: string;
}

interface MetaInbound {
  from: string;
  id: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
}

const PALAVRAS_OPT_OUT = new Set(['SAIR', 'STOP', 'CANCELAR', 'PARAR']);

/**
 * WebhookMetaProcessor (BOOTSTRAP 5.2 + parte do 5.3).
 *
 * Consome `webhook-meta`. Para cada change:
 *   - `statuses[]` → atualiza Mensagem por providerMessageId + contadores da Campanha.
 *   - `messages[]` (inbound) → cria/atualiza InboxConversa+Mensagem; aciona
 *     opt-out automático em SAIR/STOP/CANCELAR/PARAR.
 *
 * Detecta falha em massa (RULES 7.4): >10% de falhas em 5 min → pausa + Slack.
 */
@Processor('webhook-meta', { concurrency: 3 })
export class WebhookMetaProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookMetaProcessor.name);
  private readonly slackUrl?: string;
  private readonly termoVersao: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super();
    this.slackUrl = config.get<string>('SLACK_WEBHOOK_URL') ?? undefined;
    this.termoVersao = config.get<string>('CURRENT_OPT_IN_TERM_VERSION') ?? 'webhook';
  }

  async process(job: Job<WebhookJob>): Promise<void> {
    const { tenantId, payload } = job.data;
    const entries = extrairEntries(payload);

    for (const value of entries) {
      const statuses = Array.isArray(value.statuses) ? (value.statuses as MetaStatus[]) : [];
      const inbound = Array.isArray(value.messages) ? (value.messages as MetaInbound[]) : [];

      for (const st of statuses) {
        await this.processarStatus(tenantId, st);
      }
      for (const msg of inbound) {
        await this.processarInbound(tenantId, msg);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Status update
  // -------------------------------------------------------------------------
  private async processarStatus(tenantId: string, st: MetaStatus): Promise<void> {
    const mapa: Record<string, { status: string; campo?: 'entregueEm' | 'lidaEm' }> = {
      delivered: { status: 'ENTREGUE', campo: 'entregueEm' },
      read: { status: 'LIDA', campo: 'lidaEm' },
      failed: { status: 'FALHOU' },
    };
    const alvo = mapa[st.status];
    if (!alvo) return; // 'sent' já foi tratado no dispatch.

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const mensagem = await tx.mensagem.findFirst({
        where: { providerMessageId: st.id },
      });
      if (!mensagem) {
        this.logger.debug({ msg: 'status_sem_mensagem', providerMessageId: st.id });
        return;
      }

      // Não regride status (read não vira delivered).
      const ordem = ['ENVIADA', 'ENTREGUE', 'LIDA'];
      const idxAtual = ordem.indexOf(mensagem.status);
      const idxNovo = ordem.indexOf(alvo.status);
      if (alvo.status !== 'FALHOU' && idxNovo >= 0 && idxNovo <= idxAtual) {
        return;
      }

      await tx.mensagem.update({
        where: { id: mensagem.id },
        data: {
          status: alvo.status as 'ENTREGUE' | 'LIDA' | 'FALHOU',
          ...(alvo.campo === 'entregueEm' ? { entregueEm: new Date() } : {}),
          ...(alvo.campo === 'lidaEm' ? { lidaEm: new Date() } : {}),
          statusHistory: {
            push: { status: alvo.status, at: new Date().toISOString(), via: 'webhook' },
          },
        },
      });

      // Contadores agregados na Campanha.
      const inc =
        alvo.status === 'ENTREGUE'
          ? { totalEntregues: { increment: 1 } }
          : alvo.status === 'LIDA'
            ? { totalLidos: { increment: 1 } }
            : { totalFalhas: { increment: 1 } };
      await tx.campanha.update({ where: { id: mensagem.campanhaId }, data: inc });

      if (alvo.status === 'FALHOU') {
        await this.checarFalhaEmMassa(tx, tenantId, mensagem.campanhaId);
      }
    });
  }

  /**
   * RULES 7.4 — se >10% das mensagens da campanha falharam e ela ainda está
   * DISPARANDO, pausa e alerta. Bloqueio mínimo de 20 mensagens para evitar
   * falso-positivo no começo do disparo.
   */
  private async checarFalhaEmMassa(
    tx: PrismaTx,
    tenantId: string,
    campanhaId: string,
  ): Promise<void> {
    const campanha = await tx.campanha.findUnique({ where: { id: campanhaId } });
    if (!campanha || campanha.status !== 'DISPARANDO') return;

    const processadas = campanha.totalEnviados + campanha.totalFalhas;
    if (processadas < 20) return;
    const taxaFalha = campanha.totalFalhas / processadas;
    if (taxaFalha <= 0.1) return;

    await tx.campanha.update({ where: { id: campanhaId }, data: { status: 'PAUSADA' } });
    this.logger.warn({ msg: 'falha_em_massa', campanhaId, taxaFalha });
    await enviarAlertaSlack(this.slackUrl, {
      titulo: 'Campanha pausada — falha em massa',
      texto: `Campanha ${campanha.nome} (${campanhaId}) pausada: ${(taxaFalha * 100).toFixed(1)}% de falhas. tenant=${tenantId}`,
    });
  }

  // -------------------------------------------------------------------------
  // Mensagem recebida (inbound) — Inbox + opt-out automático
  // -------------------------------------------------------------------------
  private async processarInbound(tenantId: string, msg: MetaInbound): Promise<void> {
    const telefone = msg.from.startsWith('+') ? msg.from : `+${msg.from}`;
    const conteudo = msg.text?.body?.trim() ?? '';

    await this.prisma.runInTenant(tenantId, async (tx) => {
      // Contato — find or create (mensagem recebida não implica opt-in).
      let contato = await tx.contato.findFirst({ where: { telefoneE164: telefone } });
      if (!contato) {
        contato = await tx.contato.create({
          data: {
            tenantId,
            telefoneE164: telefone,
            tags: [],
            extras: {},
            optInEmail: false,
            optInWhatsapp: false,
          },
        });
      }

      const agora = new Date();
      const janela = new Date(agora.getTime() + 24 * 3600_000);

      // Conversa — uma por contato (find-or-create).
      let conversa = await tx.inboxConversa.findFirst({ where: { contatoId: contato.id } });
      if (!conversa) {
        conversa = await tx.inboxConversa.create({
          data: {
            tenantId,
            contatoId: contato.id,
            ultimoMsgAt: agora,
            janela24hExpiraEm: janela,
            status: 'aberta',
          },
        });
      } else {
        conversa = await tx.inboxConversa.update({
          where: { id: conversa.id },
          data: { ultimoMsgAt: agora, janela24hExpiraEm: janela, status: 'aberta' },
        });
      }

      await tx.inboxMensagem.create({
        data: {
          tenantId,
          conversaId: conversa.id,
          direcao: 'in',
          conteudo: conteudo || `[${msg.type ?? 'desconhecido'}]`,
        },
      });

      // Opt-out automático (RULES 5.2).
      if (PALAVRAS_OPT_OUT.has(conteudo.toUpperCase())) {
        await tx.contato.update({
          where: { id: contato.id },
          data: { optInWhatsapp: false },
        });
        await tx.optInLog.create({
          data: {
            tenantId,
            contatoId: contato.id,
            telefoneE164: telefone,
            canal: 'WHATSAPP',
            acao: 'OPT_OUT',
            ip: '0.0.0.0',
            userAgent: 'whatsapp-inbound',
            origem: 'whatsapp-stop',
            versaoTermo: this.termoVersao,
          },
        });
        this.logger.log({ msg: 'opt_out_automatico', contatoId: contato.id });
      }

      // Se a mensagem é resposta a uma campanha, conta como respondida.
      // Heurística simples: incrementa totalRespondidos da campanha mais recente
      // com mensagem ENVIADA/ENTREGUE/LIDA para este contato.
      const ultimaMsg = await tx.mensagem.findFirst({
        where: {
          contatoId: contato.id,
          status: { in: ['ENVIADA', 'ENTREGUE', 'LIDA'] },
        },
        orderBy: { enviadaEm: 'desc' },
      });
      if (ultimaMsg && ultimaMsg.status !== 'RESPONDIDA') {
        await tx.mensagem.update({
          where: { id: ultimaMsg.id },
          data: { status: 'RESPONDIDA' },
        });
        await tx.campanha.update({
          where: { id: ultimaMsg.campanhaId },
          data: { totalRespondidos: { increment: 1 } },
        });
      }
    });
  }
}

/**
 * Extrai a lista de `value` de changes do payload Meta, com narrowing seguro.
 */
function extrairEntries(payload: unknown): Array<Record<string, unknown>> {
  if (typeof payload !== 'object' || payload === null) return [];
  const entry = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entry)) return [];
  const valores: Array<Record<string, unknown>> = [];
  for (const e of entry) {
    const changes = (e as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const c of changes) {
      const value = (c as { value?: unknown }).value;
      if (typeof value === 'object' && value !== null) {
        valores.push(value as Record<string, unknown>);
      }
    }
  }
  return valores;
}
