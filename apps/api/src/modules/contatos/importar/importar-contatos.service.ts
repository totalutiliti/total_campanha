import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma } from '@total-campanha/db';
import type { Queue } from 'bullmq';

import { env } from '../../../config/config.module.js';
import { AuditService } from '../../../common/audit/audit.service.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';

import { parsearCsvContatos, ResultadoParse } from './parser-csv.js';

export interface ImportacaoModo {
  modo: 'upsert' | 'ignorar';
  optInEmail: boolean;
  optInWhatsapp: boolean;
}

export interface ResultadoImportacaoSync {
  modo: 'sync';
  totalLido: number;
  importados: number;
  ignorados: number;
  invalidos: number;
  invalidas: ResultadoParse['invalidas'];
}

export interface ResultadoImportacaoAsync {
  modo: 'async';
  jobId: string;
  totalLido: number;
}

export type ResultadoImportacao = ResultadoImportacaoSync | ResultadoImportacaoAsync;

@Injectable()
export class ImportarContatosService {
  private readonly logger = new Logger(ImportarContatosService.name);
  private readonly syncLimite: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectQueue('contatos-importar') private readonly fila: Queue,
  ) {
    this.syncLimite = env(config, 'CONTATOS_IMPORTAR_SYNC_LIMITE');
  }

  async importar(
    tenantId: string,
    userId: string,
    conteudoUtf8: string,
    opts: ImportacaoModo,
  ): Promise<ResultadoImportacao> {
    const parsed = parsearCsvContatos(conteudoUtf8);

    // Imports grandes vão para fila — devolvemos jobId para o cliente acompanhar.
    if (parsed.validas.length > this.syncLimite) {
      const job = await this.fila.add('processar', {
        tenantId,
        userId,
        validas: parsed.validas,
        opts,
      });
      return {
        modo: 'async',
        jobId: String(job.id),
        totalLido: parsed.totalLido,
      };
    }

    // Processa síncrono em uma transação por tenant.
    const { importados, ignorados } = await this.prisma.runInTenant(tenantId, async (tx) => {
      let imp = 0;
      let ign = 0;
      for (const linha of parsed.validas) {
        const upserted = await aplicarLinha(tx, tenantId, linha, opts);
        if (upserted) imp += 1;
        else ign += 1;
      }
      return { importados: imp, ignorados: ign };
    });

    await this.audit.log(tenantId, userId, 'contato.importar', null, {
      totalLido: parsed.totalLido,
      importados,
      ignorados,
      invalidos: parsed.invalidas.length,
      modo: opts.modo,
    });

    return {
      modo: 'sync',
      totalLido: parsed.totalLido,
      importados,
      ignorados,
      invalidos: parsed.invalidas.length,
      invalidas: parsed.invalidas,
    };
  }
}

/**
 * Aplica uma linha respeitando o modo (`upsert` ou `ignorar` duplicatas).
 * Retorna `true` se inseriu/atualizou; `false` se ignorou.
 *
 * Duplicata = mesmo email OU mesmo telefoneE164 dentro do tenant
 * (uniqueness garantido por índice composto `(tenant_id, email)` e
 * `(tenant_id, telefone_e164)`).
 *
 * Export como função pura para o worker reaproveitar.
 */
export async function aplicarLinha(
  tx: Pick<PrismaService, 'contato'>,
  tenantId: string,
  linha: {
    nome: string | null;
    email: string | null;
    telefoneE164: string | null;
    tags: string[];
    extras: Record<string, unknown>;
  },
  opts: ImportacaoModo,
): Promise<boolean> {
  const existente = await tx.contato.findFirst({
    where: {
      tenantId,
      OR: [
        ...(linha.email ? [{ email: linha.email }] : []),
        ...(linha.telefoneE164 ? [{ telefoneE164: linha.telefoneE164 }] : []),
      ],
    },
  });

  if (existente) {
    if (opts.modo === 'ignorar') return false;
    await tx.contato.update({
      where: { id: existente.id },
      data: {
        nome: linha.nome ?? existente.nome,
        email: linha.email ?? existente.email,
        telefoneE164: linha.telefoneE164 ?? existente.telefoneE164,
        tags: { set: dedupe([...existente.tags, ...linha.tags]) },
        extras: mesclarExtras(existente.extras, linha.extras),
        optInEmail: opts.optInEmail || existente.optInEmail,
        optInWhatsapp: opts.optInWhatsapp || existente.optInWhatsapp,
      },
    });
    return true;
  }

  await tx.contato.create({
    data: {
      tenantId,
      nome: linha.nome,
      email: linha.email,
      telefoneE164: linha.telefoneE164,
      tags: linha.tags,
      extras: linha.extras as Prisma.InputJsonValue,
      optInEmail: opts.optInEmail,
      optInWhatsapp: opts.optInWhatsapp,
    },
  });
  return true;
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function mesclarExtras(
  atual: Prisma.JsonValue | null,
  novo: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base = atual && typeof atual === 'object' && !Array.isArray(atual) ? atual : {};
  return { ...(base as Record<string, unknown>), ...novo } as Prisma.InputJsonValue;
}
