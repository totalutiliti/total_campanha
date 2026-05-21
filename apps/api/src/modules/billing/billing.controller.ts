import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@total-campanha/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../../common/rbac/roles.decorator.js';
import { TenantRoleGuard } from '../../common/rbac/tenant-role.guard.js';
import { TenantId } from '../../common/tenant/tenant-id.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.type.js';

import { BillingService } from './billing.service.js';
import { PlanoDto } from './dto/plano.dto.js';

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('atual')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  atual(@TenantId() tenantId: string) {
    return this.billing.atual(tenantId);
  }

  @Post('assinar')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  assinar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PlanoDto,
  ) {
    return this.billing.assinar(tenantId, user.sub, dto.plano);
  }

  @Post('atualizar-plano')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  atualizarPlano(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PlanoDto,
  ) {
    return this.billing.atualizarPlano(tenantId, user.sub, dto.plano);
  }

  @Post('cancelar')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  cancelar(@TenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.billing.cancelar(tenantId, user.sub);
  }
}
