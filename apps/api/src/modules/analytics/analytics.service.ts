import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dashboard do tenant — visão dos últimos 30 dias.
   *
   * MVP: agregações live (sem materialized view). Para volumes grandes,
   * migrar para MV + refresh 5min (BOOTSTRAP 6.3 — débito registrado).
   */
  async dashboard(tenantId: string) {
    const desde = new Date(Date.now() - 30 * 86_400_000);

    return this.prisma.runInTenant(tenantId, async (tx) => {
      const [campanhas, contatos, mensagens30d, custo30d] = await Promise.all([
        tx.campanha.count(),
        tx.contato.count({ where: { excluidoEm: null } }),
        tx.mensagem.groupBy({
          by: ['status'],
          where: { enviadaEm: { gte: desde } },
          _count: { _all: true },
        }),
        // usage_log é global — agregado aqui por tenantId direto.
        this.prisma.usageLog.aggregate({
          where: { tenantId, createdAt: { gte: desde } },
          _sum: { custoEstimadoBrl: true },
        }),
      ]);

      const porStatus: Record<string, number> = {};
      for (const m of mensagens30d) porStatus[m.status] = m._count._all;

      const optInEmail = await tx.contato.count({
        where: { excluidoEm: null, optInEmail: true },
      });
      const optInWhatsapp = await tx.contato.count({
        where: { excluidoEm: null, optInWhatsapp: true },
      });

      return {
        periodo: { desde, ate: new Date() },
        campanhas,
        contatos: {
          total: contatos,
          optInEmail,
          optInWhatsapp,
        },
        mensagens30d: porStatus,
        custo30dBrl: Number(custo30d._sum.custoEstimadoBrl ?? 0),
      };
    });
  }

  /**
   * Comparativo entre campanhas — métricas lado a lado.
   */
  async comparativo(tenantId: string, campanhaIds: string[]) {
    if (campanhaIds.length === 0) return { campanhas: [] };

    const campanhas = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.campanha.findMany({ where: { id: { in: campanhaIds } } }),
    );

    const taxa = (n: number, base: number) =>
      base > 0 ? Number((n / base).toFixed(4)) : 0;

    return {
      campanhas: campanhas.map((c) => ({
        id: c.id,
        nome: c.nome,
        canal: c.canal,
        status: c.status,
        destinatarios: c.totalDestinatarios,
        enviadas: c.totalEnviados,
        entregues: c.totalEntregues,
        lidas: c.totalLidos,
        respondidas: c.totalRespondidos,
        falhas: c.totalFalhas,
        taxaEntrega: taxa(c.totalEntregues, c.totalEnviados),
        taxaLeitura: taxa(c.totalLidos, c.totalEnviados),
        taxaResposta: taxa(c.totalRespondidos, c.totalEnviados),
        custoEstimadoBrl: c.custoEstimadoBrl?.toString() ?? null,
      })),
    };
  }
}
