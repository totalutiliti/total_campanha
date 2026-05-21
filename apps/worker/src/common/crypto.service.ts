import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from './prisma.service.js';

/**
 * Espelho do CryptoService da API — decrypt de tokens BYOA via pgcrypto.
 * O worker só precisa decifrar (envio); o encrypt fica na API (onboarding).
 */
@Injectable()
export class CryptoService {
  private readonly kmsKey: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.kmsKey = config.get<string>('TOKEN_KMS_KEY') ?? '';
  }

  async decryptToken(encrypted: Buffer): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ dec: string }>>`
      SELECT pgp_sym_decrypt(${encrypted}::bytea, ${this.kmsKey}::text) AS dec
    `;
    if (typeof rows[0]?.dec !== 'string') {
      throw new Error('[worker/crypto] pgp_sym_decrypt retornou null');
    }
    return rows[0].dec;
  }

  maskBearer(token: string): string {
    if (token.length <= 8) return 'Bearer ****';
    return `Bearer ****${token.slice(-4)}`;
  }
}
