import { Controller, Get, ForbiddenException, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.type.js';

@ApiTags('me')
@Controller()
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /me — usado pelo AuthProvider no frontend após /auth/refresh para
   * popular o contexto com user + tenant atual + lista de tenants disponíveis.
   *
   * Sem guard de Role — qualquer user autenticado consulta seus próprios dados.
   */
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: { userTenants: { include: { tenant: true } } },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado.');

    const tenants = u.userTenants
      .filter((ut) => ut.tenant.status !== 'CANCELADO' && ut.tenant.status !== 'SUSPENSO')
      .map((ut) => ({
        id: ut.tenant.id,
        slug: ut.tenant.slug,
        razaoSocial: ut.tenant.razaoSocial,
        plano: ut.tenant.plano,
        status: ut.tenant.status,
        role: ut.role,
      }));

    return {
      id: u.id,
      email: u.email,
      has2fa: !!u.totpSecret,
      isSuperAdmin: u.isSuperAdmin,
      role: user.role,
      tenantAtual: tenants.find((t) => t.id === user.tid) ?? null,
      tenants,
    };
  }

  /**
   * GET /tenants/atual — atalho conveniência: só os dados do tenant ativo.
   */
  @Get('tenants/atual')
  async tenantAtual(@CurrentUser() user: AuthenticatedUser) {
    if (!user.tid) throw new ForbiddenException('Tenant não selecionado.');
    const t = await this.prisma.tenant.findUnique({ where: { id: user.tid } });
    if (!t) throw new NotFoundException();
    return {
      id: t.id,
      slug: t.slug,
      razaoSocial: t.razaoSocial,
      plano: t.plano,
      status: t.status,
      trialAteEm: t.trialAteEm,
    };
  }
}
