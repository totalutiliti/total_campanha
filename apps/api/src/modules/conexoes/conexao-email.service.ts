import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../../common/audit/audit.service.js';
import {
  RegistroDns,
  SesIdentityClient,
} from '../../common/integrations/ses-identity.client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

import { CriarConexaoEmailDto } from './dto/criar-conexao-email.dto.js';

export interface ConexaoEmailPublica {
  id: string;
  dominio: string;
  remetente: string;
  status: string;
  dkimStatus: string;
  spfStatus: string;
  registrosDns: RegistroDns[];
  createdAt: Date;
}

@Injectable()
export class ConexaoEmailService {
  private readonly logger = new Logger(ConexaoEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ses: SesIdentityClient,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------
  async criar(
    tenantId: string,
    userId: string,
    dto: CriarConexaoEmailDto,
  ): Promise<ConexaoEmailPublica> {
    // Garante remetente dentro do domínio.
    if (!dto.remetente.endsWith(`@${dto.dominio}`)) {
      throw new BadRequestException(
        `O remetente (${dto.remetente}) deve usar o domínio ${dto.dominio}.`,
      );
    }

    const existente = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoEmail.findUnique({ where: { tenantId_dominio: { tenantId, dominio: dto.dominio } } }),
    );
    if (existente) {
      throw new ConflictException('Já existe conexão de email para este domínio neste tenant.');
    }

    const resultado = await this.ses.criarIdentidadeDominio(dto.dominio, dto.remetente);

    const conexao = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoEmail.create({
        data: {
          tenantId,
          dominio: dto.dominio,
          remetente: dto.remetente,
          dkimStatus: resultado.dkimStatus.toLowerCase(),
          spfStatus: resultado.spfStatus.toLowerCase(),
          status: resultado.status === 'verificada' ? 'ATIVA' : 'PENDENTE_VERIFICACAO',
        },
      }),
    );

    await this.audit.log(tenantId, userId, 'conexao_email.criar', conexao.id, {
      dominio: dto.dominio,
      remetente: dto.remetente,
      modoStub: this.ses.modoStub,
    });

    return {
      ...this.toPublica(conexao),
      registrosDns: resultado.registrosDns,
    };
  }

  // -------------------------------------------------------------------------
  // READ — lista todas as conexões do tenant (pode ter múltiplos domínios)
  // -------------------------------------------------------------------------
  async listar(tenantId: string): Promise<ConexaoEmailPublica[]> {
    const conexoes = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoEmail.findMany({ orderBy: { createdAt: 'desc' } }),
    );
    return conexoes.map((c) => ({ ...this.toPublica(c), registrosDns: [] }));
  }

  // -------------------------------------------------------------------------
  // VERIFY — força reverificação contra SES
  // -------------------------------------------------------------------------
  async verificar(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<ConexaoEmailPublica> {
    const conexao = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoEmail.findUnique({ where: { id } }),
    );
    if (!conexao) throw new NotFoundException('Conexão de email não encontrada.');

    const r = await this.ses.verificarIdentidade(conexao.dominio);
    const novoStatus =
      r.status === 'verificada'
        ? 'ATIVA'
        : r.status === 'falha'
          ? 'ERRO'
          : 'PENDENTE_VERIFICACAO';

    const atualizada = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoEmail.update({
        where: { id },
        data: {
          status: novoStatus,
          dkimStatus: r.dkimStatus.toLowerCase(),
        },
      }),
    );

    await this.audit.log(tenantId, userId, 'conexao_email.verificar', id, {
      novoStatus,
      dkimStatus: r.dkimStatus,
    });

    return { ...this.toPublica(atualizada), registrosDns: [] };
  }

  // -------------------------------------------------------------------------
  // DELETE
  // -------------------------------------------------------------------------
  async excluir(tenantId: string, userId: string, id: string): Promise<{ deletado: true }> {
    const conexao = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoEmail.findUnique({ where: { id } }),
    );
    if (!conexao) throw new NotFoundException('Conexão de email não encontrada.');

    await this.ses.excluirIdentidade(conexao.dominio);
    await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoEmail.delete({ where: { id } }),
    );

    await this.audit.log(tenantId, userId, 'conexao_email.excluir', id, {
      dominio: conexao.dominio,
    });
    return { deletado: true };
  }

  // -------------------------------------------------------------------------
  private toPublica(c: {
    id: string;
    dominio: string;
    remetente: string;
    status: string;
    dkimStatus: string;
    spfStatus: string;
    createdAt: Date;
  }): Omit<ConexaoEmailPublica, 'registrosDns'> {
    return {
      id: c.id,
      dominio: c.dominio,
      remetente: c.remetente,
      status: c.status,
      dkimStatus: c.dkimStatus,
      spfStatus: c.spfStatus,
      createdAt: c.createdAt,
    };
  }
}
