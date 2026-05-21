import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { env } from '../../config/config.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * CryptoService — encrypt/decrypt de tokens BYOA via pgcrypto (RULES 4).
 *
 * Estratégia:
 *   - encryptToken(plain) → pgp_sym_encrypt(plain, TOKEN_KMS_KEY) ⇒ Bytes
 *   - decryptToken(buf)   → pgp_sym_decrypt(buf, TOKEN_KMS_KEY) ⇒ string
 *
 * NUNCA logue o token decriptado. Em logs de chamada a APIs externas, mascarar
 * como `Bearer ...{last4}` (RULES 4.4).
 *
 * A chave (`TOKEN_KMS_KEY`) deve vir de Key Vault em PROD. Em DEV vem do .env.
 * Rotação anual obrigatória (RULES 4.2) — quando rotacionar, precisa re-cifrar
 * todos os tokens existentes (rotina em backlog).
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly kmsKey: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.kmsKey = env(config, 'TOKEN_KMS_KEY');
  }

  /**
   * Cifra `plain` usando pgcrypto e retorna o blob para salvar em `Bytes`
   * (e.g. `ConexaoWhatsapp.tokenEncrypted`).
   */
  async encryptToken(plain: string): Promise<Buffer> {
    if (!plain || plain.length < 8) {
      throw new Error('[crypto] token vazio ou muito curto');
    }
    // pgp_sym_encrypt retorna bytea. Usamos $queryRaw com binding para evitar
    // SQL injection na chave (mesmo ela vindo do env).
    const rows = await this.prisma.$queryRaw<Array<{ enc: Buffer }>>`
      SELECT pgp_sym_encrypt(${plain}::text, ${this.kmsKey}::text) AS enc
    `;
    if (!rows[0]?.enc) {
      throw new Error('[crypto] pgp_sym_encrypt retornou vazio');
    }
    return rows[0].enc;
  }

  /**
   * Decifra o blob de volta para string. Lança se a chave KMS estiver errada
   * ou o blob estiver corrompido — o chamador deve tratar isso como "conexão
   * inválida, refazer onboarding" (Fase 4).
   */
  async decryptToken(encrypted: Buffer): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ dec: string }>>`
      SELECT pgp_sym_decrypt(${encrypted}::bytea, ${this.kmsKey}::text) AS dec
    `;
    if (typeof rows[0]?.dec !== 'string') {
      throw new Error('[crypto] pgp_sym_decrypt retornou null/inválido');
    }
    return rows[0].dec;
  }

  /**
   * Mascara um token para uso em logs: `Bearer ****...{ultimos_4_chars}`.
   */
  maskBearer(token: string): string {
    if (token.length <= 8) return 'Bearer ****';
    return `Bearer ****${token.slice(-4)}`;
  }
}
