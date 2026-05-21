import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from '../auth/auth.module.js';

import { ContatosController } from './contatos.controller.js';
import { ContatosService } from './contatos.service.js';
import { ExportarContatosService } from './exportar/exportar-contatos.service.js';
import { ImportarContatosService } from './importar/importar-contatos.service.js';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: 'contatos-importar' }),
  ],
  controllers: [ContatosController],
  providers: [ContatosService, ImportarContatosService, ExportarContatosService],
  exports: [ContatosService],
})
export class ContatosModule {}
