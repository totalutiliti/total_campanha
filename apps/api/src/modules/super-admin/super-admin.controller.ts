import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.type.js';

import { CriarTenantDto } from './dto/criar-tenant.dto.js';
import { LoginSuperAdminDto } from './dto/login-super-admin.dto.js';
import { SuperAdminGuard } from './super-admin.guard.js';
import { SuperAdminService } from './super-admin.service.js';

/**
 * Escopo Super Admin (TotalUtiliti) — montado em /admin.
 *
 * `/admin/auth/login` é público (Throttle auth). Os demais exigem
 * `SuperAdminGuard` (JWT aud='super-admin' + isSuperAdmin no DB).
 */
@ApiTags('super-admin')
@Controller('admin')
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  login(@Body() dto: LoginSuperAdminDto) {
    return this.service.login(dto.email, dto.senha);
  }

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SuperAdminGuard)
  criarTenant(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CriarTenantDto) {
    return this.service.criarTenant(admin.sub, dto);
  }

  @Get('tenants')
  @UseGuards(SuperAdminGuard)
  listarTenants() {
    return this.service.listarTenants();
  }

  @Get('tenants/:id')
  @UseGuards(SuperAdminGuard)
  detalheTenant(@Param('id') id: string) {
    return this.service.detalheTenant(id);
  }

  @Post('tenants/:id/suspender')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminGuard)
  suspender(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.service.suspenderTenant(admin.sub, id);
  }

  @Post('tenants/:id/impersonate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminGuard)
  impersonate(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.service.impersonate(admin.sub, id);
  }

  @Get('usage')
  @UseGuards(SuperAdminGuard)
  usage() {
    return this.service.usageResumo();
  }

  @Get('usage/por-tenant')
  @UseGuards(SuperAdminGuard)
  usagePorTenant(@Query('desde') desde?: string) {
    return this.service.usagePorTenant(desde ? new Date(desde) : undefined);
  }

  @Get('usage/por-servico')
  @UseGuards(SuperAdminGuard)
  usagePorServico(@Query('desde') desde?: string) {
    return this.service.usagePorServico(desde ? new Date(desde) : undefined);
  }

  @Get('audit')
  @UseGuards(SuperAdminGuard)
  audit(@Query('limite') limite?: string): Promise<unknown> {
    return this.service.auditLog(limite ? Number(limite) : 100);
  }
}
