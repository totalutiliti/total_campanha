import { Injectable } from '@nestjs/common';
import { Prisma } from '@total-campanha/db';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * AuditService — escreve em `audit_logs` (tabela tenant-scoped com RLS).
 *
 * Padrão de chamada:
 *   await this.audit.log(tenantId, userId, 'contato.criar', contato.id, { dto });
 *
 * Ação segue convenção `<recurso>.<verbo>` em snake_case dentro do recurso:
 *   contato.criar, contato.atualizar, contato.deletar, campanha.disparar, etc.
 *
 * `dados` é JSON livre — JAMAIS incluir tokens, senhas, ou PII bruta
 * (RULES 8.5). Em dúvida, registre apenas os IDs envolvidos.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    tenantId: string,
    userId: string | null,
    acao: string,
    recurso: string | null,
    dados: Prisma.InputJsonValue = {},
  ): Promise<void> {
    // O `audit_logs` tem RLS — precisa rodar dentro de runInTenant para a
    // policy `tenant_isolation` aceitar o INSERT.
    await this.prisma.runInTenant(tenantId, async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          acao,
          recurso,
          dados,
        },
      });
    });
  }
}
