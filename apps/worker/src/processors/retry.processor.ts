import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { ControlPlanePrismaService } from '../common/control-plane-prisma.service.js';
import { PrismaService } from '../common/prisma.service.js';

const QUEUE_NAME = 'dispatch-retry';
const REPEAT_KEY = 'retry-mensagens-falhadas';

/** Backoff exponencial (RULES 7.3): 1min, 5min, 30min, 2h, 12h. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];
const MAX_RETRIES = 5;

interface HistEntry {
  status?: string;
  retryable?: boolean;
}

/**
 * RetryProcessor (BOOTSTRAP 5.2 / RULES 7.3).
 *
 * Job recorrente (a cada 1 min): varre mensagens FALHOU de campanhas ainda
 * DISPARANDO cujo último histórico marca `retryable: true`. Reenfileira no
 * dispatch:{canal} com backoff exponencial. Após MAX_RETRIES, deixa FALHOU
 * permanente.
 */
@Processor(QUEUE_NAME, { concurrency: 1 })
export class RetryProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(RetryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly control: ControlPlanePrismaService,
    @InjectQueue(QUEUE_NAME) private readonly filaRetry: Queue,
    @InjectQueue('dispatch-email') private readonly filaEmail: Queue,
    @InjectQueue('dispatch-whatsapp') private readonly filaWhatsapp: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const existentes = await this.filaRetry.getRepeatableJobs();
    if (existentes.some((j) => j.name === REPEAT_KEY)) return;
    await this.filaRetry.add(REPEAT_KEY, {}, { repeat: { every: 60_000 }, jobId: REPEAT_KEY });
    this.logger.log({ msg: 'retry_recurring_registrado', intervalo: '1min' });
  }

  async process(
    _job: Job,
  ): Promise<{ reenfileiradas: number; desistidas: number; incertas: number }> {
    const incertas = await this.reconciliarClaimsAbandonados();

    // O plano de controle apenas descobre IDs; toda mutação abaixo usa RLS.
    const campanhasAtivas = await this.control.campanha.findMany({
      where: { status: { in: ['DISPARANDO', 'AGENDADA'] } },
      select: { id: true, tenantId: true },
    });
    if (campanhasAtivas.length === 0) {
      return { reenfileiradas: 0, desistidas: 0, incertas };
    }

    const falhadas = await this.control.mensagem.findMany({
      where: {
        status: 'FALHOU',
        campanhaId: { in: campanhasAtivas.map((c) => c.id) },
      },
      take: 1000,
    });

    let reenfileiradas = 0;
    let desistidas = 0;

    for (const msg of falhadas) {
      const historico = Array.isArray(msg.statusHistory)
        ? (msg.statusHistory as HistEntry[])
        : [];
      const falhas = historico.filter((h) => h.status === 'FALHOU');
      const ultima = falhas[falhas.length - 1];

      // Sem flag retryable ou já não-retryable → desiste (deixa FALHOU).
      if (!ultima || ultima.retryable !== true) {
        desistidas += 1;
        continue;
      }
      // tentativas = quantas vezes já falhou.
      if (falhas.length >= MAX_RETRIES) {
        desistidas += 1;
        continue;
      }

      const delay = BACKOFF_MS[Math.min(falhas.length - 1, BACKOFF_MS.length - 1)];

      // Reenfileira: marca ENFILEIRADA (não será re-selecionada no próximo scan)
      // e adiciona job com o backoff.
      await this.prisma.runInTenant(msg.tenantId, async (tx) => {
        await tx.mensagem.update({
          where: { id: msg.id },
          data: {
            status: 'ENFILEIRADA',
            statusHistory: {
              push: {
                status: 'ENFILEIRADA',
                motivo: `retry #${falhas.length}`,
                at: new Date().toISOString(),
              },
            },
          },
        });
      });

      const fila = msg.canal === 'WHATSAPP' ? this.filaWhatsapp : this.filaEmail;
      await fila.add(
        'enviar',
        { mensagemId: msg.id, tenantId: msg.tenantId, campanhaId: msg.campanhaId },
        // jobId único por tentativa: o job original (jobId = mensagemId) pode
        // ainda existir no set de completed — reusar o id deduparia o retry.
        { jobId: `${msg.id}:r${falhas.length}`, delay, attempts: 1 },
      );
      reenfileiradas += 1;
    }

    // Reconciliação de jobs perdidos: mensagens ENFILEIRADA cujo job sumiu do
    // Redis (ex.: Redis caiu no meio do addBulk do disparo) seriam órfãs para
    // sempre. Re-adicionamos com o MESMO jobId da mensagem — se o job original
    // ainda existe (waiting/delayed/completed recente), o BullMQ dedupa e nada
    // muda (o delay/throttle original é preservado); se sumiu, ressuscita.
    // `falhaMotivo: null` exclui mensagens em ciclo de retry (jobId próprio).
    const pendentesSemFalha = await this.control.mensagem.findMany({
      where: {
        status: 'ENFILEIRADA',
        falhaMotivo: null,
        campanhaId: { in: campanhasAtivas.map((c) => c.id) },
      },
      take: 500,
      select: { id: true, tenantId: true, campanhaId: true, canal: true },
    });
    for (const msg of pendentesSemFalha) {
      const fila = msg.canal === 'WHATSAPP' ? this.filaWhatsapp : this.filaEmail;
      await fila.add(
        'enviar',
        { mensagemId: msg.id, tenantId: msg.tenantId, campanhaId: msg.campanhaId },
        { jobId: msg.id, attempts: 1 },
      );
    }

    // Finaliza campanhas DISPARANDO sem mensagens pendentes/enfileiradas.
    let finalizadas = 0;
    for (const c of campanhasAtivas) {
      const pendentes = await this.prisma.runInTenant(c.tenantId, (tx) =>
        tx.mensagem.count({
          where: {
            campanhaId: c.id,
            status: { in: ['PENDENTE', 'ENFILEIRADA', 'PROCESSANDO'] },
          },
        }),
      );
      if (pendentes === 0) {
        const r = await this.prisma.runInTenant(c.tenantId, (tx) =>
          tx.campanha.updateMany({
            where: { id: c.id, status: 'DISPARANDO' },
            data: { status: 'FINALIZADA', finalizadaEm: new Date() },
          }),
        );
        finalizadas += r.count;
      }
    }

    if (reenfileiradas > 0 || desistidas > 0 || finalizadas > 0 || incertas > 0) {
      this.logger.log({ msg: 'retry_scan', reenfileiradas, desistidas, finalizadas, incertas });
    }
    return { reenfileiradas, desistidas, incertas };
  }

  /**
   * Uma queda após o provedor aceitar a chamada deixa o resultado ambíguo.
   * Reenviar seria potencialmente duplicar mensagem e cobrança; por isso o
   * watchdog pausa a campanha e exige reconciliação humana.
   */
  private async reconciliarClaimsAbandonados(): Promise<number> {
    const limite = new Date(Date.now() - 15 * 60_000);
    const abandonados = await this.control.mensagem.findMany({
      where: { status: 'PROCESSANDO', processamentoIniciadoEm: { lt: limite } },
      take: 500,
      select: { id: true, tenantId: true, campanhaId: true, processamentoToken: true },
    });
    let incertas = 0;
    for (const msg of abandonados) {
      const alterada = await this.prisma.runInTenant(msg.tenantId, async (tx) => {
        const r = await tx.mensagem.updateMany({
          where: {
            id: msg.id,
            status: 'PROCESSANDO',
            processamentoToken: msg.processamentoToken,
            processamentoIniciadoEm: { lt: limite },
          },
          data: {
            status: 'ENVIO_INCERTO',
            processamentoToken: null,
            processamentoIniciadoEm: null,
            falhaMotivo: 'Resultado do provedor desconhecido; reenvio automático bloqueado.',
            statusHistory: {
              push: {
                status: 'ENVIO_INCERTO',
                motivo: 'claim expirado',
                at: new Date().toISOString(),
              },
            },
          },
        });
        if (r.count > 0) {
          await tx.campanha.updateMany({
            where: { id: msg.campanhaId, status: { in: ['AGENDADA', 'DISPARANDO'] } },
            data: { status: 'PAUSADA' },
          });
        }
        return r.count;
      });
      incertas += alterada;
    }
    return incertas;
  }
}

export const RETRY_QUEUE = QUEUE_NAME;
