import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { TenantsController } from './tenants.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [TenantsController],
})
export class TenantsModule {}
