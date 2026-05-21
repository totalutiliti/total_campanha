import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@total-campanha/db';

import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CUSTO_REFERENCIA } from '../../common/usage/usage.service.js';
import { SegmentosService } from '../segmentos/segmentos.service.js';

import { AtualizarCampanhaDto } from './dto/atualizar-campanha.dto.js';
import { CriarCampanhaDto } from './dto/criar-campanha.dto.js';

type Canal = 'EMAIL' | 'WHATSAPP';

@Injectable()
export class CampanhasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly segmentos: SegmentosService,
  ) {}

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------
  async criar(tenantId: string, userId: string, dto: CriarCampanhaDto) {
    await this.validarSegmentoTemplate(tenantId, dto.segmentoId, dto.templateId, dto.canal);

    const campanha = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.campanha.create({
        data: {
          tenantId,
          nome: dto.nome,
          segmentoId: dto.segmentoId,
          templateId: dto.templateId,
          canal: dto.canal,
          status: 'RASCUNHO',
          agendadoPara: dto.agendadoPara ?? null,
          janelaEnvio: (dto.janelaEnvio as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      }),
    );
    await this.audit.log(tenantId, userId, 'campanha.criar', campanha.id, { nome: dto.nome });
    return campanha;
  }

  async listar(tenantId: string) {
    return this.prisma.runInTenant(tenantId, (tx) =>
      tx.campanha.findMany({ orderBy: { createdAt: 'desc' } }),
    );
  }

  async buscar(tenantId: string, id: string) {
    const c = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.campanha.findUnique({ where: { id } }),
    );
    if (!c) throw new NotFoundException('Campanha não encontrada.');
    return c;
  }

  async atualizar(tenantId: string, userId: string, id: string, dto: AtualizarCampanhaDto) {
    const campanha = await this.buscar(tenantId, id);
    if (campanha.status !== 'RASCUNHO') {
      throw new ConflictException('Só campanhas em RASCUNHO podem ser editadas.');
    }

    const segmentoId = dto.segmentoId ?? campanha.segmentoId;
    const templateId = dto.templateId ?? campanha.templateId;
    if (dto.segmentoId || dto.templateId) {
      await this.validarSegmentoTemplate(tenantId, segmentoId, templateId, campanha.canal as Canal);
    }

    const atualizada = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.campanha.update({
        where: { id },
        data: {
          ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
          ...(dto.segmentoId !== undefined ? { segmentoId: dto.segmentoId } : {}),
          ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
          ...(dto.agendadoPara !== undefined ? { agendadoPara: dto.agendadoPara } : {}),
          ...(dto.janelaEnvio !== undefined
            ? {
                janelaEnvio:
                  dto.janelaEnvio === null
                    ? Prisma.JsonNull
                    : (dto.janelaEnvio as Prisma.InputJsonValue),
              }
            : {}),
        },
      }),
    );
    await this.audit.log(tenantId, userId, 'campanha.atualizar', id, { campos: Object.keys(dto) });
    return atualizada;
  }

  async excluir(tenantId: string, userId: string, id: string): Promise<{ deletado: true }> {
    const campanha = await this.buscar(tenantId, id);
    if (campanha.status !== 'RASCUNHO' && campanha.status !== 'CANCELADA') {
      throw new ConflictException('Só campanhas RASCUNHO ou CANCELADA podem ser excluídas.');
    }
    await this.prisma.runInTenant(tenantId, async (tx) => {
      await tx.mensagem.deleteMany({ where: { campanhaId: id } });
      await tx.campanha.delete({ where: { id } });
    });
    await this.audit.log(tenantId, userId, 'campanha.excluir', id, {});
    return { deletado: true };
  }

  // -------------------------------------------------------------------------
  // Estimativa
  // -------------------------------------------------------------------------
  async calcularEstimativa(tenantId: string, id: string) {
    const campanha = await this.buscar(tenantId, id);
    const previsao = await this.segmentos.previsao(
      tenantId,
      campanha.segmentoId,
      campanha.canal as Canal,
    );
    const custoUnitario =
      campanha.canal === 'WHATSAPP'
        ? CUSTO_REFERENCIA.whatsappMarketingBr
        : CUSTO_REFERENCIA.sesEmailSend;
    const custoEstimadoBrl = Number((previsao.total * custoUnitario).toFixed(4));

    // Persiste a estimativa na campanha para exibir depois.
    await this.prisma.runInTenant(tenantId, (tx) =>
      tx.campanha.update({
        where: { id },
        data: {
          totalDestinatarios: previsao.total,
          custoEstimadoBrl: new Prisma.Decimal(custoEstimadoBrl),
        },
      }),
    );

    return {
      destinatarios: previsao.total,
      canal: campanha.canal,
      custoUnitarioBrl: custoUnitario,
      custoEstimadoBrl,
    };
  }

  // -------------------------------------------------------------------------
  // Lifecycle: pausar / cancelar
  // -------------------------------------------------------------------------
  async pausar(tenantId: string, userId: string, id: string) {
    const campanha = await this.buscar(tenantId, id);
    if (campanha.status !== 'DISPARANDO' && campanha.status !== 'AGENDADA') {
      throw new ConflictException('Só campanhas DISPARANDO ou AGENDADA podem ser pausadas.');
    }
    const r = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.campanha.update({ where: { id }, data: { status: 'PAUSADA' } }),
    );
    await this.audit.log(tenantId, userId, 'campanha.pausar', id, {});
    return r;
  }

  async cancelar(tenantId: string, userId: string, id: string) {
    const campanha = await this.buscar(tenantId, id);
    if (campanha.status === 'FINALIZADA' || campanha.status === 'CANCELADA') {
      throw new ConflictException('Campanha já está finalizada ou cancelada.');
    }
    const r = await this.prisma.runInTenant(tenantId, async (tx) => {
      // Cancela mensagens ainda não enviadas — o dispatch processor verifica
      // o status da campanha, mas marcamos aqui para o analytics ficar correto.
      await tx.mensagem.updateMany({
        where: { campanhaId: id, status: { in: ['PENDENTE', 'ENFILEIRADA'] } },
        data: { status: 'CANCELADA' },
      });
      return tx.campanha.update({
        where: { id },
        data: { status: 'CANCELADA', finalizadaEm: new Date() },
      });
    });
    await this.audit.log(tenantId, userId, 'campanha.cancelar', id, {});
    return r;
  }

  // -------------------------------------------------------------------------
  // Analytics (versão básica — Fase 6 traz timeline + materialized view)
  // -------------------------------------------------------------------------
  async analytics(tenantId: string, id: string) {
    const campanha = await this.buscar(tenantId, id);
    const porMotivo = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.mensagem.groupBy({
        by: ['falhaMotivo'],
        where: { campanhaId: id, status: 'FALHOU' },
        _count: { _all: true },
      }),
    );

    const enviadas = campanha.totalEnviados;
    const taxa = (n: number) => (enviadas > 0 ? Number((n / enviadas).toFixed(4)) : 0);

    return {
      campanhaId: id,
      status: campanha.status,
      totais: {
        destinatarios: campanha.totalDestinatarios,
        enviadas: campanha.totalEnviados,
        entregues: campanha.totalEntregues,
        lidas: campanha.totalLidos,
        respondidas: campanha.totalRespondidos,
        falhas: campanha.totalFalhas,
      },
      taxas: {
        entrega: taxa(campanha.totalEntregues),
        leitura: taxa(campanha.totalLidos),
        resposta: taxa(campanha.totalRespondidos),
        falha: taxa(campanha.totalFalhas),
      },
      custo: {
        estimadoBrl: campanha.custoEstimadoBrl?.toString() ?? null,
        realBrl: campanha.custoRealBrl?.toString() ?? null,
      },
      porMotivoFalha: porMotivo.map((m) => ({
        motivo: m.falhaMotivo ?? 'desconhecido',
        total: m._count._all,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private async validarSegmentoTemplate(
    tenantId: string,
    segmentoId: string,
    templateId: string,
    canal: Canal,
  ): Promise<void> {
    await this.prisma.runInTenant(tenantId, async (tx) => {
      const segmento = await tx.segmento.findUnique({ where: { id: segmentoId } });
      if (!segmento) throw new BadRequestException('Segmento não encontrado.');
      const template = await tx.template.findUnique({ where: { id: templateId } });
      if (!template) throw new BadRequestException('Template não encontrado.');
      if (template.canal !== canal) {
        throw new BadRequestException(
          `Template é do canal ${template.canal}, mas a campanha é ${canal}.`,
        );
      }
    });
  }
}
