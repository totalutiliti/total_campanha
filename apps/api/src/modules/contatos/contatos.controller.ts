import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@total-campanha/shared';
import type { Request, Response } from 'express';

import { Roles } from '../../common/rbac/roles.decorator.js';
import { TenantRoleGuard } from '../../common/rbac/tenant-role.guard.js';
import { TenantId } from '../../common/tenant/tenant-id.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/jwt-payload.type.js';

import { ContatosService } from './contatos.service.js';
import { AtualizarContatoDto } from './dto/atualizar-contato.dto.js';
import { CriarContatoDto } from './dto/criar-contato.dto.js';
import { ImportarContatosDto } from './dto/importar-contatos.dto.js';
import { ListarContatosDto } from './dto/listar-contatos.dto.js';
import { ExportarContatosService } from './exportar/exportar-contatos.service.js';
import { ImportarContatosService } from './importar/importar-contatos.service.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

@ApiTags('contatos')
@Controller('contatos')
@UseGuards(JwtAuthGuard, TenantRoleGuard)
export class ContatosController {
  constructor(
    private readonly contatos: ContatosService,
    private readonly importar: ImportarContatosService,
    private readonly exportar: ExportarContatosService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  criar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CriarContatoDto,
  ): Promise<unknown> {
    return this.contatos.criar(tenantId, user.sub, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  listar(@TenantId() tenantId: string, @Query() query: ListarContatosDto): Promise<unknown> {
    return this.contatos.listar(tenantId, query);
  }

  @Get('exportar')
  @Roles(Role.ADMIN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="contatos.csv"')
  async exportarCsv(
    @TenantId() tenantId: string,
    @Query('incluirExcluidos') incluirExcluidos: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.exportar.gerarCsv(tenantId, incluirExcluidos === 'true');
    res.send(csv);
  }

  @Post('importar')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async importarCsv(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() arquivo: Express.Multer.File | undefined,
    @Body() dto: ImportarContatosDto,
  ) {
    if (!arquivo) throw new BadRequestException('Arquivo CSV ausente (campo "arquivo").');
    if (arquivo.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`Arquivo excede ${MAX_UPLOAD_BYTES} bytes.`);
    }
    const conteudo = arquivo.buffer.toString('utf8');
    return this.importar.importar(tenantId, user.sub, conteudo, {
      modo: dto.modo,
      optInEmail: false,
      optInWhatsapp: false,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA, Role.VISUALIZADOR)
  buscar(@TenantId() tenantId: string, @Param('id') id: string): Promise<unknown> {
    return this.contatos.buscar(tenantId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  atualizar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AtualizarContatoDto,
  ): Promise<unknown> {
    return this.contatos.atualizar(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.EDITOR_CAMPANHA)
  @HttpCode(HttpStatus.OK)
  excluir(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('lgpd') lgpd: string | undefined,
    @Req() _req: Request,
  ) {
    return this.contatos.excluir(tenantId, user.sub, id, lgpd === 'true');
  }
}
