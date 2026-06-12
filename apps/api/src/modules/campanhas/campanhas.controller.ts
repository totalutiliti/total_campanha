import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@total-campanha/shared';

import { Roles } from '../../common/rbac/roles.decorator.js';
import { TenantRoleGuard } from '../../common/rbac/tenant-role.guard.js';
import { TenantId } from '../../common/tenant/tenant-id.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.type.js';

import { CampanhasDispatchService } from './campanhas-dispatch.service.js';
import { CampanhasService } from './campanhas.service.js';
import { AtualizarCampanhaDto } from './dto/atualizar-campanha.dto.js';
import { CriarCampanhaDto } from './dto/criar-campanha.dto.js';

@ApiTags('campanhas')
@Controller('campanhas')
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class CampanhasController {
  constructor(
    private readonly campanhas: CampanhasService,
    private readonly dispatch: CampanhasDispatchService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  criar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CriarCampanhaDto,
  ): Promise<unknown> {
    return this.campanhas.criar(tenantId, user.sub, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  listar(@TenantId() tenantId: string): Promise<unknown> {
    return this.campanhas.listar(tenantId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  buscar(@TenantId() tenantId: string, @Param('id') id: string): Promise<unknown> {
    return this.campanhas.buscar(tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  atualizar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AtualizarCampanhaDto,
  ): Promise<unknown> {
    return this.campanhas.atualizar(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  excluir(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.campanhas.excluir(tenantId, user.sub, id);
  }

  @Post(':id/calcular-estimativa')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  estimativa(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.campanhas.calcularEstimativa(tenantId, id);
  }

  @Post(':id/disparar')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  disparar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.dispatch.disparar(tenantId, user.sub, id);
  }

  @Post(':id/pausar')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  pausar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.campanhas.pausar(tenantId, user.sub, id);
  }

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  cancelar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.campanhas.cancelar(tenantId, user.sub, id);
  }

  @Get(':id/analytics')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  analytics(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.campanhas.analytics(tenantId, id);
  }
}
