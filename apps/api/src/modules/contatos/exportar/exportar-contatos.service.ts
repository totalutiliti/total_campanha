import { Injectable } from '@nestjs/common';
import Papa from 'papaparse';

import { PrismaService } from '../../../common/prisma/prisma.service.js';

@Injectable()
export class ExportarContatosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gera CSV completo dos contatos do tenant (formato definido em SPECS seção 4).
   *
   * Itera em páginas de 500 para não carregar tudo na memória — para tenants
   * com >100k contatos isso ainda comporta, mas a partir daí faz sentido
   * mudar para streaming via Readable (futuro).
   */
  async gerarCsv(tenantId: string, incluirExcluidos = false): Promise<string> {
    const linhas: Array<Record<string, string>> = [];
    let cursor: string | undefined;

    while (true) {
      const lote = await this.prisma.runInTenant(tenantId, (tx) =>
        tx.contato.findMany({
          where: incluirExcluidos ? {} : { excluidoEm: null },
          take: 500,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
        }),
      );
      if (lote.length === 0) break;
      for (const c of lote) {
        linhas.push({
          nome: c.nome ?? '',
          email: c.email ?? '',
          telefone: c.telefoneE164 ?? '',
          tags: c.tags.join(';'),
          optInEmail: String(c.optInEmail),
          optInWhatsapp: String(c.optInWhatsapp),
          extras: JSON.stringify(c.extras ?? {}),
          createdAt: c.createdAt.toISOString(),
        });
      }
      cursor = lote[lote.length - 1].id;
    }

    return Papa.unparse(linhas, { quotes: true });
  }
}
