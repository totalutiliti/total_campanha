import * as crypto from 'node:crypto';

import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@total-campanha/db';

import { env } from '../../config/config.module.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService, PrismaTx } from '../../common/prisma/prisma.service.js';

import { AtualizarContatoDto } from './dto/atualizar-contato.dto.js';
import { CriarContatoDto } from './dto/criar-contato.dto.js';
import { ListarContatosDto } from './dto/listar-contatos.dto.js';

@Injectable()
export class ContatosService {
  private readonly logger = new Logger(ContatosService.name);
  private readonly pepperAnonimizacao: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    // O hash de anonimização (LGPD) usa o AUTH_PEPPER para não precisar
    // gerenciar mais uma chave. É só estabilizar o hash entre execuções.
    this.pepperAnonimizacao = env(config, 'AUTH_PEPPER');
  }

  async criar(tenantId: string, userId: string, dto: CriarContatoDto) {
    const contato = await this.prisma.runInTenant(tenantId, async (tx) => {
      // Conflito por email ou telefone dentro do tenant.
      const existente = await tx.contato.findFirst({
        where: {
          OR: [
            ...(dto.email ? [{ email: dto.email }] : []),
            ...(dto.telefoneE164 ? [{ telefoneE164: dto.telefoneE164 }] : []),
          ],
        },
      });
      if (existente) {
        throw new ConflictException('Contato com este email ou telefone já existe.');
      }

      return tx.contato.create({
        data: {
          tenantId,
          nome: dto.nome,
          email: dto.email,
          telefoneE164: dto.telefoneE164,
          tags: dto.tags,
          extras: dto.extras as Prisma.InputJsonValue,
        },
      });
    });

    await this.audit.log(tenantId, userId, 'contato.criar', contato.id, {
      email: dto.email,
      telefoneE164: dto.telefoneE164,
    });
    return contato;
  }

  async listar(tenantId: string, query: ListarContatosDto) {
    const where: Prisma.ContatoWhereInput = {
      ...(query.incluirExcluidos ? {} : { excluidoEm: null }),
      ...(query.busca
        ? {
            OR: [
              { nome: { contains: query.busca, mode: 'insensitive' } },
              { email: { contains: query.busca, mode: 'insensitive' } },
              { telefoneE164: { contains: query.busca } },
            ],
          }
        : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.optInEmail !== undefined ? { optInEmail: query.optInEmail } : {}),
      ...(query.optInWhatsapp !== undefined ? { optInWhatsapp: query.optInWhatsapp } : {}),
    };

    const { itens, total } = await this.prisma.runInTenant(tenantId, async (tx) => {
      const [itens, total] = await Promise.all([
        tx.contato.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.pagina - 1) * query.porPagina,
          take: query.porPagina,
        }),
        tx.contato.count({ where }),
      ]);
      return { itens, total };
    });

    return {
      itens,
      paginacao: {
        pagina: query.pagina,
        porPagina: query.porPagina,
        total,
        totalPaginas: Math.ceil(total / query.porPagina),
      },
    };
  }

  async buscar(tenantId: string, id: string) {
    const contato = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.contato.findUnique({ where: { id } }),
    );
    if (!contato) throw new NotFoundException('Contato não encontrado.');
    return contato;
  }

  async atualizar(tenantId: string, userId: string, id: string, dto: AtualizarContatoDto) {
    const atualizado = await this.prisma.runInTenant(tenantId, async (tx) => {
      const existente = await tx.contato.findUnique({ where: { id } });
      if (!existente) return null;

      // Atualização via runInTenant + RLS garante que findUnique já filtrou por
      // tenant. Conflict-check para evitar trocar email/telefone para um valor
      // que já pertence a outro contato do mesmo tenant.
      if (dto.email && dto.email !== existente.email) {
        const collide = await tx.contato.findFirst({
          where: { email: dto.email, NOT: { id } },
        });
        if (collide) throw new ConflictException('Já existe contato com este email.');
      }
      if (dto.telefoneE164 && dto.telefoneE164 !== existente.telefoneE164) {
        const collide = await tx.contato.findFirst({
          where: { telefoneE164: dto.telefoneE164, NOT: { id } },
        });
        if (collide) throw new ConflictException('Já existe contato com este telefone.');
      }

      return tx.contato.update({
        where: { id },
        data: {
          ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.telefoneE164 !== undefined ? { telefoneE164: dto.telefoneE164 } : {}),
          ...(dto.tags !== undefined ? { tags: { set: dto.tags } } : {}),
          ...(dto.extras !== undefined ? { extras: dto.extras as Prisma.InputJsonValue } : {}),
          ...(dto.optInEmail !== undefined ? { optInEmail: dto.optInEmail } : {}),
          ...(dto.optInWhatsapp !== undefined ? { optInWhatsapp: dto.optInWhatsapp } : {}),
        },
      });
    });

    if (!atualizado) throw new NotFoundException('Contato não encontrado.');
    await this.audit.log(tenantId, userId, 'contato.atualizar', id, { campos: Object.keys(dto) });
    return atualizado;
  }

  /**
   * Soft delete por padrão. Quando `lgpd=true`, executa hard delete +
   * anonimização em `mensagens` (RULES 5.3).
   */
  async excluir(
    tenantId: string,
    userId: string,
    id: string,
    lgpd: boolean,
  ): Promise<{ deletado: true; modo: 'soft' | 'lgpd' }> {
    await this.prisma.runInTenant(tenantId, async (tx) => {
      const existente = await tx.contato.findUnique({ where: { id } });
      if (!existente) throw new NotFoundException('Contato não encontrado.');

      if (lgpd) {
        await this.executarLgpdHardDelete(tx, tenantId, existente);
      } else {
        await tx.contato.update({ where: { id }, data: { excluidoEm: new Date() } });
      }
    });

    await this.audit.log(tenantId, userId, 'contato.excluir', id, { modo: lgpd ? 'lgpd' : 'soft' });
    return { deletado: true, modo: lgpd ? 'lgpd' : 'soft' };
  }

  /**
   * Hard delete + anonimização (RULES 5.3):
   *   - `contatos`: DELETE.
   *   - `mensagens`: contatoId → NULL, destinatarioHash = sha256(canal, valor + pepper).
   *   - `opt_in_log`: registra OPT_OUT com origem `lgpd-direito-esquecimento`.
   */
  private async executarLgpdHardDelete(
    tx: PrismaTx,
    tenantId: string,
    contato: { id: string; email: string | null; telefoneE164: string | null },
  ): Promise<void> {
    const hashEmail =
      contato.email !== null
        ? this.hashDestinatario('EMAIL', contato.email)
        : null;
    const hashTel =
      contato.telefoneE164 !== null
        ? this.hashDestinatario('WHATSAPP', contato.telefoneE164)
        : null;

    // Anonimiza mensagens — uma query por canal para usar o hash correto.
    if (hashEmail) {
      await tx.mensagem.updateMany({
        where: { contatoId: contato.id, canal: 'EMAIL' },
        data: { contatoId: null, destinatarioHash: hashEmail },
      });
    }
    if (hashTel) {
      await tx.mensagem.updateMany({
        where: { contatoId: contato.id, canal: 'WHATSAPP' },
        data: { contatoId: null, destinatarioHash: hashTel },
      });
    }

    // opt_in_log é imutável (RULES 5.4) — só inserts.
    await tx.optInLog.create({
      data: {
        tenantId,
        contatoId: null,
        email: contato.email,
        telefoneE164: contato.telefoneE164,
        canal: contato.telefoneE164 ? 'WHATSAPP' : 'EMAIL',
        acao: 'OPT_OUT',
        ip: '0.0.0.0',
        userAgent: 'lgpd-direito-esquecimento',
        origem: 'lgpd-direito-esquecimento',
        versaoTermo: 'lgpd',
      },
    });

    await tx.contato.delete({ where: { id: contato.id } });
  }

  private hashDestinatario(canal: 'EMAIL' | 'WHATSAPP', valor: string): string {
    return crypto
      .createHash('sha256')
      .update(`${canal}|${valor.toLowerCase()}|${this.pepperAnonimizacao}`)
      .digest('hex');
  }
}
