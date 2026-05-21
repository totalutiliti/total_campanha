import { Injectable } from '@nestjs/common';
import { Prisma } from '@total-campanha/db';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * UsageService — grava em `usage_log` toda chamada a serviço externo pago,
 * **no momento da chamada** (RULES 6.1). Nunca em batch.
 *
 * `usage_log` é tabela GLOBAL (sem RLS) — o tenantId é coluna comum mas não há
 * policy. Por isso usamos o PrismaService direto, sem runInTenant.
 *
 * Serviços conhecidos (string `servico`):
 *   - 'meta.whatsapp.marketing.br'  → ~R$ 0,25/msg
 *   - 'ses.email.send'              → ~R$ 0,0006/msg
 */
@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    tenantId: string,
    servico: string,
    custoEstimadoBrl: number,
    metadados: Prisma.InputJsonValue = {},
  ): Promise<void> {
    await this.prisma.usageLog.create({
      data: {
        tenantId,
        servico,
        custoEstimadoBrl: new Prisma.Decimal(custoEstimadoBrl),
        metadados,
      },
    });
  }
}

/**
 * Custos de referência (R$). Centralizado para o cálculo de estimativa
 * (CampanhasService) e o log real (worker) usarem o mesmo número.
 */
export const CUSTO_REFERENCIA = {
  whatsappMarketingBr: 0.25,
  sesEmailSend: 0.0006,
} as const;
