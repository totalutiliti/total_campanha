import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@total-campanha/shared';

import { MailService } from '../../common/mail/mail.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/config.module.js';
import { UsersService } from '../users/users.service.js';

import type { LoginDto } from './dto/login.dto.js';
import type { SignupDto } from './dto/signup.dto.js';
import { EmailHashService } from './email-hash.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { TotpService } from './totp.service.js';

const ERR_LOGIN_GENERICO = 'Email ou senha incorretos.';

export interface ResultadoAuth {
  accessToken: string;
  refresh: { token: string; ttlSeconds: number };
  // Quando o user tem múltiplos tenants e ainda não selecionou um.
  precisaEscolherTenant?: { tenants: Array<{ id: string; slug: string; razaoSocial: string }> };
  // Quando o user tem 2FA mas o login não trouxe o código.
  precisa2fa?: true;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly webBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly password: PasswordService,
    private readonly emailHash: EmailHashService,
    private readonly tokens: TokenService,
    private readonly totp: TotpService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    // Base do app web para links em emails. Sem WEB_BASE_URL, deriva a origem
    // de PUBLIC_OPT_IN_BASE_URL (ex.: https://app.x.com.br/p/opt-in → https://app.x.com.br).
    const explicita = env(config, 'WEB_BASE_URL');
    this.webBaseUrl = explicita
      ? explicita.replace(/\/$/, '')
      : new URL(env(config, 'PUBLIC_OPT_IN_BASE_URL')).origin;
  }

  // ---------------------------------------------------------------
  // Signup — cria Tenant + primeiro User ADMIN.
  // ---------------------------------------------------------------
  async signup(dto: SignupDto): Promise<ResultadoAuth> {
    const emailHash = this.emailHash.hash(dto.email);

    // Pré-checks unicidade (DB também garante; aqui antecipamos mensagem clara).
    const [emailExistente, slugExistente, cnpjExistente] = await Promise.all([
      this.prisma.user.findUnique({ where: { emailHash } }),
      this.prisma.tenant.findUnique({ where: { slug: dto.slug } }),
      this.prisma.tenant.findUnique({ where: { cnpj: dto.cnpj } }),
    ]);
    if (emailExistente) throw new ConflictException('Email já cadastrado.');
    if (slugExistente) throw new ConflictException('Slug já em uso.');
    if (cnpjExistente) throw new ConflictException('CNPJ já cadastrado.');

    const passwordHash = await this.password.hash(dto.senha);

    const tenant = await this.prisma.tenant.create({
      data: {
        slug: dto.slug,
        cnpj: dto.cnpj,
        razaoSocial: dto.razaoSocial,
        status: 'TRIAL',
        trialAteEm: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        userTenants: {
          create: {
            role: Role.ADMIN,
            user: {
              create: {
                email: dto.email,
                emailHash,
                passwordHash,
              },
            },
          },
        },
      },
      include: { userTenants: { include: { user: true } } },
    });

    const userTenant = tenant.userTenants[0];

    await this.prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: userTenant.user.id,
        acao: 'auth.signup',
        recurso: tenant.id,
        dados: { slug: dto.slug, cnpj: dto.cnpj, aceiteDpaVersao: dto.aceiteDpaVersao },
      },
    });

    return this.emitirSessao(userTenant.user.id, tenant.id, userTenant.role);
  }

  // ---------------------------------------------------------------
  // Login — autentica e emite par access/refresh.
  // ---------------------------------------------------------------
  async login(dto: LoginDto): Promise<ResultadoAuth> {
    const emailHash = this.emailHash.hash(dto.email);
    const user = await this.users.buscarPorEmailHash(emailHash);

    // Mensagem sempre genérica (RULES 3.3).
    if (!user) {
      throw new UnauthorizedException(ERR_LOGIN_GENERICO);
    }

    const ok = await this.password.verify(user.passwordHash, dto.senha);
    if (!ok) {
      throw new UnauthorizedException(ERR_LOGIN_GENERICO);
    }

    // 2FA: se o user tem totpSecret, exigir código.
    if (user.totpSecret) {
      if (!dto.totp) {
        // Sinaliza ao cliente: precisa enviar TOTP. Sem emitir token ainda.
        return {
          accessToken: '',
          refresh: { token: '', ttlSeconds: 0 },
          precisa2fa: true,
        };
      }
      const totpOk = this.totp.verify(user.totpSecret, dto.totp);
      if (!totpOk) {
        throw new UnauthorizedException(ERR_LOGIN_GENERICO);
      }
    }

    // Rehash silencioso se parâmetros do argon2 mudaram.
    if (this.password.needsRehash(user.passwordHash)) {
      const novoHash = await this.password.hash(dto.senha);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: novoHash },
      });
    }

    // Tenant selection
    const tenants = user.userTenants.filter(
      (ut) =>
        ut.tenant.status !== 'CANCELADO' &&
        ut.tenant.status !== 'SUSPENSO',
    );

    if (tenants.length === 0) {
      throw new ForbiddenException('Nenhum tenant ativo associado a este usuário.');
    }

    if (tenants.length > 1) {
      // Emite access token "pending" (tid=null) — cliente precisa chamar /auth/select-tenant.
      const accessToken = await this.tokens.assinarAccessToken({
        sub: user.id,
        tid: null,
        role: null,
        aud: 'tenant',
      });
      const refresh = await this.tokens.emitirRefreshToken(user.id, null);
      await this.tokens.registrarFamilia(user.id, refresh.family);
      return {
        accessToken,
        refresh: { token: refresh.token, ttlSeconds: this.tokens.refreshTtlSeconds() },
        precisaEscolherTenant: {
          tenants: tenants.map((ut) => ({
            id: ut.tenant.id,
            slug: ut.tenant.slug,
            razaoSocial: ut.tenant.razaoSocial,
          })),
        },
      };
    }

    const ut = tenants[0];
    return this.emitirSessao(user.id, ut.tenant.id, ut.role);
  }

  // ---------------------------------------------------------------
  // Select tenant (após login multi-tenant).
  // ---------------------------------------------------------------
  async selecionarTenant(userId: string, tenantId: string): Promise<ResultadoAuth> {
    const ut = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { tenant: true },
    });
    if (!ut) throw new ForbiddenException('Você não tem acesso a este tenant.');
    if (ut.tenant.status === 'CANCELADO' || ut.tenant.status === 'SUSPENSO') {
      throw new ForbiddenException('Tenant inativo.');
    }
    return this.emitirSessao(userId, tenantId, ut.role);
  }

  // ---------------------------------------------------------------
  // Refresh (rotation — RULES 3.5)
  // ---------------------------------------------------------------
  async refresh(refreshToken: string): Promise<ResultadoAuth> {
    const rotated = await this.tokens.rotacionarRefreshToken(refreshToken);
    const user = await this.users.buscarPorId(rotated.sub);
    if (!user) throw new UnauthorizedException('Sessão inválida.');

    // Preserva o tenant da sessão (vem no refresh token). Relê o role do banco
    // — pode ter mudado. Se o tenant ficou inválido/suspenso, cai para "pending"
    // (tid=null) e o cliente escolhe de novo.
    let tid = rotated.tid;
    let role: Role | null = null;
    if (tid) {
      const ut = user.userTenants.find((u) => u.tenantId === tid);
      if (ut && ut.tenant.status !== 'CANCELADO' && ut.tenant.status !== 'SUSPENSO') {
        role = ut.role;
      } else {
        tid = null;
      }
    }

    const accessToken = await this.tokens.assinarAccessToken({
      sub: user.id,
      tid,
      role,
      aud: 'tenant',
    });
    return {
      accessToken,
      refresh: { token: rotated.token, ttlSeconds: this.tokens.refreshTtlSeconds() },
    };
  }

  // ---------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------
  async logout(refreshToken: string | null): Promise<void> {
    if (!refreshToken) return;
    try {
      const rotated = await this.tokens.rotacionarRefreshToken(refreshToken);
      // Rotaciona pra invalidar o jti, depois invalida a família.
      await this.tokens.invalidarFamilia(rotated.family);
    } catch {
      // Já invalido — não há nada para revogar. Silencioso.
    }
  }

  // ---------------------------------------------------------------
  // Forgot / Reset (RULES 3.8)
  // ---------------------------------------------------------------
  async forgot(email: string): Promise<{ token: string | null }> {
    const user = await this.users.buscarPorEmailHash(this.emailHash.hash(email));
    if (!user) {
      // Resposta sempre genérica — não revelar existência.
      this.logger.debug({ msg: 'forgot_email_nao_encontrado' });
      return { token: null };
    }
    const token = await this.tokens.emitirResetToken(user.id);

    // Envia o link de redefinição. Falha de email NÃO vaza para o cliente
    // (resposta segue genérica) — só registramos para diagnóstico.
    const url = `${this.webBaseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    try {
      await this.mail.enviar({
        to: user.email,
        subject: 'Redefinição de senha — Total Campanha',
        html: emailRedefinicaoHtml(url),
        text: `Recebemos um pedido para redefinir sua senha no Total Campanha.\n\nAbra este link para criar uma senha nova (válido por 1 hora):\n${url}\n\nSe não foi você, ignore este e-mail — nada muda.`,
      });
    } catch (err) {
      this.logger.error({ msg: 'forgot_envio_email_falhou', err });
    }
    return { token };
  }

  // ---------------------------------------------------------------
  // Troca de senha autenticada (Minha conta)
  // ---------------------------------------------------------------
  async trocarSenha(userId: string, senhaAtual: string, novaSenha: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const confere = await this.password.verify(user.passwordHash, senhaAtual);
    if (!confere) throw new BadRequestException('Senha atual incorreta.');

    const passwordHash = await this.password.hash(novaSenha);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Invalida as outras sessões — a atual continua até o access token expirar.
    await this.tokens.invalidarTodasSessoes(userId);
  }

  async reset(token: string, novaSenha: string): Promise<void> {
    const userId = await this.tokens.consumirResetToken(token);
    if (!userId) throw new BadRequestException('Token inválido ou expirado.');

    const passwordHash = await this.password.hash(novaSenha);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.tokens.invalidarTodasSessoes(userId);
  }

  // ---------------------------------------------------------------
  // 2FA (TOTP)
  // ---------------------------------------------------------------
  async setup2fa(userId: string): Promise<{ secret: string; otpauthUrl: string; qrcode: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.totpSecret) throw new ConflictException('2FA já habilitado.');

    const secret = this.totp.gerarSecret();
    const otpauthUrl = this.totp.uri(secret, user.email);
    const qrcode = await this.totp.qrcodeDataUrl(secret, user.email);

    // Não persiste ainda — só após verify (evita lock-out se o user não escanear).
    return { secret, otpauthUrl, qrcode };
  }

  async verify2fa(userId: string, secret: string, codigo: string): Promise<void> {
    if (!this.totp.verify(secret, codigo)) {
      throw new BadRequestException('Código inválido.');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });
    await this.tokens.invalidarTodasSessoes(userId);
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  private async emitirSessao(
    userId: string,
    tenantId: string,
    role: Role,
  ): Promise<ResultadoAuth> {
    const accessToken = await this.tokens.assinarAccessToken({
      sub: userId,
      tid: tenantId,
      role,
      aud: 'tenant',
    });
    const refresh = await this.tokens.emitirRefreshToken(userId, tenantId);
    await this.tokens.registrarFamilia(userId, refresh.family);
    return {
      accessToken,
      refresh: { token: refresh.token, ttlSeconds: this.tokens.refreshTtlSeconds() },
    };
  }
}

/** Email transacional de redefinição — HTML simples, sem dependência de MJML. */
function emailRedefinicaoHtml(url: string): string {
  return (
    `<div style="max-width:480px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#020817;">` +
    `<h2 style="font-size:20px;margin:24px 0 8px;">Redefinir sua senha</h2>` +
    `<p style="font-size:14px;line-height:1.6;color:#334155;">Recebemos um pedido para redefinir a senha da sua conta no <strong>Total Campanha</strong>. Clique no botão abaixo para criar uma senha nova. O link vale por 1 hora.</p>` +
    `<p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:#2563EB;color:#F8FAFC;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:6px;">Criar senha nova</a></p>` +
    `<p style="font-size:12px;line-height:1.6;color:#64748B;">Se o botão não funcionar, copie e cole este endereço no navegador:<br/><a href="${url}" style="color:#2563EB;word-break:break-all;">${url}</a></p>` +
    `<p style="font-size:12px;line-height:1.6;color:#64748B;">Se você não pediu isso, pode ignorar este e-mail — sua senha continua a mesma.</p>` +
    `</div>`
  );
}
