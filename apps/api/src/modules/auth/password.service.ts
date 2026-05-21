import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

import { env } from '../../config/config.module.js';

/**
 * Hashing de senhas com Argon2id + pepper (RULES 3.1).
 *
 * Parâmetros (RULES 3.1):
 *   - timeCost: 3
 *   - memoryCost: 64 MB (65_536 KiB)
 *   - parallelism: 4
 */
@Injectable()
export class PasswordService {
  private readonly pepper: string;

  constructor(config: ConfigService) {
    this.pepper = env(config, 'AUTH_PEPPER');
  }

  async hash(plain: string): Promise<string> {
    return argon2.hash(this.peppered(plain), {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 64 * 1024,
      parallelism: 4,
    });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, this.peppered(plain));
    } catch {
      // Hash corrompido / inválido. Retorna false para não revelar nada.
      return false;
    }
  }

  /**
   * Quando os parâmetros do argon2 evoluírem (timeCost, memoryCost) podemos
   * detectar hashes antigos e regenerá-los no próximo login bem-sucedido.
   */
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, {
        timeCost: 3,
        memoryCost: 64 * 1024,
        parallelism: 4,
      });
    } catch {
      return true;
    }
  }

  private peppered(plain: string): string {
    return `${plain}${this.pepper}`;
  }
}
