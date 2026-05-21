import * as crypto from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { env } from '../../config/config.module.js';

/**
 * Hash determinístico do email (RULES 3.2).
 *
 * - lowercase + trim antes de hashar (estabilidade).
 * - sha256 + pepper.
 * - Usado como chave unique em `users.email_hash` para evitar enumeration
 *   por busca de email cleartext (mesmo a coluna `email` existindo para o painel,
 *   apenas o `email_hash` é alvo de lookup no login).
 */
@Injectable()
export class EmailHashService {
  private readonly pepper: string;

  constructor(config: ConfigService) {
    this.pepper = env(config, 'AUTH_PEPPER');
  }

  hash(email: string): string {
    const normalizado = email.trim().toLowerCase();
    return crypto.createHash('sha256').update(`${normalizado}${this.pepper}`).digest('hex');
  }
}
