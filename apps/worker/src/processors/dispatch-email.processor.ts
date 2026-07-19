import * as crypto from 'node:crypto';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@total-campanha/db';
import type { Job } from 'bullmq';

import { MailService } from '../common/mail.service.js';
import { OptOutTokenService } from '../common/opt-out-token.service.js';
import { PrismaService } from '../common/prisma.service.js';
import {
  renderizarAssunto,
  renderizarEmail,
  variaveisDoContato,
} from '../common/render.js';
import { CUSTO_REFERENCIA } from '../common/usage.service.js';

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
    private readonly optOutToken: OptOutTokenService,
  ) {
    super();
    this.optOutBaseUrl =
      config.get<string>('PUBLIC_OPT_OUT_BASE_URL') ?? 'http://localhost:3000/p/opt-out';
  }

  async process(job: Job<DispatchJob>): Promise<void> {
    const { mensagemId, tenantId, campanhaId } = job.data;

    // Defesa em profundidade (RULES 6): tenant suspenso/inadimplente não envia,
    // mesmo com jobs já enfileirados. A mensagem é cancelada com motivo claro.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    if (!tenant || (tenant.status !== 'ATIVO' && tenant.status !== 'TRIAL')) {
      await this.cancelarPorConta(tenantId, mensagemId, tenant?.status ?? 'INEXISTENTE');
      return;
    }

    const claimToken = crypto.randomUUID();
    const ctx = await this.prisma.runInTenant(tenantId, async (tx) => {
      const claimed = await tx.mensagem.updateMany({
        where: {
          id: mensagemId,
          campanhaId,
          status: { in: ['PENDENTE', 'ENFILEIRADA'] },
        },
        data: {
          status: 'PROCESSANDO',
          processamentoToken: claimToken,
          processamentoIniciadoEm: new Date(),
          tentativasEnvio: { increment: 1 },
          falhaMotivo: null,
          statusHistory: {
            push: { status: 'PROCESSANDO', at: new Date().toISOString() },
          },
        },
      });
      if (claimed.count === 0) {
        return null;
      }

      const mensagem = await tx.mensagem.findUnique({ where: { id: mensagemId } });
      if (!mensagem) return null;

      const campanha = await tx.campanha.findUnique({ where: { id: campanhaId } });
      if (!campanha) return null;

      // Campanha pausada/cancelada → cancela a mensagem e não envia.
      if (campanha.status === 'PAUSADA' || campanha.status === 'CANCELADA') {
        await tx.mensagem.update({
          where: { id: mensagemId },
          data: {
            status: 'CANCELADA',
            processamentoToken: null,
            processamentoIniciadoEm: null,
          },
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
      const conexao = await tx.conexaoEmail.findFirst({
        where: { status: 'ATIVA' },
        orderBy: { createdAt: 'asc' },
      });

      return { mensagem, campanha, template, contato, conexao };
    });

    if (!ctx) return;
    const { template, contato, conexao } = ctx;

    // Validações que levam a FALHA permanente.
    if (!template || !template.mjml) {
      await this.marcarFalha(tenantId, mensagemId, campanhaId, claimToken, 'Template sem MJML');
      return;
    }
    if (!contato || !contato.email) {
      await this.marcarFalha(tenantId, mensagemId, campanhaId, claimToken, 'Contato sem email');
      return;
    }
    if (!contato.optInEmail) {
      await this.marcarFalha(
        tenantId,
        mensagemId,
        campanhaId,
        claimToken,
        'Contato sem opt-in de email',
      );
      return;
    }
    if (!conexao) {
      await this.marcarFalha(
        tenantId,
        mensagemId,
        campanhaId,
        claimToken,
        'Conexão de email inativa',
        true,
      );
      return;
    }

    // Token HMAC real de opt-out one-click (RULES 5.2/LGPD) — verificado pela
    // API em /p/opt-out/:token. Disponível no template como {{opt_out_url}}.
    const optOutUrl = `${this.optOutBaseUrl}/${this.optOutToken.emitir(
      tenantId,
      contato.id,
      'EMAIL',
    )}`;

    const variaveis = {
      ...variaveisDoContato({
        nome: contato.nome,
        email: contato.email,
        telefoneE164: contato.telefoneE164,
        extras: (contato.extras as Record<string, unknown>) ?? {},
      }),
      opt_out_url: optOutUrl,
    };

    let html: string;
    let assunto: string;
    try {
      html = comRodapeOptOut(await renderizarEmail(template.mjml, variaveis), optOutUrl);
      assunto = renderizarAssunto(template.assunto ?? '(sem assunto)', variaveis);
    } catch (err) {
      await this.marcarFalha(
        tenantId,
        mensagemId,
        campanhaId,
        claimToken,
        err instanceof Error
          ? `Template inválido: ${err.message.slice(0, 160)}`
          : 'Template inválido',
      );
      return;
    }

    try {
      const enviada = await this.mail.enviar({
        from: conexao.remetente,
        to: contato.email,
        subject: assunto,
        html,
        headers: {
          'List-Unsubscribe': `<${optOutUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      if (!enviada.messageId) {
        throw new Error('Provedor de email não retornou o ID da mensagem.');
      }

      await this.prisma.runInTenant(tenantId, async (tx) => {
        const concluida = await tx.mensagem.updateMany({
          where: { id: mensagemId, status: 'PROCESSANDO', processamentoToken: claimToken },
          data: {
            status: 'ENVIADA',
            enviadaEm: new Date(),
            providerMessageId: enviada.messageId,
            processamentoToken: null,
            processamentoIniciadoEm: null,
            custoEstimadoBrl: new Prisma.Decimal(CUSTO_REFERENCIA.sesEmailSend),
            statusHistory: { push: { status: 'ENVIADA', at: new Date().toISOString() } },
          },
        });
        if (concluida.count > 0) {
          await tx.campanha.update({
            where: { id: campanhaId },
            data: { totalEnviados: { increment: 1 } },
          });
          await tx.usageLog.create({
            data: {
              tenantId,
              servico: 'ses.email.send',
              custoEstimadoBrl: new Prisma.Decimal(CUSTO_REFERENCIA.sesEmailSend),
              metadados: { mensagemId, campanhaId, providerMessageId: enviada.messageId },
            },
          });
        }
      });
    } catch (err) {
      this.logger.warn({ msg: 'dispatch_email_falhou', mensagemId, err });
      await this.marcarIncerto(
        tenantId,
        mensagemId,
        campanhaId,
        claimToken,
        err instanceof Error ? err.message.slice(0, 200) : 'Erro de envio',
      );
    }
  }

  private async marcarFalha(
    tenantId: string,
    mensagemId: string,
    campanhaId: string,
    claimToken: string,
    motivo: string,
    retryable = false,
  ): Promise<void> {
    await this.prisma.runInTenant(tenantId, async (tx) => {
      const alterada = await tx.mensagem.updateMany({
        where: { id: mensagemId, status: 'PROCESSANDO', processamentoToken: claimToken },
        data: {
          status: 'FALHOU',
          falhaMotivo: motivo,
          processamentoToken: null,
          processamentoIniciadoEm: null,
          statusHistory: {
            push: { status: 'FALHOU', motivo, retryable, at: new Date().toISOString() },
          },
        },
      });
      if (alterada.count > 0) {
        await tx.campanha.update({
          where: { id: campanhaId },
          data: { totalFalhas: { increment: 1 } },
        });
      }
    });
  }

  private async marcarIncerto(
    tenantId: string,
    mensagemId: string,
    campanhaId: string,
    claimToken: string,
    motivo: string,
  ): Promise<void> {
    await this.prisma.runInTenant(tenantId, async (tx) => {
      const alterada = await tx.mensagem.updateMany({
        where: { id: mensagemId, status: 'PROCESSANDO', processamentoToken: claimToken },
        data: {
          status: 'ENVIO_INCERTO',
          falhaMotivo: motivo,
          processamentoToken: null,
          processamentoIniciadoEm: null,
          statusHistory: {
            push: { status: 'ENVIO_INCERTO', motivo, at: new Date().toISOString() },
          },
        },
      });
      if (alterada.count > 0) {
        await tx.campanha.updateMany({
          where: { id: campanhaId, status: { in: ['AGENDADA', 'DISPARANDO'] } },
          data: { status: 'PAUSADA' },
        });
      }
    });
  }

  private async cancelarPorConta(
    tenantId: string,
    mensagemId: string,
    statusConta: string,
  ): Promise<void> {
    this.logger.warn({ msg: 'dispatch_bloqueado_status_conta', tenantId, mensagemId, statusConta });
    await this.prisma.runInTenant(tenantId, async (tx) => {
      await tx.mensagem.updateMany({
        where: { id: mensagemId, status: { in: ['PENDENTE', 'ENFILEIRADA'] } },
        data: { status: 'CANCELADA', falhaMotivo: `Conta ${statusConta} — envio bloqueado.` },
      });
    });
  }
}

/**
 * Injeta o rodapé de descadastro antes do </body>. Todo email de campanha sai
 * com link de opt-out one-click visível (RULES 5.2 / LGPD), independente do
 * template do tenant usar {{opt_out_url}} ou não.
 */
function comRodapeOptOut(html: string, optOutUrl: string): string {
  const rodape =
    `<div style="max-width:600px;margin:16px auto 0;padding:12px 16px;text-align:center;` +
    `font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#64748B;">` +
    `Você recebeu este e-mail porque aceitou receber novidades. ` +
    `<a href="${optOutUrl}" style="color:#64748B;text-decoration:underline;">` +
    `Não quero mais receber estes e-mails</a>.</div>`;
  if (html.includes('</body>')) return html.replace('</body>', `${rodape}</body>`);
  return html + rodape;
}
