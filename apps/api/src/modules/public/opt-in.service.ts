import * as crypto from 'node:crypto';

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@total-campanha/db';

import { MailService } from '../../common/mail/mail.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/config.module.js';

import { OptInDto } from './dto/opt-in.dto.js';
import { RecaptchaService } from './recaptcha.service.js';

export interface OptInContexto {
  ip: string;
  userAgent: string;
}

@Injectable()
export class OptInService {
  private readonly logger = new Logger(OptInService.name);
  private readonly termoVersao: string;
  private readonly confirmBaseUrl: string;
  private readonly confirmTtlHours: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly recaptcha: RecaptchaService,
  ) {
    this.termoVersao = env(config, 'CURRENT_OPT_IN_TERM_VERSION');
    this.confirmBaseUrl = env(config, 'PUBLIC_OPT_IN_CONFIRM_BASE_URL');
    this.confirmTtlHours = env(config, 'OPT_IN_CONFIRM_TTL_HOURS');
  }

  /**
   * Resolve dados de exibição do tenant (logo, copy, branding).
   *
   * No MVP os dados de branding ainda não estão no schema (vêm em fase futura).
   * Retornamos só razão social + slug — o frontend tem fallback de tema.
   */
  async dadosLanding(slug: string): Promise<{ slug: string; razaoSocial: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');
    if (tenant.status === 'SUSPENSO' || tenant.status === 'CANCELADO') {
      throw new NotFoundException('Tenant não encontrado.');
    }
    return { slug: tenant.slug, razaoSocial: tenant.razaoSocial };
  }

  async submeter(
    slug: string,
    dto: OptInDto,
    ctx: OptInContexto,
  ): Promise<{ ok: true; doubleOptInEnviado: boolean }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');
    if (tenant.status === 'SUSPENSO' || tenant.status === 'CANCELADO') {
      throw new NotFoundException('Tenant não encontrado.');
    }

    const recaptchaOk = await this.recaptcha.verificar(dto.recaptchaToken, ctx.ip);
    if (!recaptchaOk) {
      throw new BadRequestException('Falha na verificação anti-bot.');
    }

    const segredoConfirmacao =
      dto.canais.email && dto.email ? crypto.randomBytes(32).toString('hex') : null;
    const tokenConfirmacao = segredoConfirmacao
      ? `${tenant.id}.${segredoConfirmacao}`
      : null;

    await this.prisma.runInTenant(tenant.id, async (tx) => {
      // Procura contato existente por email OU telefone.
      const existente = await tx.contato.findFirst({
        where: {
          OR: [
            ...(dto.email ? [{ email: dto.email }] : []),
            ...(dto.telefoneE164 ? [{ telefoneE164: dto.telefoneE164 }] : []),
          ],
        },
      });

      const optInMeta: Prisma.InputJsonValue = {
        ip: ctx.ip,
        ua: ctx.userAgent,
        origem: dto.origem,
        versao: this.termoVersao,
        ts: new Date().toISOString(),
      };

      const contato = existente
        ? await tx.contato.update({
            where: { id: existente.id },
            data: {
              nome: dto.nome ?? existente.nome,
              email: dto.email ?? existente.email,
              telefoneE164: dto.telefoneE164 ?? existente.telefoneE164,
              // Email só é ativado após confirmar o token enviado.
              optInEmail: existente.optInEmail,
              optInWhatsapp: dto.canais.whatsapp ? true : existente.optInWhatsapp,
              optInMeta,
              excluidoEm: null,
            },
          })
        : await tx.contato.create({
            data: {
              tenantId: tenant.id,
              nome: dto.nome,
              email: dto.email,
              telefoneE164: dto.telefoneE164,
              tags: [],
              extras: {},
              optInEmail: false,
              optInWhatsapp: dto.canais.whatsapp,
              optInMeta,
            },
          });

      // A ação afirmativa na landing já comprova o canal WhatsApp.
      if (dto.canais.whatsapp) {
        await tx.optInLog.create({
          data: {
            tenantId: tenant.id,
            contatoId: contato.id,
            email: dto.email ?? null,
            telefoneE164: dto.telefoneE164 ?? null,
            canal: 'WHATSAPP',
            acao: 'OPT_IN',
            ip: ctx.ip,
            userAgent: ctx.userAgent,
            origem: dto.origem,
            versaoTermo: this.termoVersao,
          },
        });
      }

      if (segredoConfirmacao && dto.email) {
        await tx.consentimentoPendente.updateMany({
          where: {
            contatoId: contato.id,
            canal: 'EMAIL',
            confirmadoEm: null,
            invalidadoEm: null,
          },
          data: { invalidadoEm: new Date() },
        });
        await tx.consentimentoPendente.create({
          data: {
            tenantId: tenant.id,
            contatoId: contato.id,
            canal: 'EMAIL',
            tokenHash: hashToken(segredoConfirmacao),
            email: dto.email,
            ip: ctx.ip,
            userAgent: ctx.userAgent,
            origem: dto.origem,
            versaoTermo: this.termoVersao,
            expiraEm: new Date(Date.now() + this.confirmTtlHours * 3_600_000),
          },
        });
      }
    });

    // Envio de confirmação (double opt-in) só faz sentido se houver email
    // e o canal email foi selecionado.
    let doubleOptInEnviado = false;
    if (dto.canais.email && dto.email && tokenConfirmacao) {
      try {
        const confirmUrl = `${this.confirmBaseUrl}/${encodeURIComponent(tokenConfirmacao)}`;
        await this.mail.enviar({
          to: dto.email,
          subject: `Confirme seu cadastro — ${tenant.razaoSocial}`,
          html: this.htmlConfirmacao(tenant.razaoSocial, dto.nome ?? '', confirmUrl),
        });
        doubleOptInEnviado = true;
      } catch (err) {
        this.logger.warn({ msg: 'double_opt_in_envio_falhou', err });
      }
    }

    return { ok: true, doubleOptInEnviado };
  }

  async confirmar(token: string): Promise<{ ok: true }> {
    const [tenantId, segredo, extra] = token.split('.');
    if (extra !== undefined || !UUID_REGEX.test(tenantId ?? '') || !/^[a-f0-9]{64}$/i.test(segredo ?? '')) {
      throw new BadRequestException('Link de confirmação inválido ou expirado.');
    }

    await this.prisma.runInTenant(tenantId, async (tx) => {
      const pendente = await tx.consentimentoPendente.findUnique({
        where: {
          tenantId_tokenHash: { tenantId, tokenHash: hashToken(segredo) },
        },
      });
      const agora = new Date();
      if (
        !pendente ||
        pendente.confirmadoEm ||
        pendente.invalidadoEm ||
        pendente.expiraEm <= agora
      ) {
        throw new BadRequestException('Link de confirmação inválido ou expirado.');
      }

      const consumido = await tx.consentimentoPendente.updateMany({
        where: {
          id: pendente.id,
          confirmadoEm: null,
          invalidadoEm: null,
          expiraEm: { gt: agora },
        },
        data: { confirmadoEm: agora },
      });
      if (consumido.count !== 1) {
        throw new BadRequestException('Link de confirmação inválido ou expirado.');
      }

      const contato = await tx.contato.findUnique({ where: { id: pendente.contatoId } });
      if (!contato || contato.excluidoEm) {
        throw new BadRequestException('Contato não está mais disponível.');
      }
      await tx.contato.update({
        where: { id: contato.id },
        data: {
          optInEmail: true,
          email: pendente.email ?? contato.email,
          optInMeta: {
            ip: pendente.ip,
            ua: pendente.userAgent,
            origem: pendente.origem,
            versao: pendente.versaoTermo,
            ts: agora.toISOString(),
            metodo: 'double-opt-in',
          },
        },
      });
      await tx.optInLog.create({
        data: {
          tenantId,
          contatoId: contato.id,
          email: pendente.email,
          canal: 'EMAIL',
          acao: 'OPT_IN',
          ip: pendente.ip,
          userAgent: pendente.userAgent,
          origem: pendente.origem,
          versaoTermo: pendente.versaoTermo,
        },
      });
    });
    return { ok: true };
  }

  private htmlConfirmacao(razaoSocial: string, nome: string, confirmUrl: string): string {
    const saudacao = nome ? `Olá ${escapeHtml(nome)},` : 'Olá,';
    return `<!doctype html>
<html lang="pt-BR"><body style="font-family:system-ui,sans-serif;color:#111;line-height:1.5">
  <p>${saudacao}</p>
  <p>Recebemos um pedido para receber comunicações de <strong>${escapeHtml(razaoSocial)}</strong>.</p>
  <p><a href="${confirmUrl}">Confirme seu e-mail</a> para concluir o cadastro. O link expira em ${this.confirmTtlHours} horas.</p>
  <p>Se você não solicitou esse cadastro, ignore este e-mail. Nenhuma comunicação de marketing será ativada.</p>
  <hr>
  <p style="color:#888;font-size:12px">Você está recebendo este email porque informou seu endereço em um formulário de opt-in. Nossos contatos são gerenciados conforme a LGPD.</p>
</body></html>`;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
