import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Prisma } from '@total-campanha/db';
import type { Job } from 'bullmq';
import { normalizarTelefoneE164 } from '@total-campanha/shared';

import { PrismaService } from '../common/prisma.service.js';

interface ImportarContatosJob {
  tenantId: string;
  userId: string;
  validas: Array<{
    nome: string | null;
    email: string | null;
    telefoneE164: string | null;
    tags: string[];
    extras: Record<string, unknown>;
  }>;
  opts: { modo: 'upsert' | 'ignorar'; optInEmail: boolean; optInWhatsapp: boolean };
}

interface ImportarContatosResultado {
  importados: number;
  ignorados: number;
  total: number;
}

@Processor('contatos-importar', { concurrency: 2 })
export class ImportarContatosProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportarContatosProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ImportarContatosJob>): Promise<ImportarContatosResultado> {
    const { tenantId, userId, validas, opts } = job.data;
    this.logger.log({ msg: 'importar_start', tenantId, userId, total: validas.length });

    // Processa em chunks de 200 para não travar o event loop nem manter
    // uma transação gigante no Postgres.
    const CHUNK = 200;
    let importados = 0;
    let ignorados = 0;

    for (let i = 0; i < validas.length; i += CHUNK) {
      const chunk = validas.slice(i, i + CHUNK);
      const r = await this.prisma.runInTenant(tenantId, async (tx) => {
        let imp = 0;
        let ign = 0;
        for (const linha of chunk) {
          // Garante normalização (defesa em profundidade — o parser já fez).
          const telefoneE164 = linha.telefoneE164
            ? normalizarTelefoneE164(linha.telefoneE164)
            : null;

          const existente = await tx.contato.findFirst({
            where: {
              OR: [
                ...(linha.email ? [{ email: linha.email }] : []),
                ...(telefoneE164 ? [{ telefoneE164 }] : []),
              ],
            },
          });

          if (existente) {
            if (opts.modo === 'ignorar') {
              ign += 1;
              continue;
            }
            await tx.contato.update({
              where: { id: existente.id },
              data: {
                nome: linha.nome ?? existente.nome,
                email: linha.email ?? existente.email,
                telefoneE164: telefoneE164 ?? existente.telefoneE164,
                tags: { set: Array.from(new Set([...existente.tags, ...linha.tags])) },
                extras: {
                  ...((existente.extras as Record<string, unknown>) ?? {}),
                  ...linha.extras,
                } as Prisma.InputJsonValue,
                optInEmail: opts.optInEmail || existente.optInEmail,
                optInWhatsapp: opts.optInWhatsapp || existente.optInWhatsapp,
              },
            });
            imp += 1;
          } else {
            await tx.contato.create({
              data: {
                tenantId,
                nome: linha.nome,
                email: linha.email,
                telefoneE164,
                tags: linha.tags,
                extras: linha.extras as Prisma.InputJsonValue,
                optInEmail: opts.optInEmail,
                optInWhatsapp: opts.optInWhatsapp,
              },
            });
            imp += 1;
          }
        }
        return { imp, ign };
      });

      importados += r.imp;
      ignorados += r.ign;

      const processados = Math.min(i + CHUNK, validas.length);
      await job.updateProgress(Math.round((processados / validas.length) * 100));
    }

    // Auditoria — `audit_logs` é tenant-scoped (precisa runInTenant).
    await this.prisma.runInTenant(tenantId, async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          acao: 'contato.importar.async',
          recurso: null,
          dados: { importados, ignorados, total: validas.length, modo: opts.modo },
        },
      });
    });

    this.logger.log({ msg: 'importar_done', tenantId, importados, ignorados });
    return { importados, ignorados, total: validas.length };
  }
}
