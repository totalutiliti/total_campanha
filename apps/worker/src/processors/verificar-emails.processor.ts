import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { ControlPlanePrismaService } from '../common/control-plane-prisma.service.js';
import { PrismaService } from '../common/prisma.service.js';
import { WorkerSesIdentityClient } from '../integrations/ses-identity.client.js';

const QUEUE_NAME = 'conexoes-verificar-email';
const REPEAT_KEY = 'verificar-emails-pendentes';

/**
 * Job recorrente (BOOTSTRAP 4.2): a cada hora, re-checa todas as `ConexaoEmail`
 * em status PENDENTE_VERIFICACAO de TODOS os tenants e ativa quando DKIM
 * estiver SUCCESS.
 *
 * A descoberta cross-tenant usa a conexão isolada do plano de controle.
 * Atualização e auditoria usam `runInTenant`, sob RLS.
 */
@Processor(QUEUE_NAME, { concurrency: 1 })
export class VerificarEmailsProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(VerificarEmailsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly control: ControlPlanePrismaService,
    private readonly ses: WorkerSesIdentityClient,
    @InjectQueue(QUEUE_NAME) private readonly fila: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Registra o repeatable job idempotentemente.
    const existentes = await this.fila.getRepeatableJobs();
    const jaExiste = existentes.find((j) => j.name === REPEAT_KEY);
    if (jaExiste) {
      this.logger.log({ msg: 'recurring_job_existente', key: REPEAT_KEY, cron: jaExiste.pattern });
      return;
    }
    await this.fila.add(
      REPEAT_KEY,
      {},
      {
        repeat: { every: 60 * 60 * 1000 }, // 1h
        jobId: REPEAT_KEY,
      },
    );
    this.logger.log({ msg: 'recurring_job_registrado', key: REPEAT_KEY, intervalo: '1h' });
  }

  async process(_job: Job): Promise<{ checadas: number; ativadas: number }> {
    // Apenas descobre os IDs sem filtro de tenant; não faz mutação por aqui.
    const pendentes = await this.control.conexaoEmail.findMany({
      where: { status: 'PENDENTE_VERIFICACAO' },
    });

    if (pendentes.length === 0) {
      this.logger.debug({ msg: 'nenhuma_pendente' });
      return { checadas: 0, ativadas: 0 };
    }

    let ativadas = 0;
    for (const conexao of pendentes) {
      try {
        const r = await this.ses.verificar(conexao.dominio);
        const novoStatus =
          r.status === 'verificada'
            ? 'ATIVA'
            : r.status === 'falha'
              ? 'ERRO'
              : 'PENDENTE_VERIFICACAO';

        if (novoStatus !== conexao.status) {
          await this.prisma.runInTenant(conexao.tenantId, async (tx) => {
            await tx.conexaoEmail.update({
              where: { id: conexao.id },
              data: { status: novoStatus, dkimStatus: r.dkimStatus.toLowerCase() },
            });
            if (novoStatus === 'ATIVA') ativadas += 1;
            await tx.auditLog.create({
              data: {
                tenantId: conexao.tenantId,
                userId: null,
                acao: 'conexao_email.verificar.recorrente',
                recurso: conexao.id,
                dados: { dominio: conexao.dominio, novoStatus, dkimStatus: r.dkimStatus },
              },
            });
          });
        }
      } catch (err) {
        this.logger.warn({
          msg: 'verificar_conexao_falhou',
          conexaoId: conexao.id,
          dominio: conexao.dominio,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log({ msg: 'verificacao_concluida', checadas: pendentes.length, ativadas });
    return { checadas: pendentes.length, ativadas };
  }
}

export const VERIFICAR_EMAILS_QUEUE = QUEUE_NAME;
