import * as crypto from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CanalOptOut = 'EMAIL' | 'WHATSAPP';

/**
 * Cópia worker do OptOutTokenService da API (apps/api/src/modules/public/).
 * MESMO formato e MESMO segredo (OPT_OUT_TOKEN_SECRET, fallback AUTH_PEPPER) —
 * o token emitido aqui é verificado pela API em GET/POST /p/opt-out/:token.
 *
 * Formato: base64url(JSON(payload)).base64url(hmacSha256(payload, secret))
 */
@Injectable()
export class OptOutTokenService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret =
      config.get<string>('OPT_OUT_TOKEN_SECRET') || (config.get<string>('AUTH_PEPPER') as string);
  }

  emitir(tenantId: string, contatoId: string, canal: CanalOptOut): string {
    const payload = { t: tenantId, c: contatoId, ch: canal, iat: Date.now() };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', this.secret).update(body).digest().toString('base64url');
    return `${body}.${sig}`;
  }
}
