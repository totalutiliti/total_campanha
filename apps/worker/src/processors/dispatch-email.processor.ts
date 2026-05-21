import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@total-campanha/db';
import type { Job } from 'bullmq';

import { CUSTO_REFERENCIA, UsageService } from '../common/usage.service.js';
import { MailService } from '../common/mail.service.js';
import { PrismaService } from '../common/prisma.service.js';
import {
  renderizarAssunto,
  renderizarEmail,
  variaveisDoContato,
} from '../common/render.js';

interface DispatchJob {
  mensagemId: string;
  tenantId: string;
  campanhaId: string;
}

/**
 * DispatchEmailProcessor (BOOTSTRAP 5.2).
 *
 * Concurrency 5; o throttle real vem do `delay` setado em cada job pelo
 * CampanhasDispatchService — não precisamos de limiter aqui.
 */
@Processor('dispatch-email', { concurrency: 5 })
export class DispatchEmailProcessor extends WorkerHost {
  private readonly logger = new Logger(DispatchEmailProcessor.name);
  private readonly optOutBaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly usage: UsageService,
  ) {
    super();
    this.optOutBaseUrl =
      config.get<string>('PUBLIC_OPT_OUT_BASE_URL') ?? 'http://localhost:3000/p/opt-out';
  }

  async process(job: Job<DispatchJob>): Promise<void> {
    const { mensagemId, tenantId, campanhaId } = job.data;

    const ctx = await this.prisma.runInTenant(tenantId, async (tx) => {
      const mensagem = await tx.mensagem.findUnique({ where: { id: mensagemId } });
      if (!mensagem || mensagem.status === 'CANCELADA') return null;

      const campanha = await tx.campanha.findUnique({ where: { id: campanhaId } });
      if (!campanha) return null;

      // Campanha pausada/cancelada → cancela a mensagem e não envia.
      if (campanha.status === 'PAUSADA' || campanha.status === 'CANCELADA') {
        await tx.mensagem.update({
          where: { id: mensagemId },
          data: { status: 'CANCELADA' },
        });
        return null;
      }

      // Primeira mensagem efetiva → AGENDADA vira DISPARANDO.
      if (campanha.status === 'AGENDADA') {
        await tx.campanha.update({
          where: { id: campanhaId },
          data: { status: 'DISPARANDO', iniciadaEm: new Date() },
        });
      }

      const template = await tx.template.findUnique({ where: { id: campanha.templateId } });
      const contato = mensagem.contatoId
        ? await tx.contato.findUnique({ where: { id: mensagem.contatoId } })
        : null;

      return { mensagem, campanha, template, contato };
    });

    if (!ctx) return;
    const { template, contato } = ctx;

    // Validações que levam a FALHA permanente.
    if (!template || !template.mjml) {
      await this.marcarFalha(tenantId, mensagemId, campanhaId, 'Template sem MJML');
      return;
    }
    if (!contato || !contato.email) {
      await this.marcarFalha(tenantId, mensagemId, campanhaId, 'Contato sem email');
      return;
    }
    if (!contato.optInEmail) {
      await this.marcarFalha(tenantId, mensagemId, campanhaId, 'Contato sem opt-in de email');
      return;
    }

    const variaveis = variaveisDoContato({
      nome: contato.nome,
      email: contato.email,
      telefoneE164: contato.telefoneE164,
      extras: (contato.extras as Record<string, unknown>) ?? {},
    });

    try {
      const html = renderizarEmail(template.mjml, variaveis);
      const assunto = renderizarAssunto(template.assunto ?? '(sem assunto)', variaveis);
      const optOutUrl = `${this.optOutBaseUrl}/placeholder-token`; // token real virá com tracking (Fase 6)

      await this.mail.enviar({
        to: contato.email,
        subject: assunto,
        html,
        headers: {
          'List-Unsubscribe': `<${optOutUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      await this.prisma.runInTenant(tenantId, async (tx) => {
        await tx.mensagem.update({
          where: { id: mensagemId },
          data: {
            status: 'ENVIADA',
            enviadaEm: new Date(),
            custoEstimadoBrl: new Prisma.Decimal(CUSTO_REFERENCIA.sesEmailSend),
            statusHistory: { push: { status: 'ENVIADA', at: new Date().toISOString() } },
          },
        });
        await tx.campanha.update({
          where: { id: campanhaId },
          data: { totalEnviados: { increment: 1 } },
        });
      });

      await this.usage.log(tenantId, 'ses.email.send', CUSTO_REFERENCIA.sesEmailSend, {
        mensagemId,
        campanhaId,
      });
    } catch (err) {
      this.logger.warn({ msg: 'dispatch_email_falhou', mensagemId, err });
      await this.marcarFalha(
        tenantId,
        mensagemId,
        campanhaId,
        err instanceof Error ? err.message.slice(0, 200) : 'Erro de envio',
      );
    }
  }

  private async marcarFalha(
    tenantId: string,
    mensagemId: string,
    campanhaId: string,
    motivo: string,
  ): Promise<void> {
    await this.prisma.runInTenant(tenantId, async (tx) => {
      await tx.mensagem.update({
        where: { id: mensagemId },
        data: {
          status: 'FALHOU',
          falhaMotivo: motivo,
          statusHistory: { push: { status: 'FALHOU', motivo, at: new Date().toISOString() } },
        },
      });
      await tx.campanha.update({
        where: { id: campanhaId },
        data: { totalFalhas: { increment: 1 } },
      });
    });
  }
}
