import * as crypto from 'node:crypto';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Prisma } from '@total-campanha/db';
import type { Job } from 'bullmq';

import { CryptoService } from '../common/crypto.service.js';
import { PrismaService } from '../common/prisma.service.js';
import { resolverVariaveisWhatsapp } from '../common/render.js';
import { CUSTO_REFERENCIA } from '../common/usage.service.js';
import { MetaApiError, MetaWhatsappClient } from '../integrations/meta-whatsapp.client.js';

interface DispatchJob {
  mensagemId: string;
  tenantId: string;
  campanhaId: string;
}

/**
 * Códigos de erro Meta que tratamos com mensagem legível (BOOTSTRAP 5.2):
 *   131026 — mensagem indeliverable (número não tem WhatsApp / bloqueado)
 *   131047 — janela de 24h expirou (não aplica a template, mas mapeamos)
 *   131051 — tipo de mensagem não suportado
 */
const MOTIVOS_META: Record<number, string> = {
  131026: 'Número indisponível no WhatsApp ou mensagem não entregável',
  131047: 'Janela de 24h expirada',
  131051: 'Tipo de mensagem não suportado',
  131056: 'Limite de frequência atingido (rate limit)',
};

@Processor('dispatch-whatsapp', { concurrency: 5 })
export class DispatchWhatsappProcessor extends WorkerHost {
  private readonly logger = new Logger(DispatchWhatsappProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly metaClient: MetaWhatsappClient,
  ) {
    super();
  }

  async process(job: Job<DispatchJob>): Promise<void> {
    const { mensagemId, tenantId, campanhaId } = job.data;

    // Defesa em profundidade (RULES 6): tenant suspenso/inadimplente não envia
    // — cada mensagem WhatsApp custa dinheiro real na Meta.
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    if (!tenant || (tenant.status !== 'ATIVO' && tenant.status !== 'TRIAL')) {
      this.logger.warn({
        msg: 'dispatch_bloqueado_status_conta',
        tenantId,
        mensagemId,
        statusConta: tenant?.status ?? 'INEXISTENTE',
      });
      await this.prisma.runInTenant(tenantId, async (tx) => {
        await tx.mensagem.updateMany({
          where: { id: mensagemId, status: { in: ['PENDENTE', 'ENFILEIRADA'] } },
          data: {
            status: 'CANCELADA',
            falhaMotivo: `Conta ${tenant?.status ?? 'INEXISTENTE'} — envio bloqueado.`,
          },
        });
      });
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
      const conexao = await tx.conexaoWhatsapp.findUnique({ where: { tenantId } });
      return { mensagem, campanha, template, contato, conexao };
    });

    if (!ctx) return;
    const { template, contato, conexao } = ctx;

    if (!template || !template.metaTemplateName || !template.metaLanguage) {
      await this.marcarFalha(
        tenantId,
        mensagemId,
        campanhaId,
        claimToken,
        'Template WhatsApp incompleto',
        false,
      );
      return;
    }
    if (!contato || !contato.telefoneE164) {
      await this.marcarFalha(
        tenantId,
        mensagemId,
        campanhaId,
        claimToken,
        'Contato sem telefone',
        false,
      );
      return;
    }
    if (!contato.optInWhatsapp) {
      await this.marcarFalha(
        tenantId,
        mensagemId,
        campanhaId,
        claimToken,
        'Contato sem opt-in WhatsApp',
        false,
      );
      return;
    }
    if (!conexao || conexao.status !== 'ATIVA') {
      // Conexão caiu — retryable (admin pode reativar).
      await this.marcarFalha(
        tenantId,
        mensagemId,
        campanhaId,
        claimToken,
        'Conexão WhatsApp inativa',
        true,
      );
      return;
    }

    try {
      const token = await this.crypto.decryptToken(conexao.tokenEncrypted);
      const variaveis = resolverVariaveisWhatsapp(
        (template.variaveis as Array<{ key: string }>) ?? [],
        {
          nome: contato.nome,
          email: contato.email,
          telefoneE164: contato.telefoneE164,
          extras: (contato.extras as Record<string, unknown>) ?? {},
        },
      );

      const r = await this.metaClient.sendTemplate({
        token,
        phoneNumberId: conexao.phoneNumberId,
        to: contato.telefoneE164,
        templateName: template.metaTemplateName,
        language: template.metaLanguage,
        variables: variaveis,
      });
      const providerMessageId = r.messages[0]?.id;
      if (!providerMessageId) {
        throw new Error('Meta aceitou a requisição sem retornar o ID da mensagem.');
      }

      await this.prisma.runInTenant(tenantId, async (tx) => {
        const concluida = await tx.mensagem.updateMany({
          where: { id: mensagemId, status: 'PROCESSANDO', processamentoToken: claimToken },
          data: {
            status: 'ENVIADA',
            enviadaEm: new Date(),
            providerMessageId,
            processamentoToken: null,
            processamentoIniciadoEm: null,
            custoEstimadoBrl: new Prisma.Decimal(CUSTO_REFERENCIA.whatsappMarketingBr),
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
              servico: 'meta.whatsapp.marketing.br',
              custoEstimadoBrl: new Prisma.Decimal(CUSTO_REFERENCIA.whatsappMarketingBr),
              metadados: { mensagemId, campanhaId, providerMessageId },
            },
          });
        }
      });
    } catch (err) {
      if (err instanceof MetaApiError) {
        const motivo =
          (err.codigo !== undefined ? MOTIVOS_META[err.codigo] : undefined) ??
          `Meta erro ${err.codigo ?? err.status}`;
        await this.marcarFalha(
          tenantId,
          mensagemId,
          campanhaId,
          claimToken,
          motivo,
          err.retryable,
        );
      } else {
        this.logger.warn({ msg: 'dispatch_wa_erro_inesperado', mensagemId, err });
        await this.marcarIncerto(
          tenantId,
          mensagemId,
          campanhaId,
          claimToken,
          err instanceof Error ? err.message.slice(0, 200) : 'Erro',
        );
      }
    }
  }

  private async marcarFalha(
    tenantId: string,
    mensagemId: string,
    campanhaId: string,
    claimToken: string,
    motivo: string,
    retryable: boolean,
  ): Promise<void> {
    await this.prisma.runInTenant(tenantId, async (tx) => {
      const alterada = await tx.mensagem.updateMany({
        where: { id: mensagemId, status: 'PROCESSANDO', processamentoToken: claimToken },
        data: {
          status: 'FALHOU',
          falhaMotivo: motivo,
          processamentoToken: null,
          processamentoIniciadoEm: null,
          // O RetryProcessor lê `retryable` no statusHistory para decidir reenfileirar.
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
}
