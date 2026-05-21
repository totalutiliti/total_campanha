import * as crypto from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Canal } from '@total-campanha/shared';

import { env } from '../../config/config.module.js';

interface OptOutPayload {
  t: string;   // tenantId
  c: string;   // contatoId
  ch: Canal;   // canal
  iat: number; // timestamp
}

/**
 * Tokens HMAC para opt-out one-click (RULES 5.2).
 *
 * Formato: base64url(JSON(payload)).base64url(hmacSha256(payload, OPT_OUT_TOKEN_SECRET))
 *
 * Vantagem de não usar JWT: payload curto, URLs mais limpas no rodapé de email
 * e em templates WhatsApp.
 */
@Injectable()
export class OptOutTokenService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    const fromEnv = env(config, 'OPT_OUT_TOKEN_SECRET');
    if (!fromEnv) {
      // Fallback para AUTH_PEPPER em DEV — em PROD o env exige.
      this.secret = env(config, 'AUTH_PEPPER');
    } else {
      this.secret = fromEnv;
    }
  }

  emitir(tenantId: string, contatoId: string, canal: Canal): string {
    const payload: OptOutPayload = { t: tenantId, c: contatoId, ch: canal, iat: Date.now() };
    const body = b64url(JSON.stringify(payload));
    const sig = b64url(this.assinar(body));
    return `${body}.${sig}`;
  }

  verificar(token: string): OptOutPayload | null {
    const partes = token.split('.');
    if (partes.length !== 2) return null;
    const [body, sig] = partes;
    const sigEsperada = b64url(this.assinar(body));
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(sigEsperada, 'utf8');
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
    try {
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.t === 'string' &&
        typeof parsed.c === 'string' &&
        (parsed.ch === 'EMAIL' || parsed.ch === 'WHATSAPP') &&
        typeof parsed.iat === 'number'
      ) {
        return parsed as OptOutPayload;
      }
      return null;
    } catch {
      return null;
    }
  }

  private assinar(body: string): Buffer {
    return crypto.createHmac('sha256', this.secret).update(body).digest();
  }
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}
