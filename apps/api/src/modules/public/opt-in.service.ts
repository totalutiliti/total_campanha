import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@total-campanha/db';
import type { Canal } from '@total-campanha/db';

import { env } from '../../config/config.module.js';
import { MailService } from '../../common/mail/mail.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

import { OptInDto } from './dto/opt-in.dto.js';
import { OptOutTokenService } from './opt-out-token.service.js';
import { RecaptchaService } from './recaptcha.service.js';

export interface OptInContexto {
  ip: string;
  userAgent: string;
}

@Injectable()
export class OptInService {
  private readonly logger = new Logger(OptInService.name);
  private readonly termoVersao: string;
  private readonly publicOptOutBaseUrl: string;
  private readonly publicOptInBaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly recaptcha: RecaptchaService,
    private readonly optOutToken: OptOutTokenService,
  ) {
    this.termoVersao = env(config, 'CURRENT_OPT_IN_TERM_VERSION');
    this.publicOptOutBaseUrl = env(config, 'PUBLIC_OPT_OUT_BASE_URL');
    this.publicOptInBaseUrl = env(config, 'PUBLIC_OPT_IN_BASE_URL');
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

    const contato = await this.prisma.runInTenant(tenant.id, async (tx) => {
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
              optInEmail: dto.canais.email ? true : existente.optInEmail,
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
              optInEmail: dto.canais.email,
              optInWhatsapp: dto.canais.whatsapp,
              optInMeta,
            },
          });

      // opt_in_log: 1 linha por canal opted-in (RULES 5.4 — imutável).
      const canais: Canal[] = [];
      if (dto.canais.email) canais.push('EMAIL');
      if (dto.canais.whatsapp) canais.push('WHATSAPP');
      for (const c of canais) {
        await tx.optInLog.create({
          data: {
            tenantId: tenant.id,
            contatoId: contato.id,
            email: dto.email ?? null,
            telefoneE164: dto.telefoneE164 ?? null,
            canal: c,
            acao: 'OPT_IN',
            ip: ctx.ip,
            userAgent: ctx.userAgent,
            origem: dto.origem,
            versaoTermo: this.termoVersao,
          },
        });
      }

      return contato;
    });

    // Envio de confirmação (double opt-in) só faz sentido se houver email
    // e o canal email foi selecionado.
    let doubleOptInEnviado = false;
    if (dto.canais.email && dto.email) {
      try {
        const optOutTok = this.optOutToken.emitir(tenant.id, contato.id, 'EMAIL');
        const optOutUrl = `${this.publicOptOutBaseUrl}/${optOutTok}`;
        await this.mail.enviar({
          to: dto.email,
          subject: `Confirme seu cadastro — ${tenant.razaoSocial}`,
          html: this.htmlConfirmacao(tenant.razaoSocial, dto.nome ?? '', optOutUrl),
        });
        doubleOptInEnviado = true;
      } catch (err) {
        this.logger.warn({ msg: 'double_opt_in_envio_falhou', err });
      }
    }

    return { ok: true, doubleOptInEnviado };
  }

  private htmlConfirmacao(razaoSocial: string, nome: string, optOutUrl: string): string {
    const saudacao = nome ? `Olá ${escapeHtml(nome)},` : 'Olá,';
    return `<!doctype html>
<html lang="pt-BR"><body style="font-family:system-ui,sans-serif;color:#111;line-height:1.5">
  <p>${saudacao}</p>
  <p>Confirmamos seu opt-in para receber comunicações de <strong>${escapeHtml(razaoSocial)}</strong>.</p>
  <p>Se você não solicitou esse cadastro, ignore este email ou
    <a href="${optOutUrl}">cancele a inscrição</a> em um clique.</p>
  <hr>
  <p style="color:#888;font-size:12px">Você está recebendo este email porque informou seu endereço em um formulário de opt-in. Nossos contatos são gerenciados conforme a LGPD.</p>
</body></html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
