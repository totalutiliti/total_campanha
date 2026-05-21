import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@total-campanha/db';

import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

import { AtualizarSegmentoDto } from './dto/atualizar-segmento.dto.js';
import { CriarSegmentoDto } from './dto/criar-segmento.dto.js';
import { Grupo } from './filtros/filtros-schema.js';
import { traduzirFiltrosParaWhere } from './filtros/traduz-filtros.js';

@Injectable()
export class SegmentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async criar(tenantId: string, userId: string, dto: CriarSegmentoDto) {
    const segmento = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.segmento.create({
        data: {
          tenantId,
          nome: dto.nome,
          filtros: dto.filtros as unknown as Prisma.InputJsonValue,
        },
      }),
    );
    await this.audit.log(tenantId, userId, 'segmento.criar', segmento.id, { nome: dto.nome });
    return segmento;
  }

  async listar(tenantId: string) {
    return this.prisma.runInTenant(tenantId, (tx) =>
      tx.segmento.findMany({ orderBy: { createdAt: 'desc' } }),
    );
  }

  async buscar(tenantId: string, id: string) {
    const s = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.segmento.findUnique({ where: { id } }),
    );
    if (!s) throw new NotFoundException('Segmento não encontrado.');
    return s;
  }

  async atualizar(tenantId: string, userId: string, id: string, dto: AtualizarSegmentoDto) {
    const atualizado = await this.prisma.runInTenant(tenantId, async (tx) => {
      const existe = await tx.segmento.findUnique({ where: { id } });
      if (!existe) return null;
      return tx.segmento.update({
        where: { id },
        data: {
          ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
          ...(dto.filtros !== undefined
            ? { filtros: dto.filtros as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });
    });
    if (!atualizado) throw new NotFoundException('Segmento não encontrado.');
    await this.audit.log(tenantId, userId, 'segmento.atualizar', id, { campos: Object.keys(dto) });
    return atualizado;
  }

  async excluir(tenantId: string, userId: string, id: string): Promise<{ deletado: true }> {
    const r = await this.prisma.runInTenant(tenantId, async (tx) =>
      tx.segmento.deleteMany({ where: { id } }),
    );
    if (r.count === 0) throw new NotFoundException('Segmento não encontrado.');
    await this.audit.log(tenantId, userId, 'segmento.excluir', id, {});
    return { deletado: true };
  }

  /**
   * Conta quantos contatos batem com o filtro do segmento (sem filtro de canal).
   */
  async contar(tenantId: string, id: string): Promise<{ total: number }> {
    const segmento = await this.buscar(tenantId, id);
    const where = traduzirFiltrosParaWhere(segmento.filtros as unknown as Grupo);
    const total = await this.prisma.runInTenant(tenantId, (tx) => tx.contato.count({ where }));
    return { total };
  }

  /**
   * Previsão de envio: count com opt-in válido para o canal.
   *
   * Esta é a contagem que o frontend mostra antes de "Disparar" — combina
   * o filtro do segmento com `optInEmail=true` ou `optInWhatsapp=true`.
   */
  async previsao(
    tenantId: string,
    id: string,
    canal: 'EMAIL' | 'WHATSAPP',
  ): Promise<{ total: number; canal: 'EMAIL' | 'WHATSAPP' }> {
    const segmento = await this.buscar(tenantId, id);
    const baseWhere = traduzirFiltrosParaWhere(segmento.filtros as unknown as Grupo);
    const where: Prisma.ContatoWhereInput = {
      AND: [
        baseWhere,
        canal === 'EMAIL'
          ? { optInEmail: true, email: { not: null } }
          : { optInWhatsapp: true, telefoneE164: { not: null } },
      ],
    };
    const total = await this.prisma.runInTenant(tenantId, (tx) => tx.contato.count({ where }));
    return { total, canal };
  }

  /**
   * Lista os contatos que batem com o filtro do segmento. Paginado.
   */
  async listarContatos(
    tenantId: string,
    id: string,
    pagina: number,
    porPagina: number,
  ) {
    const segmento = await this.buscar(tenantId, id);
    const where = traduzirFiltrosParaWhere(segmento.filtros as unknown as Grupo);
    const { itens, total } = await this.prisma.runInTenant(tenantId, async (tx) => {
      const [itens, total] = await Promise.all([
        tx.contato.findMany({
          where,
          skip: (pagina - 1) * porPagina,
          take: porPagina,
          orderBy: { createdAt: 'desc' },
        }),
        tx.contato.count({ where }),
      ]);
      return { itens, total };
    });
    return {
      itens,
      paginacao: { pagina, porPagina, total, totalPaginas: Math.ceil(total / porPagina) },
    };
  }

  /**
   * Previa sem persistir — usado pelo FiltroBuilder ao vivo.
   */
  async previaAdHoc(
    tenantId: string,
    filtros: Grupo,
    canal?: 'EMAIL' | 'WHATSAPP',
  ): Promise<{ total: number }> {
    const baseWhere = traduzirFiltrosParaWhere(filtros);
    const where: Prisma.ContatoWhereInput = canal
      ? {
          AND: [
            baseWhere,
            canal === 'EMAIL'
              ? { optInEmail: true, email: { not: null } }
              : { optInWhatsapp: true, telefoneE164: { not: null } },
          ],
        }
      : baseWhere;
    const total = await this.prisma.runInTenant(tenantId, (tx) => tx.contato.count({ where }));
    return { total };
  }
}
