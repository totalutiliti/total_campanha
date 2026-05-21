import { Injectable } from '@nestjs/common';
import { Prisma } from '@total-campanha/db';

import { PrismaService } from './prisma.service.js';

/**
 * Espelho do UsageService da API. `usage_log` é global (sem RLS).
 * Ver RULES 6.1 — log no momento da chamada paga.
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

export const CUSTO_REFERENCIA = {
  whatsappMarketingBr: 0.25,
  sesEmailSend: 0.0006,
} as const;
