import { Injectable, Logger, PreconditionFailedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { env } from '../../../config/config.module.js';
import { CryptoService } from '../../../common/crypto/crypto.service.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';

export interface MetaTemplateAprovado {
  name: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | string;
  category?: string;
  components?: unknown[];
}

/**
 * Lê os templates da conta Meta do tenant via Graph API.
 *
 * Pré-condição: `ConexaoWhatsapp` ATIVA para o tenant (Fase 4).
 * Se não houver, lança 412 Precondition Failed com mensagem orientando o user
 * a finalizar a conexão WhatsApp BYOA antes.
 *
 * Não logamos o token decriptado em hipótese alguma (RULES 4.4).
 */
@Injectable()
export class MetaTemplatesService {
  private readonly logger = new Logger(MetaTemplatesService.name);
  private readonly graphBase: string;
  private readonly graphVersion: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {
    this.graphBase = env(config, 'META_GRAPH_BASE_URL');
    this.graphVersion = env(config, 'META_GRAPH_VERSION');
  }

  async listarAprovados(tenantId: string): Promise<MetaTemplateAprovado[]> {
    const conexao = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.conexaoWhatsapp.findUnique({ where: { tenantId } }),
    );
    if (!conexao || conexao.status !== 'ATIVA') {
      throw new PreconditionFailedException(
        'Conexão WhatsApp não está ATIVA — configure em /conexoes/whatsapp antes.',
      );
    }

    const token = await this.crypto.decryptToken(conexao.tokenEncrypted);
    const url = `${this.graphBase}/${this.graphVersion}/${conexao.wabaId}/message_templates?fields=name,language,status,category,components&limit=100`;

    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Log com token mascarado.
      this.logger.debug({
        msg: 'meta_templates_list',
        wabaId: conexao.wabaId,
        status: r.status,
        bearer: this.crypto.maskBearer(token),
      });

      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Meta retornou ${r.status}: ${txt.slice(0, 200)}`);
      }
      const json = (await r.json()) as { data?: MetaTemplateAprovado[] };
      return (json.data ?? []).filter((t) => t.status === 'APPROVED');
    } catch (err) {
      this.logger.warn({
        msg: 'meta_templates_list_falhou',
        wabaId: conexao.wabaId,
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /**
   * Valida que um template específico (nome+idioma) está APPROVED na conta do tenant.
   * Usado em CriarTemplateDto/AtualizarTemplateDto antes de persistir.
   *
   * Em DEV (sem credenciais Meta reais), o flag `META_VALIDATE_TEMPLATES=false`
   * pula a checagem — mas em PROD a validação é obrigatória. Implementação
   * graceful: se não há conexão ativa, retorna `false` para o caller decidir.
   */
  async validarTemplateExisteEAprovado(
    tenantId: string,
    metaTemplateName: string,
    metaLanguage: string,
  ): Promise<boolean> {
    try {
      const aprovados = await this.listarAprovados(tenantId);
      return aprovados.some(
        (t) => t.name === metaTemplateName && t.language === metaLanguage,
      );
    } catch (err) {
      this.logger.warn({ msg: 'validar_template_falhou', err });
      return false;
    }
  }
}
