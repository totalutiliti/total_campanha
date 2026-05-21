import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { ConexaoEmailService } from './conexao-email.service.js';
import { ConexaoWhatsappService } from './conexao-whatsapp.service.js';
import { ConexoesController } from './conexoes.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [ConexoesController],
  providers: [ConexaoWhatsappService, ConexaoEmailService],
  exports: [ConexaoWhatsappService, ConexaoEmailService],
})
export class ConexoesModule {}
