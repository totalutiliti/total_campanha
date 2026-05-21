import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { SuperAdminController } from './super-admin.controller.js';
import { SuperAdminGuard } from './super-admin.guard.js';
import { SuperAdminPrismaService } from './super-admin-prisma.service.js';
import { SuperAdminService } from './super-admin.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, SuperAdminGuard, SuperAdminPrismaService],
})
export class SuperAdminModule {}
