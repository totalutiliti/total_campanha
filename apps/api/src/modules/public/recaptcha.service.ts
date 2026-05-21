import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { env } from '../../config/config.module.js';

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * Verificação de reCAPTCHA v3.
 *
 * - DEV: se `RECAPTCHA_SECRET` não estiver setado, retorna sempre `true`
 *   (evita atrito ao testar localmente).
 * - PROD: chave obrigatória; falha de verificação rejeita o opt-in.
 */
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly secret: string | undefined;

  constructor(config: ConfigService) {
    this.secret = env(config, 'RECAPTCHA_SECRET');
  }

  async verificar(token: string | undefined, remoteIp: string): Promise<boolean> {
    if (!this.secret) {
      this.logger.debug('RECAPTCHA_SECRET ausente — verificação ignorada (DEV).');
      return true;
    }
    if (!token) return false;
    try {
      const params = new URLSearchParams({
        secret: this.secret,
        response: token,
        remoteip: remoteIp,
      });
      const r = await fetch(VERIFY_URL, { method: 'POST', body: params });
      if (!r.ok) return false;
      const json = (await r.json()) as { success?: boolean; score?: number };
      // v3 retorna score 0..1. Por padrão aceita >= 0.5.
      return !!json.success && (json.score === undefined || json.score >= 0.5);
    } catch (err) {
      this.logger.warn({ msg: 'recaptcha_verify_falhou', err });
      return false;
    }
  }
}
