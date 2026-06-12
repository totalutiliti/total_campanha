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
  Query,
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

import { BibliotecaService } from './biblioteca/biblioteca.service.js';
import { AtualizarTemplateDto } from './dto/atualizar-template.dto.js';
import { CriarTemplateDto } from './dto/criar-template.dto.js';
import { PreviewTemplateDto } from './dto/preview-template.dto.js';
import { TesteEnvioDto } from './dto/teste-envio.dto.js';
import { TemplatesService } from './templates.service.js';
import { MetaTemplatesService } from './whatsapp/meta-templates.service.js';

@ApiTags('templates')
@Controller('templates')
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class TemplatesController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly biblioteca: BibliotecaService,
    private readonly meta: MetaTemplatesService,
  ) {}

  // -----------------------------------------------------------------
  // Biblioteca (sem tenant scope — JSONs estáticos)
  // -----------------------------------------------------------------
  @Get('biblioteca')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  listarBiblioteca(@Query('vertical') vertical?: string) {
    if (!vertical) return this.biblioteca.listarVerticais();
    return this.biblioteca.listarPorVertical(vertical);
  }

  // -----------------------------------------------------------------
  // WhatsApp — proxy para Meta API
  // -----------------------------------------------------------------
  @Get('whatsapp/aprovados-na-meta')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  aprovadosNaMeta(@TenantId() tenantId: string) {
    return this.meta.listarAprovados(tenantId);
  }

  // -----------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------
  @Post()
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  criar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CriarTemplateDto,
  ): Promise<unknown> {
    return this.templates.criar(tenantId, user.sub, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  listar(
    @TenantId() tenantId: string,
    @Query('canal') canal?: 'EMAIL' | 'WHATSAPP',
  ): Promise<unknown> {
    return this.templates.listar(tenantId, canal);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  buscar(@TenantId() tenantId: string, @Param('id') id: string): Promise<unknown> {
    return this.templates.buscar(tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  atualizar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AtualizarTemplateDto,
  ): Promise<unknown> {
    return this.templates.atualizar(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  excluir(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.templates.excluir(tenantId, user.sub, id);
  }

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  preview(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: PreviewTemplateDto,
  ) {
    return this.templates.preview(tenantId, id, dto);
  }

  @Post(':id/teste-envio')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  testeEnvio(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TesteEnvioDto,
  ) {
    return this.templates.testeEnvio(tenantId, user.sub, id, dto);
  }
}
