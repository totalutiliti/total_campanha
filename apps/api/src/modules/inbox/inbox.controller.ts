import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@total-campanha/shared';

import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../../common/rbac/roles.decorator.js';
import { TenantRoleGuard } from '../../common/rbac/tenant-role.guard.js';
import { TenantId } from '../../common/tenant/tenant-id.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.type.js';

import { InboxService } from './inbox.service.js';
import { ResponderDto } from './dto/responder.dto.js';

@ApiTags('inbox')
@Controller('inbox')
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get('conversas')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  listarConversas(@TenantId() tenantId: string, @Query('status') status?: string) {
    return this.inbox.listarConversas(tenantId, status);
  }

  @Get('conversas/:id/mensagens')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  listarMensagens(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.inbox.listarMensagens(tenantId, id);
  }

  @Post('conversas/:id/responder')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  responder(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResponderDto,
  ) {
    return this.inbox.responder(tenantId, user.sub, id, dto.conteudo);
  }
}
