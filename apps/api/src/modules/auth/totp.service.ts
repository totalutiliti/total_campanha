import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

import { env } from '../../config/config.module.js';

/**
 * 2FA TOTP (RULES 3.7). Lib `otplib`.
 *
 * Quando ativo no usuário, o login passa a exigir o código de 6 dígitos.
 * Secret é gravado em `users.totp_secret` cleartext (ele é específico do user
 * e por si só é low-value sem o device). Se quisermos elevar o padrão, podemos
 * cifrar com pgcrypto também.
 */
@Injectable()
export class TotpService {
  private readonly issuer: string;

  constructor(config: ConfigService) {
    this.issuer = env(config, 'APP_NAME');
    // Janela padrão (±1 step de 30s) — tolerância para clock skew.
    authenticator.options = { window: 1 };
  }

  gerarSecret(): string {
    return authenticator.generateSecret(20);
  }

  uri(secret: string, accountLabel: string): string {
    return authenticator.keyuri(accountLabel, this.issuer, secret);
  }

  async qrcodeDataUrl(secret: string, accountLabel: string): Promise<string> {
    return QRCode.toDataURL(this.uri(secret, accountLabel));
  }

  verify(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret });
  }
}
