import * as crypto from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@total-campanha/db';
import type { TierMeta } from '@total-campanha/shared';
import type { Queue } from 'bullmq';

import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { traduzirFiltrosParaWhere } from '../segmentos/filtros/traduz-filtros.js';
import type { Grupo } from '../segmentos/filtros/filtros-schema.js';

import {
  ajustarParaJanela,
  intervaloMsEmail,
  intervaloMsWhatsapp,
  JanelaEnvio,
} from './throttle.js';

interface DispatchJobData {
  mensagemId: string;
  tenantId: string;
  campanhaId: string;
}

const CHUNK = 500;

@Injectable()
export class CampanhasDispatchService {
  private readonly logger = new Logger(CampanhasDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectQueue('dispatch-email') private readonly filaEmail: Queue<DispatchJobData>,
    @InjectQueue('dispatch-whatsapp') private readonly filaWhatsapp: Queue<DispatchJobData>,
  ) {}

  /**
   * Dispara a campanha (BOOTSTRAP 5.1):
   *   1. valida status, conexão ativa, template.
   *   2. resolve o segmento → contatos com opt-in para o canal.
   *   3. cria registros Mensagem PENDENTE.
   *   4. enfileira jobs com delay calculado (throttle por tier + janela).
   *   5. move a campanha para AGENDADA ou DISPARANDO.
   */
  async disparar(
    tenantId: string,
    userId: string,
    campanhaId: string,
  ): Promise<{ status: string; mensagensCriadas: number }> {
    const ctx = await this.prepararDisparo(tenantId, campanhaId);
    const { campanha, contatos, intervaloMs } = ctx;

    if (contatos.length === 0) {
      throw new BadRequestException(
        'Nenhum contato com opt-in válido para este canal no segmento.',
      );
    }

    const agora = Date.now();
    const base = campanha.agendadoPara && campanha.agendadoPara.getTime() > agora
      ? campanha.agendadoPara.getTime()
      : agora;
    const janela = (campanha.janelaEnvio as JanelaEnvio | null) ?? null;

    // Monta as mensagens com UUID explícito para podermos enfileirar logo após.
    const mensagens = contatos.map((contato, i) => {
      const id = crypto.randomUUID();
      const instante = ajustarParaJanela(new Date(base + i * intervaloMs), janela);
      return {
        id,
        contatoId: contato.id,
        instante,
        delayMs: Math.max(0, instante.getTime() - agora),
      };
    });

    // Persiste Mensagens em chunks (createMany é eficiente; sem retorno de IDs,
    // por isso geramos os UUIDs em código).
    await this.prisma.runInTenant(tenantId, async (tx) => {
      for (let i = 0; i < mensagens.length; i += CHUNK) {
        const chunk = mensagens.slice(i, i + CHUNK);
        await tx.mensagem.createMany({
          data: chunk.map((m) => ({
            id: m.id,
            tenantId,
            campanhaId,
            contatoId: m.contatoId,
            canal: campanha.canal,
            status: 'ENFILEIRADA' as const,
            statusHistory: [
              { status: 'ENFILEIRADA', at: new Date().toISOString() },
            ] as Prisma.InputJsonValue,
          })),
        });
      }
    });

    // Enfileira jobs em addBulk (chunked).
    const fila = campanha.canal === 'WHATSAPP' ? this.filaWhatsapp : this.filaEmail;
    for (let i = 0; i < mensagens.length; i += CHUNK) {
      const chunk = mensagens.slice(i, i + CHUNK);
      await fila.addBulk(
        chunk.map((m) => ({
          name: 'enviar',
          data: { mensagemId: m.id, tenantId, campanhaId },
          opts: {
            delay: m.delayMs,
            attempts: 1, // retry é feito pelo RetryProcessor, não pelo BullMQ.
          },
        })),
      );
    }

    // Status: AGENDADA se o primeiro envio é no futuro, senão DISPARANDO.
    const novoStatus = mensagens[0].delayMs > 0 ? 'AGENDADA' : 'DISPARANDO';
    const atualizada = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.campanha.update({
        where: { id: campanhaId },
        data: {
          status: novoStatus,
          totalDestinatarios: mensagens.length,
          iniciadaEm: novoStatus === 'DISPARANDO' ? new Date() : null,
        },
      }),
    );

    await this.audit.log(tenantId, userId, 'campanha.disparar', campanhaId, {
      mensagensCriadas: mensagens.length,
      status: novoStatus,
      canal: campanha.canal,
    });

    this.logger.log({
      msg: 'campanha_disparada',
      tenantId,
      campanhaId,
      mensagens: mensagens.length,
      status: novoStatus,
    });

    return { status: atualizada.status, mensagensCriadas: mensagens.length };
  }

  // -------------------------------------------------------------------------
  // Preparação: validações + resolução do segmento.
  // -------------------------------------------------------------------------
  private async prepararDisparo(tenantId: string, campanhaId: string) {
    return this.prisma.runInTenant(tenantId, async (tx) => {
      const campanha = await tx.campanha.findUnique({ where: { id: campanhaId } });
      if (!campanha) throw new BadRequestException('Campanha não encontrada.');
      if (campanha.status !== 'RASCUNHO' && campanha.status !== 'PAUSADA') {
        throw new ConflictException(
          `Campanha em status ${campanha.status} não pode ser disparada.`,
        );
      }

      // Conexão ativa do canal.
      let intervaloMs: number;
      if (campanha.canal === 'WHATSAPP') {
        const conexao = await tx.conexaoWhatsapp.findUnique({ where: { tenantId } });
        if (!conexao || conexao.status !== 'ATIVA') {
          throw new BadRequestException('Conexão WhatsApp não está ATIVA.');
        }
        intervaloMs = intervaloMsWhatsapp(conexao.tierMeta as TierMeta);
      } else {
        const conexoes = await tx.conexaoEmail.findMany({ where: { status: 'ATIVA' } });
        if (conexoes.length === 0) {
          throw new BadRequestException('Nenhuma conexão de Email ATIVA.');
        }
        intervaloMs = intervaloMsEmail();
      }

      const template = await tx.template.findUnique({ where: { id: campanha.templateId } });
      if (!template) throw new BadRequestException('Template da campanha não existe mais.');

      const segmento = await tx.segmento.findUnique({ where: { id: campanha.segmentoId } });
      if (!segmento) throw new BadRequestException('Segmento da campanha não existe mais.');

      // Resolve contatos do segmento com opt-in válido para o canal.
      const baseWhere = traduzirFiltrosParaWhere(segmento.filtros as unknown as Grupo);
      const optInWhere =
        campanha.canal === 'EMAIL'
          ? { optInEmail: true, email: { not: null }, excluidoEm: null }
          : { optInWhatsapp: true, telefoneE164: { not: null }, excluidoEm: null };
      const contatos = await tx.contato.findMany({
        where: { AND: [baseWhere, optInWhere] },
        select: { id: true },
      });

      return { campanha, contatos, intervaloMs };
    });
  }
}
