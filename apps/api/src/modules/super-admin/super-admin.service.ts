import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@total-campanha/db';
import { Role } from '@total-campanha/shared';

import { EmailHashService } from '../auth/email-hash.service.js';
import { PasswordService } from '../auth/password.service.js';
import { TokenService } from '../auth/token.service.js';

import { SuperAdminPrismaService } from './super-admin-prisma.service.js';

/** MRR de referência por plano (R$). Substituído por dado real do Asaas (Fase 6.2). */
const MRR_POR_PLANO: Record<string, number> = {
  STARTER: 97,
  PRO: 297,
  ENTERPRISE: 997,
};

@Injectable()
export class SuperAdminService {
  constructor(
    // Conexão BYPASSRLS — Super Admin é cross-tenant (RULES 1.6).
    private readonly prisma: SuperAdminPrismaService,
    private readonly password: PasswordService,
    private readonly emailHash: EmailHashService,
    private readonly tokens: TokenService,
  ) {}

  // -------------------------------------------------------------------------
  // Login Super Admin → JWT aud='super-admin'.
  // -------------------------------------------------------------------------
  async login(email: string, senha: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { emailHash: this.emailHash.hash(email) },
    });
    // Mensagem genérica — não revela se o email existe nem se é super admin.
    const generico = new UnauthorizedException('Credenciais inválidas.');
    if (!user || !user.isSuperAdmin) throw generico;
    if (!(await this.password.verify(user.passwordHash, senha))) throw generico;

    const accessToken = await this.tokens.assinarAccessToken({
      sub: user.id,
      tid: null,
      role: null,
      aud: 'super-admin',
    });
    return { accessToken };
  }

  // -------------------------------------------------------------------------
  // Tenants
  // -------------------------------------------------------------------------

  /**
   * Cria um tenant + primeiro usuário ADMIN (provisionamento pelo operador).
   * Gera uma senha temporária — devolvida UMA vez para o Super Admin repassar;
   * o cliente troca no primeiro acesso (fluxo "esqueci a senha").
   */
  async criarTenant(
    superAdminId: string,
    dto: {
      slug: string;
      cnpj: string;
      razaoSocial: string;
      emailAdmin: string;
      plano?: 'STARTER' | 'PRO' | 'ENTERPRISE';
    },
  ) {
    const emailHash = this.emailHash.hash(dto.emailAdmin);
    const [emailExistente, slugExistente, cnpjExistente] = await Promise.all([
      this.prisma.user.findUnique({ where: { emailHash } }),
      this.prisma.tenant.findUnique({ where: { slug: dto.slug } }),
      this.prisma.tenant.findUnique({ where: { cnpj: dto.cnpj } }),
    ]);
    if (emailExistente) throw new ConflictException('E-mail já cadastrado.');
    if (slugExistente) throw new ConflictException('Identificador (slug) já em uso.');
    if (cnpjExistente) throw new ConflictException('CNPJ já cadastrado.');

    // Senha temporária forte (96 bits). Não é persistida em texto puro — só o
    // hash Argon2id fica no banco; o texto é devolvido uma única vez.
    const senhaTemporaria = randomBytes(12).toString('base64url');
    const passwordHash = await this.password.hash(senhaTemporaria);

    const tenant = await this.prisma.tenant.create({
      data: {
        slug: dto.slug,
        cnpj: dto.cnpj,
        razaoSocial: dto.razaoSocial,
        plano: dto.plano ?? 'STARTER',
        status: 'TRIAL',
        trialAteEm: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        userTenants: {
          create: {
            role: Role.ADMIN,
            user: { create: { email: dto.emailAdmin, emailHash, passwordHash } },
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: superAdminId,
        acao: 'superadmin.tenant.criar',
        recurso: tenant.id,
        dados: { slug: dto.slug, cnpj: dto.cnpj, emailAdmin: dto.emailAdmin, plano: tenant.plano },
      },
    });

    return {
      id: tenant.id,
      slug: tenant.slug,
      razaoSocial: tenant.razaoSocial,
      emailAdmin: dto.emailAdmin,
      senhaTemporaria,
    };
  }

  async listarTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { userTenants: true },
    });

    // Último disparo e último uso por tenant — queries agregadas globais.
    const ultimasCampanhas = await this.prisma.campanha.groupBy({
      by: ['tenantId'],
      _max: { iniciadaEm: true },
    });
    const mapaCampanha = new Map(
      ultimasCampanhas.map((c) => [c.tenantId, c._max.iniciadaEm]),
    );

    return tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      razaoSocial: t.razaoSocial,
      cnpj: t.cnpj,
      plano: t.plano,
      status: t.status,
      trialAteEm: t.trialAteEm,
      usuarios: t.userTenants.length,
      mrrBrl: t.status === 'ATIVO' ? (MRR_POR_PLANO[t.plano] ?? 0) : 0,
      ultimoDisparo: mapaCampanha.get(t.id) ?? null,
      createdAt: t.createdAt,
    }));
  }

  async detalheTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { userTenants: { include: { user: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    const [contatos, campanhas, custoTotal] = await Promise.all([
      this.prisma.contato.count({ where: { tenantId: id } }),
      this.prisma.campanha.count({ where: { tenantId: id } }),
      this.prisma.usageLog.aggregate({
        where: { tenantId: id },
        _sum: { custoEstimadoBrl: true },
      }),
    ]);

    return {
      id: tenant.id,
      slug: tenant.slug,
      razaoSocial: tenant.razaoSocial,
      cnpj: tenant.cnpj,
      plano: tenant.plano,
      status: tenant.status,
      trialAteEm: tenant.trialAteEm,
      createdAt: tenant.createdAt,
      usuarios: tenant.userTenants.map((ut) => ({
        id: ut.user.id,
        email: ut.user.email,
        role: ut.role,
      })),
      metricas: {
        contatos,
        campanhas,
        custoTotalBrl: custoTotal._sum.custoEstimadoBrl?.toString() ?? '0',
      },
    };
  }

  async suspenderTenant(superAdminId: string, id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    const r = await this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENSO' },
    });
    // Audit do Super Admin: tenantId nulo (RULES — ação cross-tenant).
    await this.prisma.auditLog.create({
      data: {
        tenantId: null,
        userId: superAdminId,
        acao: 'superadmin.tenant.suspender',
        recurso: id,
        dados: { slug: tenant.slug },
      },
    });
    return r;
  }

  /**
   * Impersonate: gera um JWT tenant-scoped temporário (15min) para o Super
   * Admin operar dentro do tenant. Audita sempre (RULES 1.6).
   */
  async impersonate(
    superAdminId: string,
    tenantId: string,
  ): Promise<{ accessToken: string; expiraEm: string }> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    const adminUt = await this.prisma.userTenant.findFirst({
      where: { tenantId, role: Role.ADMIN },
    });
    if (!adminUt) {
      throw new BadRequestException('Tenant não tem usuário ADMIN para impersonar.');
    }

    // Token curto: 15min é o TTL padrão do access token (TokenService).
    const accessToken = await this.tokens.assinarAccessToken({
      sub: adminUt.userId,
      tid: tenantId,
      role: Role.ADMIN,
      aud: 'tenant',
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: superAdminId,
        acao: 'superadmin.tenant.impersonate',
        recurso: tenantId,
        dados: { tenantSlug: tenant.slug, comoUserId: adminUt.userId },
      },
    });

    return {
      accessToken,
      expiraEm: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Custos (RULES 6.3 — painel desde o dia 1)
  // -------------------------------------------------------------------------
  async usageResumo() {
    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioSemana = new Date(inicioDia.getTime() - 7 * 86_400_000);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    const somaDesde = async (desde: Date) => {
      const r = await this.prisma.usageLog.aggregate({
        where: { createdAt: { gte: desde } },
        _sum: { custoEstimadoBrl: true },
      });
      return Number(r._sum.custoEstimadoBrl ?? 0);
    };

    return {
      hojeBrl: await somaDesde(inicioDia),
      semanaBrl: await somaDesde(inicioSemana),
      mesBrl: await somaDesde(inicioMes),
    };
  }

  async usagePorTenant(desde?: Date) {
    const grupos = await this.prisma.usageLog.groupBy({
      by: ['tenantId'],
      where: desde ? { createdAt: { gte: desde } } : {},
      _sum: { custoEstimadoBrl: true },
      _count: { _all: true },
    });
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: grupos.map((g) => g.tenantId) } },
      select: { id: true, slug: true, razaoSocial: true },
    });
    const mapa = new Map(tenants.map((t) => [t.id, t]));
    return grupos
      .map((g) => ({
        tenantId: g.tenantId,
        slug: mapa.get(g.tenantId)?.slug ?? '(desconhecido)',
        razaoSocial: mapa.get(g.tenantId)?.razaoSocial ?? '',
        chamadas: g._count._all,
        custoBrl: Number(g._sum.custoEstimadoBrl ?? 0),
      }))
      .sort((a, b) => b.custoBrl - a.custoBrl);
  }

  async usagePorServico(desde?: Date) {
    const grupos = await this.prisma.usageLog.groupBy({
      by: ['servico'],
      where: desde ? { createdAt: { gte: desde } } : {},
      _sum: { custoEstimadoBrl: true },
      _count: { _all: true },
    });
    return grupos
      .map((g) => ({
        servico: g.servico,
        chamadas: g._count._all,
        custoBrl: Number(g._sum.custoEstimadoBrl ?? 0),
      }))
      .sort((a, b) => b.custoBrl - a.custoBrl);
  }

  // -------------------------------------------------------------------------
  // Auditoria
  // -------------------------------------------------------------------------
  async auditLog(limite = 100) {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limite, 500),
    });
    // BigInt id → string para serialização JSON.
    return logs.map((l) => ({
      id: l.id.toString(),
      tenantId: l.tenantId,
      userId: l.userId,
      acao: l.acao,
      recurso: l.recurso,
      dados: l.dados as Prisma.JsonValue,
      createdAt: l.createdAt,
    }));
  }
}
