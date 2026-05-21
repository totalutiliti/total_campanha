import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { MailService } from '../common/mail.service.js';
import { PrismaService } from '../common/prisma.service.js';

const QUEUE_NAME = 'billing-trial';
const REPEAT_KEY = 'trial-check';

/** Marcos de lembrete (dias antes do fim do trial). */
const MARCOS = [
  { dias: 7, chave: '7d' },
  { dias: 3, chave: '3d' },
  { dias: 1, chave: '1d' },
];

/**
 * TrialProcessor (BOOTSTRAP 6.2).
 *
 * Job recorrente (a cada 6h): para tenants TRIAL
 *   - trialAteEm já passou → status INADIMPLENTE (freeze de envios).
 *   - faltam 7/3/1 dias → envia email de lembrete (uma vez por marco).
 *
 * Cross-tenant (BYPASSRLS). `tenants` é tabela global.
 */
@Processor(QUEUE_NAME, { concurrency: 1 })
export class TrialProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(TrialProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @InjectQueue(QUEUE_NAME) private readonly fila: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const existentes = await this.fila.getRepeatableJobs();
    if (existentes.some((j) => j.name === REPEAT_KEY)) return;
    await this.fila.add(
      REPEAT_KEY,
      {},
      { repeat: { every: 6 * 60 * 60 * 1000 }, jobId: REPEAT_KEY },
    );
    this.logger.log({ msg: 'trial_recurring_registrado', intervalo: '6h' });
  }

  async process(_job: Job): Promise<{ expirados: number; lembretes: number }> {
    const tenants = await this.prisma.tenant.findMany({ where: { status: 'TRIAL' } });
    const agora = Date.now();
    let expirados = 0;
    let lembretes = 0;

    for (const tenant of tenants) {
      if (!tenant.trialAteEm) continue;
      const restanteMs = tenant.trialAteEm.getTime() - agora;

      // Trial expirado → INADIMPLENTE.
      if (restanteMs <= 0) {
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: { status: 'INADIMPLENTE' },
        });
        await this.prisma.auditLog.create({
          data: {
            tenantId: tenant.id,
            userId: null,
            acao: 'billing.trial_expirado',
            recurso: tenant.id,
            dados: { trialAteEm: tenant.trialAteEm.toISOString() },
          },
        });
        expirados += 1;
        continue;
      }

      // Lembretes 7d/3d/1d.
      const diasRestantes = Math.ceil(restanteMs / 86_400_000);
      const marco = MARCOS.find((m) => m.dias === diasRestantes);
      if (marco && !tenant.trialLembretes.includes(marco.chave)) {
        const enviado = await this.enviarLembrete(tenant.id, tenant.razaoSocial, diasRestantes);
        if (enviado) {
          await this.prisma.tenant.update({
            where: { id: tenant.id },
            data: { trialLembretes: { push: marco.chave } },
          });
          lembretes += 1;
        }
      }
    }

    if (expirados > 0 || lembretes > 0) {
      this.logger.log({ msg: 'trial_check', expirados, lembretes });
    }
    return { expirados, lembretes };
  }

  private async enviarLembrete(
    tenantId: string,
    razaoSocial: string,
    dias: number,
  ): Promise<boolean> {
    const adminUt = await this.prisma.userTenant.findFirst({
      where: { tenantId, role: 'ADMIN' },
      include: { user: true },
    });
    if (!adminUt) return false;
    try {
      await this.mail.enviar({
        to: adminUt.user.email,
        subject: `Seu período de teste termina em ${dias} dia(s)`,
        html: `<p>Olá,</p><p>O período de teste da <strong>${razaoSocial}</strong> na Total Campanha termina em <strong>${dias} dia(s)</strong>.</p><p>Assine um plano para não interromper seus envios.</p>`,
      });
      return true;
    } catch (err) {
      this.logger.warn({ msg: 'lembrete_trial_falhou', tenantId, err });
      return false;
    }
  }
}

export const TRIAL_QUEUE = QUEUE_NAME;
