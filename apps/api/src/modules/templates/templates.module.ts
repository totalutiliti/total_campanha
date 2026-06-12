import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { BibliotecaService } from './biblioteca/biblioteca.service.js';
import { MjmlRenderService } from './render/mjml-render.service.js';
import { TemplatesController } from './templates.controller.js';
import { TemplatesService } from './templates.service.js';
import { MetaTemplatesService } from './whatsapp/meta-templates.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TemplatesController],
  providers: [TemplatesService, MjmlRenderService, MetaTemplatesService, BibliotecaService],
  exports: [TemplatesService, MjmlRenderService],
})
export class TemplatesModule {}
