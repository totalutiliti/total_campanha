import * as crypto from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { env } from '../../config/config.module.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import {
  MetaApiError,
  MetaWhatsappClient,
} from '../../common/integrations/meta-whatsapp.client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

import { AtualizarConexaoWhatsappDto } from './dto/atualizar-conexao-whatsapp.dto.js';
import { CriarConexaoWhatsappDto } from './dto/criar-conexao-whatsapp.dto.js';

/**
 * Resposta retornada ao tenant após criar/atualizar — inclui webhook URL e
 * secret para ele configurar na Meta Business Manager dele.
 */
export interface ConexaoWhatsappPublica {
  id: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  status: string;
  tierMeta: string;
  qualityRating: string | null;
  webhook: { url: string; secret: string };
  ultimoTeste: Date | null;
}

@Injectable()
export class ConexaoWhatsappService {
  private readonly logger = new Logger(ConexaoWhatsappService.name);
  private readonly webhookBaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly metaClient: MetaWhatsappClient,
    private readonly audit: AuditService,
  ) {
    this.webhookBaseUrl = env(config, 'WEBHOOK_META_BASE_URL');
  }

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------
  async criar(
    tenantId: string,
    userId: string,
    dto: CriarConexaoWhatsappDto,
  ): Promise<ConexaoWhatsappPublica> {
    // Já existe conexão para este tenant? Schema garante 1 por tenant (@@unique(tenantId)).
    const existente = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoWhatsapp.findUnique({ where: { tenantId } }),
    );
    if (existente) {
      throw new ConflictException(
        'Já existe uma conexão WhatsApp neste tenant. Use PATCH para atualizar ou DELETE primeiro.',
      );
    }

    // RULES 4.3 — chama Meta GET phone_number ANTES de salvar.
    const info = await this.validarTokenContraMeta(dto.token, dto.phoneNumberId);

    const tokenEncrypted = await this.crypto.encryptToken(dto.token);
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    const conexao = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoWhatsapp.create({
        data: {
          tenantId,
          wabaId: dto.wabaId,
          phoneNumberId: dto.phoneNumberId,
          tokenEncrypted,
          webhookSecret,
          status: 'ATIVA',
          qualityRating: info.qualityRating ?? null,
          ultimoTeste: new Date(),
        },
      }),
    );

    await this.audit.log(tenantId, userId, 'conexao_whatsapp.criar', conexao.id, {
      wabaId: dto.wabaId,
      phoneNumberId: dto.phoneNumberId,
      displayPhoneNumber: info.displayPhoneNumber,
    });

    return this.materializarPublica(conexao, tenant.slug, info.displayPhoneNumber);
  }

  // -------------------------------------------------------------------------
  // READ
  // -------------------------------------------------------------------------
  async buscar(tenantId: string): Promise<ConexaoWhatsappPublica> {
    const conexao = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoWhatsapp.findUnique({ where: { tenantId } }),
    );
    if (!conexao) throw new NotFoundException('Conexão WhatsApp não configurada.');
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    // displayPhoneNumber não está persistido — buscamos sob demanda se a
    // conexão está ATIVA. Caso a chamada falhe, retornamos vazio.
    let displayPhoneNumber = '';
    if (conexao.status === 'ATIVA') {
      try {
        const token = await this.crypto.decryptToken(conexao.tokenEncrypted);
        const info = await this.metaClient.getPhoneNumber(token, conexao.phoneNumberId);
        displayPhoneNumber = info.displayPhoneNumber;
      } catch (err) {
        this.logger.warn({ msg: 'buscar_display_falhou', err });
      }
    }

    return this.materializarPublica(conexao, tenant?.slug ?? '', displayPhoneNumber);
  }

  // -------------------------------------------------------------------------
  // PATCH (atualizar token)
  // -------------------------------------------------------------------------
  async atualizar(
    tenantId: string,
    userId: string,
    dto: AtualizarConexaoWhatsappDto,
  ): Promise<ConexaoWhatsappPublica> {
    const conexao = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoWhatsapp.findUnique({ where: { tenantId } }),
    );
    if (!conexao) throw new NotFoundException('Conexão WhatsApp não configurada.');

    // Valida o novo token contra Meta antes de persistir (RULES 4.3).
    const info = await this.validarTokenContraMeta(dto.token, conexao.phoneNumberId);
    const tokenEncrypted = await this.crypto.encryptToken(dto.token);

    const atualizada = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoWhatsapp.update({
        where: { tenantId },
        data: {
          tokenEncrypted,
          status: 'ATIVA',
          qualityRating: info.qualityRating ?? null,
          ultimoTeste: new Date(),
        },
      }),
    );

    await this.audit.log(tenantId, userId, 'conexao_whatsapp.atualizar', atualizada.id, {
      qualityRating: info.qualityRating,
    });

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return this.materializarPublica(atualizada, tenant?.slug ?? '', info.displayPhoneNumber);
  }

  // -------------------------------------------------------------------------
  // DELETE (soft — muda status para SUSPENSA e zera token criptografado)
  // -------------------------------------------------------------------------
  async excluir(tenantId: string, userId: string): Promise<{ deletado: true }> {
    const conexao = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoWhatsapp.findUnique({ where: { tenantId } }),
    );
    if (!conexao) throw new NotFoundException('Conexão WhatsApp não configurada.');

    // Soft delete: marca SUSPENSA + sobrescreve token cifrado com bytes nulos.
    // Não fazemos hard delete pois há referências em audit_logs/usage_logs.
    await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoWhatsapp.update({
        where: { tenantId },
        data: { status: 'SUSPENSA', tokenEncrypted: Buffer.alloc(0) },
      }),
    );

    await this.audit.log(tenantId, userId, 'conexao_whatsapp.excluir', conexao.id, {});
    return { deletado: true };
  }

  // -------------------------------------------------------------------------
  // POST /testar — refaz GET phone_number, atualiza ultimoTeste + qualityRating.
  // -------------------------------------------------------------------------
  async testar(
    tenantId: string,
    userId: string,
  ): Promise<{ ok: true; displayPhoneNumber: string; qualityRating: string | null }> {
    const conexao = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoWhatsapp.findUnique({ where: { tenantId } }),
    );
    if (!conexao) throw new NotFoundException('Conexão WhatsApp não configurada.');

    const token = await this.crypto.decryptToken(conexao.tokenEncrypted);
    try {
      const info = await this.metaClient.getPhoneNumber(token, conexao.phoneNumberId);
      await this.prisma.runInTenant(tenantId, (tx) =>
        tx.conexaoWhatsapp.update({
          where: { tenantId },
          data: {
            status: 'ATIVA',
            qualityRating: info.qualityRating ?? null,
            ultimoTeste: new Date(),
          },
        }),
      );
      await this.audit.log(tenantId, userId, 'conexao_whatsapp.testar', conexao.id, {
        qualityRating: info.qualityRating,
      });
      return {
        ok: true,
        displayPhoneNumber: info.displayPhoneNumber,
        qualityRating: info.qualityRating ?? null,
      };
    } catch (err) {
      await this.prisma.runInTenant(tenantId, (tx) =>
        tx.conexaoWhatsapp.update({
          where: { tenantId },
          data: { status: 'ERRO', ultimoTeste: new Date() },
        }),
      );
      await this.audit.log(tenantId, userId, 'conexao_whatsapp.testar.falha', conexao.id, {
        erro: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // POST /enviar-teste — manda template hello_world para validar end-to-end.
  // -------------------------------------------------------------------------
  async enviarTeste(
    tenantId: string,
    userId: string,
    telefoneE164: string,
  ): Promise<{ ok: true; messageId: string }> {
    const conexao = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoWhatsapp.findUnique({ where: { tenantId } }),
    );
    if (!conexao) throw new NotFoundException('Conexão WhatsApp não configurada.');
    if (conexao.status !== 'ATIVA') {
      throw new BadRequestException('Conexão WhatsApp não está ATIVA.');
    }

    const token = await this.crypto.decryptToken(conexao.tokenEncrypted);
    const r = await this.metaClient.sendHelloWorld(token, conexao.phoneNumberId, telefoneE164);
    const messageId = r.messages[0]?.id ?? '';

    await this.audit.log(tenantId, userId, 'conexao_whatsapp.enviar_teste', conexao.id, {
      destino: telefoneE164,
      messageId,
    });
    return { ok: true, messageId };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  private async validarTokenContraMeta(
    token: string,
    phoneNumberId: string,
  ): Promise<{ displayPhoneNumber: string; qualityRating?: string }> {
    try {
      const info = await this.metaClient.getPhoneNumber(token, phoneNumberId);
      if (!info.displayPhoneNumber) {
        throw new BadRequestException('Meta retornou sem display_phone_number — número inválido.');
      }
      return { displayPhoneNumber: info.displayPhoneNumber, qualityRating: info.qualityRating };
    } catch (err) {
      if (err instanceof MetaApiError) {
        throw new BadRequestException(
          `Token ou phoneNumberId inválido: ${err.body.error?.message ?? 'erro Meta'}`,
        );
      }
      throw err;
    }
  }

  private materializarPublica(
    conexao: {
      id: string;
      wabaId: string;
      phoneNumberId: string;
      status: string;
      tierMeta: string;
      qualityRating: string | null;
      webhookSecret: string;
      ultimoTeste: Date | null;
    },
    tenantSlug: string,
    displayPhoneNumber: string,
  ): ConexaoWhatsappPublica {
    return {
      id: conexao.id,
      wabaId: conexao.wabaId,
      phoneNumberId: conexao.phoneNumberId,
      displayPhoneNumber,
      status: conexao.status,
      tierMeta: conexao.tierMeta,
      qualityRating: conexao.qualityRating,
      webhook: {
        url: `${this.webhookBaseUrl}/${tenantSlug}`,
        secret: conexao.webhookSecret,
      },
      ultimoTeste: conexao.ultimoTeste,
    };
  }
}
