import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@total-campanha/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../../common/rbac/roles.decorator.js';
import { TenantRoleGuard } from '../../common/rbac/tenant-role.guard.js';
import { TenantId } from '../../common/tenant/tenant-id.decorator.js';

import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  dashboard(@TenantId() tenantId: string) {
    return this.analytics.dashboard(tenantId);
  }

  @Get('comparativo')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  comparativo(@TenantId() tenantId: string, @Query('campanhaIds') campanhaIds?: string) {
    const ids = (campanhaIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.analytics.comparativo(tenantId, ids);
  }
}
