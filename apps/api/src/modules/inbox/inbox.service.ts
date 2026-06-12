import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';

import { AuditService } from '../../common/audit/audit.service.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { MetaWhatsappClient } from '../../common/integrations/meta-whatsapp.client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly metaClient: MetaWhatsappClient,
    private readonly audit: AuditService,
  ) {}

  /**
   * Lista conversas, opcionalmente filtrando por status (aberta/fechada).
   * Enriquece com nome/telefone do contato e a última mensagem — é o que a
   * tela de Respostas mostra na lista.
   */
  async listarConversas(tenantId: string, status?: string) {
    return this.prisma.runInTenant(tenantId, async (tx) => {
      const conversas = await tx.inboxConversa.findMany({
        where: status ? { status } : {},
        orderBy: { ultimoMsgAt: 'desc' },
        take: 200,
      });
      if (conversas.length === 0) return [];

      const contatos = await tx.contato.findMany({
        where: { id: { in: conversas.map((c) => c.contatoId) } },
        select: { id: true, nome: true, telefoneE164: true },
      });
      const porId = new Map(contatos.map((c) => [c.id, c]));

      const previas = await Promise.all(
        conversas.map((c) =>
          tx.inboxMensagem.findFirst({
            where: { conversaId: c.id },
            orderBy: { createdAt: 'desc' },
            select: { conteudo: true, direcao: true },
          }),
        ),
      );

      return conversas.map((c, i) => ({
        ...c,
        contato: porId.get(c.contatoId) ?? null,
        ultimaMensagem: previas[i],
      }));
    });
  }

  async listarMensagens(tenantId: string, conversaId: string) {
    return this.prisma.runInTenant(tenantId, async (tx) => {
      const conversa = await tx.inboxConversa.findUnique({ where: { id: conversaId } });
      if (!conversa) throw new NotFoundException('Conversa não encontrada.');
      const contato = await tx.contato.findUnique({
        where: { id: conversa.contatoId },
        select: { id: true, nome: true, telefoneE164: true },
      });
      const mensagens = await tx.inboxMensagem.findMany({
        where: { conversaId },
        orderBy: { createdAt: 'asc' },
      });
      return { conversa: { ...conversa, contato }, mensagens };
    });
  }

  /**
   * Responde uma conversa com texto livre.
   *
   * Só permitido DENTRO da janela de 24h (RULES — política Meta). Fora dela,
   * o tenant precisa usar um template aprovado (não suportado neste endpoint).
   */
  async responder(
    tenantId: string,
    userId: string,
    conversaId: string,
    conteudo: string,
  ): Promise<{ ok: true }> {
    const dados = await this.prisma.runInTenant(tenantId, async (tx) => {
      const conversa = await tx.inboxConversa.findUnique({ where: { id: conversaId } });
      if (!conversa) throw new NotFoundException('Conversa não encontrada.');

      if (conversa.janela24hExpiraEm.getTime() <= Date.now()) {
        throw new PreconditionFailedException(
          'Janela de 24h expirada — só é possível responder com um template aprovado.',
        );
      }

      const contato = await tx.contato.findUnique({ where: { id: conversa.contatoId } });
      if (!contato || !contato.telefoneE164) {
        throw new BadRequestException('Contato sem telefone.');
      }

      const conexao = await tx.conexaoWhatsapp.findUnique({ where: { tenantId } });
      if (!conexao || conexao.status !== 'ATIVA') {
        throw new BadRequestException('Conexão WhatsApp não está ATIVA.');
      }

      return { conversa, contato, conexao };
    });

    const token = await this.crypto.decryptToken(dados.conexao.tokenEncrypted);
    await this.metaClient.sendText({
      token,
      phoneNumberId: dados.conexao.phoneNumberId,
      to: dados.contato.telefoneE164 as string,
      texto: conteudo,
    });

    await this.prisma.runInTenant(tenantId, async (tx) => {
      await tx.inboxMensagem.create({
        data: { tenantId, conversaId, direcao: 'out', conteudo },
      });
      await tx.inboxConversa.update({
        where: { id: conversaId },
        data: { ultimoMsgAt: new Date() },
      });
    });

    await this.audit.log(tenantId, userId, 'inbox.responder', conversaId, {
      tamanho: conteudo.length,
    });
    return { ok: true };
  }
}
