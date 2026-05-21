import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from '../auth/auth.module.js';
import { SegmentosModule } from '../segmentos/segmentos.module.js';

import { CampanhasController } from './campanhas.controller.js';
import { CampanhasDispatchService } from './campanhas-dispatch.service.js';
import { CampanhasService } from './campanhas.service.js';

@Module({
  imports: [
    AuthModule,
    SegmentosModule,
    BullModule.registerQueue({ name: 'dispatch-email' }, { name: 'dispatch-whatsapp' }),
  ],
  controllers: [CampanhasController],
  providers: [CampanhasService, CampanhasDispatchService],
  exports: [CampanhasService],
})
export class CampanhasModule {}
