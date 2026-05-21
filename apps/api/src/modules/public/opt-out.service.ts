import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { env } from '../../config/config.module.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

import { OptOutTokenService } from './opt-out-token.service.js';

export interface OptOutContexto {
  ip: string;
  userAgent: string;
}

@Injectable()
export class OptOutService {
  private readonly logger = new Logger(OptOutService.name);
  private readonly termoVersao: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly token: OptOutTokenService,
  ) {
    this.termoVersao = env(config, 'CURRENT_OPT_IN_TERM_VERSION');
  }

  async executar(
    rawToken: string,
    ctx: OptOutContexto,
  ): Promise<{ ok: true; razaoSocial: string; canal: 'EMAIL' | 'WHATSAPP' }> {
    const payload = this.token.verificar(rawToken);
    if (!payload) throw new BadRequestException('Token inválido.');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: payload.t } });
    if (!tenant) throw new NotFoundException();

    await this.prisma.runInTenant(tenant.id, async (tx) => {
      const contato = await tx.contato.findUnique({ where: { id: payload.c } });
      if (!contato) {
        // Idempotente: token válido pra contato deletado → ainda registramos
        // tentativa em opt_in_log mas não atualizamos nada.
        this.logger.debug({ msg: 'opt_out_contato_inexistente', contatoId: payload.c });
        await tx.optInLog.create({
          data: {
            tenantId: tenant.id,
            contatoId: null,
            canal: payload.ch,
            acao: 'OPT_OUT',
            ip: ctx.ip,
            userAgent: ctx.userAgent,
            origem: 'one-click-link',
            versaoTermo: this.termoVersao,
          },
        });
        return;
      }

      await tx.contato.update({
        where: { id: contato.id },
        data:
          payload.ch === 'EMAIL'
            ? { optInEmail: false }
            : { optInWhatsapp: false },
      });

      await tx.optInLog.create({
        data: {
          tenantId: tenant.id,
          contatoId: contato.id,
          email: contato.email,
          telefoneE164: contato.telefoneE164,
          canal: payload.ch,
          acao: 'OPT_OUT',
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          origem: 'one-click-link',
          versaoTermo: this.termoVersao,
        },
      });
    });

    return { ok: true, razaoSocial: tenant.razaoSocial, canal: payload.ch };
  }
}
