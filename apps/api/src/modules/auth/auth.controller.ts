import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { env } from '../../config/config.module.js';

import { AuthService, ResultadoAuth } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { Public } from './public.decorator.js';
import type { AuthenticatedUser } from './jwt-payload.type.js';

import { ForgotDto } from './dto/forgot.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ResetDto } from './dto/reset.dto.js';
import { SelectTenantDto } from './dto/select-tenant.dto.js';
import { SignupDto } from './dto/signup.dto.js';
import { TotpVerifyDto } from './dto/totp-verify.dto.js';

const REFRESH_COOKIE_NAME = 'tc_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  // Rate limit estrito (RULES 3.4) aplicado SÓ nas rotas sensíveis (login,
  // signup, forgot, reset). `refresh`/`logout`/`select-tenant`/`2fa` ficam no
  // throttle global (60/min) — `refresh` é chamado a cada boot do app e não
  // pode dividir o bucket de 5/15min do login.
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.authService.signup(dto);
    this.setarRefreshCookie(res, result);
    return { accessToken: result.accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    accessToken: string;
    precisa2fa?: true;
    precisaEscolherTenant?: ResultadoAuth['precisaEscolherTenant'];
  }> {
    const result = await this.authService.login(dto);
    if (result.precisa2fa) {
      return { accessToken: '', precisa2fa: true };
    }
    this.setarRefreshCookie(res, result);
    return {
      accessToken: result.accessToken,
      ...(result.precisaEscolherTenant
        ? { precisaEscolherTenant: result.precisaEscolherTenant }
        : {}),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('select-tenant')
  @HttpCode(HttpStatus.OK)
  async selecionarTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SelectTenantDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.authService.selecionarTenant(user.sub, dto.tenantId);
    this.setarRefreshCookie(res, result);
    return { accessToken: result.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ?? null;
    if (!refreshToken) throw new UnauthorizedException('Refresh ausente.');

    const result = await this.authService.refresh(refreshToken);
    this.setarRefreshCookie(res, result);
    return { accessToken: result.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken = (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ?? null;
    await this.authService.logout(refreshToken);
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOpts());
  }

  @Public()
  @Post('forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async forgot(@Body() dto: ForgotDto): Promise<{ ok: true }> {
    await this.authService.forgot(dto.email);
    // Sempre responde igual — não revelar se email existe (RULES 3.3).
    return { ok: true };
  }

  @Public()
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async reset(@Body() dto: ResetDto): Promise<{ ok: true }> {
    await this.authService.reset(dto.token, dto.novaSenha);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  async setup2fa(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ secret: string; otpauthUrl: string; qrcode: string }> {
    return this.authService.setup2fa(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verify2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TotpVerifyDto & { secret: string },
  ): Promise<{ ok: true }> {
    if (!dto.secret) throw new UnauthorizedException('Secret ausente.');
    await this.authService.verify2fa(user.sub, dto.secret, dto.codigo);
    return { ok: true };
  }

  // ---------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------
  private setarRefreshCookie(res: Response, result: ResultadoAuth): void {
    if (!result.refresh.token) return;
    res.cookie(REFRESH_COOKIE_NAME, result.refresh.token, {
      ...this.cookieOpts(),
      maxAge: result.refresh.ttlSeconds * 1000,
    });
  }

  private cookieOpts() {
    return {
      httpOnly: true,
      secure: env(this.config, 'COOKIE_SECURE'),
      sameSite: env(this.config, 'COOKIE_SAMESITE'),
      domain: env(this.config, 'COOKIE_DOMAIN'),
      path: '/api/v1/auth',
    } as const;
  }
}
