import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@total-campanha/db';

import { env } from '../../config/config.module.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { MailService } from '../../common/mail/mail.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

import { AtualizarTemplateDto } from './dto/atualizar-template.dto.js';
import { CriarTemplateDto } from './dto/criar-template.dto.js';
import { PreviewTemplateDto } from './dto/preview-template.dto.js';
import { TesteEnvioDto } from './dto/teste-envio.dto.js';
import { MjmlRenderService } from './render/mjml-render.service.js';
import { MetaTemplatesService } from './whatsapp/meta-templates.service.js';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);
  private readonly nodeEnv: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly render: MjmlRenderService,
    private readonly mail: MailService,
    private readonly meta: MetaTemplatesService,
  ) {
    this.nodeEnv = env(config, 'NODE_ENV');
  }

  async criar(tenantId: string, userId: string, dto: CriarTemplateDto) {
    if (dto.canal === 'WHATSAPP') {
      // superRefine no DTO garante metaTemplateName presente para WHATSAPP.
      await this.validarTemplateWhatsapp(tenantId, dto.metaTemplateName!, dto.metaLanguage);
    }

    const template = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.template.create({
        data: {
          tenantId,
          canal: dto.canal,
          nome: dto.nome,
          variaveis: dto.variaveis as Prisma.InputJsonValue,
          assunto: dto.canal === 'EMAIL' ? dto.assunto : null,
          mjml: dto.canal === 'EMAIL' ? dto.mjml : null,
          metaTemplateName: dto.canal === 'WHATSAPP' ? dto.metaTemplateName : null,
          metaLanguage: dto.canal === 'WHATSAPP' ? dto.metaLanguage : null,
        },
      }),
    );

    await this.audit.log(tenantId, userId, 'template.criar', template.id, { canal: dto.canal });
    return template;
  }

  async listar(tenantId: string, canal?: 'EMAIL' | 'WHATSAPP') {
    return this.prisma.runInTenant(tenantId, (tx) =>
      tx.template.findMany({
        where: canal ? { canal } : undefined,
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async buscar(tenantId: string, id: string) {
    const t = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.template.findUnique({ where: { id } }),
    );
    if (!t) throw new NotFoundException('Template não encontrado.');
    return t;
  }

  async atualizar(tenantId: string, userId: string, id: string, dto: AtualizarTemplateDto) {
    const atual = await this.buscar(tenantId, id);

    if (
      atual.canal === 'WHATSAPP' &&
      (dto.metaTemplateName !== undefined || dto.metaLanguage !== undefined)
    ) {
      const nome = dto.metaTemplateName ?? atual.metaTemplateName!;
      const lang = dto.metaLanguage ?? atual.metaLanguage!;
      await this.validarTemplateWhatsapp(tenantId, nome, lang);
    }

    const atualizado = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.template.update({
        where: { id },
        data: {
          ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
          ...(dto.assunto !== undefined ? { assunto: dto.assunto } : {}),
          ...(dto.mjml !== undefined ? { mjml: dto.mjml } : {}),
          ...(dto.metaTemplateName !== undefined ? { metaTemplateName: dto.metaTemplateName } : {}),
          ...(dto.metaLanguage !== undefined ? { metaLanguage: dto.metaLanguage } : {}),
          ...(dto.variaveis !== undefined
            ? { variaveis: dto.variaveis as Prisma.InputJsonValue }
            : {}),
        },
      }),
    );

    await this.audit.log(tenantId, userId, 'template.atualizar', id, { campos: Object.keys(dto) });
    return atualizado;
  }

  async excluir(tenantId: string, userId: string, id: string): Promise<{ deletado: true }> {
    const r = await this.prisma.runInTenant(tenantId, (tx) =>
      tx.template.deleteMany({ where: { id } }),
    );
    if (r.count === 0) throw new NotFoundException('Template não encontrado.');
    await this.audit.log(tenantId, userId, 'template.excluir', id, {});
    return { deletado: true };
  }

  /**
   * Renderiza o template para preview (Email apenas — preview de WhatsApp é
   * a string interpolada com Mustache).
   */
  async preview(tenantId: string, id: string, dto: PreviewTemplateDto) {
    const t = await this.buscar(tenantId, id);
    const variaveis = this.aplicarExemplos(t.variaveis, dto.variaveis);

    if (t.canal === 'EMAIL') {
      if (!t.mjml) throw new BadRequestException('Template sem MJML.');
      const assunto = this.render.renderizarAssunto(t.assunto ?? '', variaveis);
      const { html, warnings } = this.render.renderizar(t.mjml, variaveis);
      return { canal: 'EMAIL', assunto, html, warnings };
    }

    // WhatsApp: preview é o textoExemplo do template Meta (se houver). No MVP
    // armazenamos só a referência (metaTemplateName) e a lista de variáveis —
    // o conteúdo real está na Meta. Retornamos uma string sintetizada com as
    // variáveis aplicadas.
    return {
      canal: 'WHATSAPP',
      metaTemplateName: t.metaTemplateName,
      metaLanguage: t.metaLanguage,
      variaveisAplicadas: variaveis,
    };
  }

  /**
   * Envia o template para um destinatário interno do tenant para validação visual.
   * - Email: monta HTML via MJML+Mustache e envia via MailService.
   * - WhatsApp: cria entrada na fila `dispatch-whatsapp` simulando uma mensagem
   *   única (na Fase 5 isso integra com o worker real).
   */
  async testeEnvio(
    tenantId: string,
    userId: string,
    id: string,
    dto: TesteEnvioDto,
  ): Promise<{ ok: true; canal: 'EMAIL' | 'WHATSAPP'; destino: string }> {
    const t = await this.buscar(tenantId, id);
    const variaveis = this.aplicarExemplos(t.variaveis, dto.variaveis);

    if (t.canal === 'EMAIL') {
      if (!dto.destinatarioEmail) {
        throw new BadRequestException('Informe destinatarioEmail para teste de template EMAIL.');
      }
      const { html } = this.render.renderizar(t.mjml ?? '', variaveis);
      const assunto = this.render.renderizarAssunto(t.assunto ?? '(sem assunto)', variaveis);
      await this.mail.enviar({ to: dto.destinatarioEmail, subject: `[TESTE] ${assunto}`, html });
      await this.audit.log(tenantId, userId, 'template.teste_envio', id, {
        canal: 'EMAIL',
        destino: dto.destinatarioEmail,
      });
      return { ok: true, canal: 'EMAIL', destino: dto.destinatarioEmail };
    }

    if (!dto.destinatarioTelefoneE164) {
      throw new BadRequestException('Informe destinatarioTelefoneE164 para teste WhatsApp.');
    }
    // Em Fase 3 ainda não disparamos via Meta direto; a integração final entra
    // com o worker da Fase 5 (DispatchWhatsappProcessor). Aqui só validamos
    // que a conexão existe e logamos a intenção.
    if (this.nodeEnv === 'production') {
      throw new PreconditionFailedException(
        'Teste de envio WhatsApp ainda não disponível — disponível a partir da Fase 5.',
      );
    }
    this.logger.warn({
      msg: 'teste_envio_whatsapp_stub',
      tenantId,
      templateId: id,
      destino: dto.destinatarioTelefoneE164,
    });
    await this.audit.log(tenantId, userId, 'template.teste_envio', id, {
      canal: 'WHATSAPP',
      destino: dto.destinatarioTelefoneE164,
      stub: true,
    });
    return { ok: true, canal: 'WHATSAPP', destino: dto.destinatarioTelefoneE164 };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Mescla as variáveis fornecidas pelo usuário com os exemplos cadastrados
   * no template. Útil para preview rápido (basta clicar para ver o template
   * renderizado com os exemplos default sem digitar nada).
   */
  private aplicarExemplos(
    variaveisTemplate: Prisma.JsonValue | null,
    fornecidas: Record<string, string | number | boolean>,
  ): Record<string, string> {
    const exemplos: Record<string, string> = {};
    if (Array.isArray(variaveisTemplate)) {
      for (const v of variaveisTemplate as Array<{ key?: string; exemplo?: string }>) {
        if (v?.key) exemplos[v.key] = v.exemplo ?? '';
      }
    }
    for (const [k, v] of Object.entries(fornecidas)) {
      exemplos[k] = String(v);
    }
    return exemplos;
  }

  private async validarTemplateWhatsapp(
    tenantId: string,
    metaTemplateName: string,
    metaLanguage: string,
  ): Promise<void> {
    // Em DEV permitimos cadastrar referência sem validar contra Meta (não há
    // conexão ainda). Em PROD, refusamos se Meta não confirmar APPROVED.
    if (this.nodeEnv !== 'production') return;
    const ok = await this.meta.validarTemplateExisteEAprovado(
      tenantId,
      metaTemplateName,
      metaLanguage,
    );
    if (!ok) {
      throw new BadRequestException(
        `Template "${metaTemplateName}" (${metaLanguage}) não está APPROVED na conta Meta do tenant.`,
      );
    }
  }
}
