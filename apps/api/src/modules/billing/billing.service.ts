import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AuditService } from '../../common/audit/audit.service.js';
import { AsaasClient } from '../../common/integrations/asaas.client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

type Plano = 'STARTER' | 'PRO' | 'ENTERPRISE';

/** Preço mensal por plano (R$). */
export const PRECO_PLANO: Record<Plano, number> = {
  STARTER: 97,
  PRO: 297,
  ENTERPRISE: 997,
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasClient,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Assinar — cria subscription no Asaas.
  // -------------------------------------------------------------------------
  async assinar(tenantId: string, userId: string, plano: Plano) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');
    if (tenant.asaasSubscriptionId) {
      throw new BadRequestException('Tenant já tem assinatura. Use atualizar-plano.');
    }

    const adminUt = await this.prisma.userTenant.findFirst({
      where: { tenantId, role: 'ADMIN' },
      include: { user: true },
    });

    const sub = await this.asaas.criarAssinatura({
      nomeCliente: tenant.razaoSocial,
      cpfCnpj: tenant.cnpj,
      email: adminUt?.user.email ?? 'sem-email@totalcampanha.dev',
      valorMensal: PRECO_PLANO[plano],
      descricao: `Total Campanha — plano ${plano}`,
    });

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plano, asaasSubscriptionId: sub.id },
    });
    await this.audit.log(tenantId, userId, 'billing.assinar', tenantId, { plano, asaasId: sub.id });

    return {
      plano,
      asaasSubscriptionId: sub.id,
      status: sub.status,
      valorMensalBrl: sub.valor,
      proximoVencimento: sub.proximoVencimento,
      linkPagamento: sub.linkPagamento,
    };
  }

  // -------------------------------------------------------------------------
  // Estado atual da assinatura.
  // -------------------------------------------------------------------------
  async atual(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    // Com assinatura mas sem pagamento confirmado (TRIAL/INADIMPLENTE), expõe
    // o link de pagamento para o admin regularizar direto da tela de Plano.
    let linkPagamento: string | null = null;
    if (tenant.asaasSubscriptionId && tenant.status !== 'ATIVO') {
      linkPagamento = await this.asaas.linkPagamento(tenant.asaasSubscriptionId);
    }

    return {
      plano: tenant.plano,
      status: tenant.status,
      valorMensalBrl: PRECO_PLANO[tenant.plano as Plano],
      trialAteEm: tenant.trialAteEm,
      temAssinatura: !!tenant.asaasSubscriptionId,
      linkPagamento,
    };
  }

  // -------------------------------------------------------------------------
  // Atualizar plano.
  // -------------------------------------------------------------------------
  async atualizarPlano(tenantId: string, userId: string, plano: Plano) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');
    if (plano === tenant.plano) {
      throw new BadRequestException('Tenant já está neste plano.');
    }

    if (tenant.asaasSubscriptionId) {
      await this.asaas.atualizarValor(tenant.asaasSubscriptionId, PRECO_PLANO[plano]);
    }
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { plano } });
    await this.audit.log(tenantId, userId, 'billing.atualizar_plano', tenantId, {
      de: tenant.plano,
      para: plano,
    });
    return { plano, valorMensalBrl: PRECO_PLANO[plano] };
  }

  // -------------------------------------------------------------------------
  // Cancelar.
  // -------------------------------------------------------------------------
  async cancelar(tenantId: string, userId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');
    if (tenant.asaasSubscriptionId) {
      await this.asaas.cancelar(tenant.asaasSubscriptionId);
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'CANCELADO', asaasSubscriptionId: null },
    });
    await this.audit.log(tenantId, userId, 'billing.cancelar', tenantId, {});
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Webhook Asaas — chamado pelo AsaasWebhookController.
  // -------------------------------------------------------------------------
  async processarWebhook(evento: string, asaasSubscriptionId: string | null): Promise<void> {
    if (!asaasSubscriptionId) return;
    const tenant = await this.prisma.tenant.findFirst({
      where: { asaasSubscriptionId },
    });
    if (!tenant) {
      this.logger.warn({ msg: 'asaas_webhook_tenant_nao_encontrado', asaasSubscriptionId });
      return;
    }

    const mapa: Record<string, 'ATIVO' | 'INADIMPLENTE' | 'CANCELADO'> = {
      PAYMENT_CONFIRMED: 'ATIVO',
      PAYMENT_RECEIVED: 'ATIVO',
      SUBSCRIPTION_OVERDUE: 'INADIMPLENTE',
      PAYMENT_OVERDUE: 'INADIMPLENTE',
      SUBSCRIPTION_CANCELLED: 'CANCELADO',
    };
    const novoStatus = mapa[evento];
    if (!novoStatus) {
      this.logger.debug({ msg: 'asaas_evento_ignorado', evento });
      return;
    }

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: novoStatus },
    });
    // audit_logs tem RLS — AuditService.log roda em runInTenant.
    await this.audit.log(tenant.id, null, 'billing.webhook', tenant.id, {
      evento,
      novoStatus,
    });
    this.logger.log({ msg: 'asaas_webhook', evento, tenantId: tenant.id, novoStatus });
  }
}
