import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { SegmentosController } from './segmentos.controller.js';
import { SegmentosService } from './segmentos.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SegmentosController],
  providers: [SegmentosService],
  exports: [SegmentosService],
})
export class SegmentosModule {}
