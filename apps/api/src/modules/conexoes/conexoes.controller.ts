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

import { ConexaoEmailService } from './conexao-email.service.js';
import { ConexaoWhatsappService } from './conexao-whatsapp.service.js';
import { AtualizarConexaoWhatsappDto } from './dto/atualizar-conexao-whatsapp.dto.js';
import { CriarConexaoEmailDto } from './dto/criar-conexao-email.dto.js';
import { CriarConexaoWhatsappDto } from './dto/criar-conexao-whatsapp.dto.js';
import { EnviarTesteWhatsappDto } from './dto/enviar-teste-whatsapp.dto.js';

@ApiTags('conexoes')
@Controller('conexoes')
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class ConexoesController {
  constructor(
    private readonly whatsapp: ConexaoWhatsappService,
    private readonly email: ConexaoEmailService,
  ) {}

  // -------------------------------------------------------------------------
  // WhatsApp
  // -------------------------------------------------------------------------
  @Post('whatsapp')
  @Roles(Role.ADMIN)
  criarWhatsapp(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CriarConexaoWhatsappDto,
  ) {
    return this.whatsapp.criar(tenantId, user.sub, dto);
  }

  @Get('whatsapp')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  buscarWhatsapp(@TenantId() tenantId: string) {
    return this.whatsapp.buscar(tenantId);
  }

  @Patch('whatsapp')
  @Roles(Role.ADMIN)
  atualizarWhatsapp(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AtualizarConexaoWhatsappDto,
  ) {
    return this.whatsapp.atualizar(tenantId, user.sub, dto);
  }

  @Delete('whatsapp')
  @Roles(Role.ADMIN)
  excluirWhatsapp(@TenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.whatsapp.excluir(tenantId, user.sub);
  }

  @Post('whatsapp/testar')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  testarWhatsapp(@TenantId() tenantId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.whatsapp.testar(tenantId, user.sub);
  }

  @Post('whatsapp/enviar-teste')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  enviarTesteWhatsapp(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnviarTesteWhatsappDto,
  ) {
    return this.whatsapp.enviarTeste(tenantId, user.sub, dto.telefoneE164);
  }

  // -------------------------------------------------------------------------
  // Email
  // -------------------------------------------------------------------------
  @Post('email')
  @Roles(Role.ADMIN)
  criarEmail(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CriarConexaoEmailDto,
  ) {
    return this.email.criar(tenantId, user.sub, dto);
  }

  @Get('email')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  listarEmail(@TenantId() tenantId: string) {
    return this.email.listar(tenantId);
  }

  @Post('email/:id/verificar')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  verificarEmail(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.email.verificar(tenantId, user.sub, id);
  }

  @Delete('email/:id')
  @Roles(Role.ADMIN)
  excluirEmail(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.email.excluir(tenantId, user.sub, id);
  }
}
