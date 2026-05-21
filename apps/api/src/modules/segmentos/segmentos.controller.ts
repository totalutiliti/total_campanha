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

import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../../common/rbac/roles.decorator.js';
import { TenantRoleGuard } from '../../common/rbac/tenant-role.guard.js';
import { TenantId } from '../../common/tenant/tenant-id.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.type.js';

import { AtualizarSegmentoDto } from './dto/atualizar-segmento.dto.js';
import { CriarSegmentoDto } from './dto/criar-segmento.dto.js';
import { PreviaFiltrosDto } from './dto/previa-filtros.dto.js';
import { SegmentosService } from './segmentos.service.js';

@ApiTags('segmentos')
@Controller('segmentos')
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class SegmentosController {
  constructor(private readonly segmentos: SegmentosService) {}

  @Post()
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  criar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CriarSegmentoDto,
  ): Promise<unknown> {
    return this.segmentos.criar(tenantId, user.sub, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  listar(@TenantId() tenantId: string): Promise<unknown> {
    return this.segmentos.listar(tenantId);
  }

  /**
   * POST /segmentos/previa — usado pelo FiltroBuilder no front, retorna
   * a contagem para um filtro ainda não salvo.
   */
  @Post('previa')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  previa(@TenantId() tenantId: string, @Body() dto: PreviaFiltrosDto) {
    return this.segmentos.previaAdHoc(tenantId, dto.filtros, dto.canal);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  buscar(@TenantId() tenantId: string, @Param('id') id: string): Promise<unknown> {
    return this.segmentos.buscar(tenantId, id);
  }

  @Get(':id/contatos/contagem')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  contar(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.segmentos.contar(tenantId, id);
  }

  @Get(':id/contatos')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  listarContatos(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('pagina') pagina = '1',
    @Query('porPagina') porPagina = '50',
  ): Promise<unknown> {
    const p = Math.max(1, Number(pagina) || 1);
    const pp = Math.min(200, Math.max(1, Number(porPagina) || 50));
    return this.segmentos.listarContatos(tenantId, id, p, pp);
  }

  @Get(':id/previsao')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  previsao(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('canal') canal: 'EMAIL' | 'WHATSAPP',
  ) {
    return this.segmentos.previsao(tenantId, id, canal);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  atualizar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AtualizarSegmentoDto,
  ): Promise<unknown> {
    return this.segmentos.atualizar(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  excluir(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.segmentos.excluir(tenantId, user.sub, id);
  }
}
