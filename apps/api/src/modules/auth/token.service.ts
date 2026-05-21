import * as crypto from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { env } from '../../config/config.module.js';
import { RedisService } from '../../common/redis/redis.service.js';

import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './jwt-payload.type.js';

const REFRESH_PREFIX = 'tc:auth:refresh:';        // tc:auth:refresh:{jti} → { fam, sub }
const REFRESH_FAMILY_PREFIX = 'tc:auth:fam:';     // tc:auth:fam:{fam}     → '1' (válida) | '0' (invalidada)
const RESET_PREFIX = 'tc:auth:reset:';            // tc:auth:reset:{token} → userId

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly accessTtl: string;
  private readonly refreshSecret: string;
  private readonly refreshTtlSec: number;
  private readonly resetTtlSec: number;

  constructor(
    config: ConfigService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {
    this.accessSecret = env(config, 'JWT_ACCESS_SECRET');
    this.accessTtl = env(config, 'JWT_ACCESS_TTL');
    this.refreshSecret = env(config, 'JWT_REFRESH_SECRET');
    this.refreshTtlSec = parseTtlToSeconds(env(config, 'JWT_REFRESH_TTL'));
    this.resetTtlSec = env(config, 'PASSWORD_RESET_TTL_MIN') * 60;
  }

  // ---------------------------------------------------------------
  // Access token
  // ---------------------------------------------------------------

  async assinarAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });
  }

  async verificarAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Token inválido.');
    }
  }

  // ---------------------------------------------------------------
  // Refresh token com rotation (RULES 3.5)
  // ---------------------------------------------------------------

  /**
   * Emite um par (refreshToken assinado, jti).
   * - Cria uma nova família se `family` não for fornecida (login fresco).
   * - Reaproveita a família ao renovar (rotation dentro da mesma sessão).
   * - `tid` (tenant selecionado) é preservado entre rotations.
   */
  async emitirRefreshToken(
    userId: string,
    tid: string | null,
    family?: string,
  ): Promise<{ token: string; jti: string; family: string }> {
    const fam = family ?? crypto.randomUUID();
    const jti = crypto.randomUUID();
    const payload: RefreshTokenPayload = { sub: userId, jti, fam, tid };

    const token = await this.jwt.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtlSec,
    });

    // Grava jti como válido + família como ativa.
    await this.redis.client.set(
      `${REFRESH_PREFIX}${jti}`,
      JSON.stringify({ fam, sub: userId, tid }),
      'EX',
      this.refreshTtlSec,
    );
    await this.redis.client.set(`${REFRESH_FAMILY_PREFIX}${fam}`, '1', 'EX', this.refreshTtlSec);

    return { token, jti, family: fam };
  }

  /**
   * Consome um refresh token e emite um novo (rotation).
   *
   * Comportamento crítico (RULES 3.5):
   *   - Se o jti não existe mais no Redis (foi consumido antes) → reuse detectado:
   *     invalida a família inteira e levanta 401.
   *   - Se a família foi invalidada → 401.
   *   - Caso ok: deleta o jti antigo e emite novo jti dentro da mesma família.
   */
  async rotacionarRefreshToken(
    token: string,
  ): Promise<{ token: string; jti: string; family: string; sub: string; tid: string | null }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const famKey = `${REFRESH_FAMILY_PREFIX}${payload.fam}`;
    const famStatus = await this.redis.client.get(famKey);
    if (famStatus !== '1') {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const jtiKey = `${REFRESH_PREFIX}${payload.jti}`;
    const stored = await this.redis.client.get(jtiKey);
    if (!stored) {
      // Reuse detectado: invalida a família inteira.
      await this.redis.client.set(famKey, '0', 'EX', this.refreshTtlSec);
      throw new UnauthorizedException('Refresh token reutilizado.');
    }
    await this.redis.client.del(jtiKey);

    const novo = await this.emitirRefreshToken(payload.sub, payload.tid ?? null, payload.fam);
    return { ...novo, sub: payload.sub, tid: payload.tid ?? null };
  }

  async invalidarFamilia(family: string): Promise<void> {
    await this.redis.client.set(
      `${REFRESH_FAMILY_PREFIX}${family}`,
      '0',
      'EX',
      this.refreshTtlSec,
    );
  }

  /**
   * Invalida todas as famílias de refresh de um usuário (para reset de senha).
   * Mantemos um SET por user com as famílias atuais.
   */
  async invalidarTodasSessoes(userId: string): Promise<void> {
    const setKey = `tc:auth:user-families:${userId}`;
    const familias = await this.redis.client.smembers(setKey);
    if (familias.length === 0) return;
    const pipeline = this.redis.client.pipeline();
    for (const fam of familias) {
      pipeline.set(`${REFRESH_FAMILY_PREFIX}${fam}`, '0', 'EX', this.refreshTtlSec);
    }
    pipeline.del(setKey);
    await pipeline.exec();
  }

  async registrarFamilia(userId: string, family: string): Promise<void> {
    await this.redis.client.sadd(`tc:auth:user-families:${userId}`, family);
  }

  // ---------------------------------------------------------------
  // Reset de senha (RULES 3.8)
  // ---------------------------------------------------------------

  async emitirResetToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.redis.client.set(`${RESET_PREFIX}${token}`, userId, 'EX', this.resetTtlSec);
    return token;
  }

  async consumirResetToken(token: string): Promise<string | null> {
    const key = `${RESET_PREFIX}${token}`;
    const userId = await this.redis.client.get(key);
    if (!userId) return null;
    // Single-use: deleta após validar.
    await this.redis.client.del(key);
    return userId;
  }

  refreshTtlSeconds(): number {
    return this.refreshTtlSec;
  }
}

/**
 * Converte string TTL ('15m', '7d', '3600s') para segundos.
 * Aceita também número puro (= segundos).
 */
function parseTtlToSeconds(ttl: string): number {
  if (/^\d+$/.test(ttl)) return Number(ttl);
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`[token] TTL inválido: ${ttl}`);
  const valor = Number(match[1]);
  const unidade = match[2];
  switch (unidade) {
    case 's':
      return valor;
    case 'm':
      return valor * 60;
    case 'h':
      return valor * 60 * 60;
    case 'd':
      return valor * 24 * 60 * 60;
    default:
      throw new Error(`[token] unidade TTL inválida: ${unidade}`);
  }
}
