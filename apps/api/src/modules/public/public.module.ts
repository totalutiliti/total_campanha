import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { OptInService } from './opt-in.service.js';
import { OptOutTokenService } from './opt-out-token.service.js';
import { OptOutService } from './opt-out.service.js';
import { PublicController } from './public.controller.js';
import { RecaptchaService } from './recaptcha.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PublicController],
  providers: [OptInService, OptOutService, OptOutTokenService, RecaptchaService],
  exports: [OptOutTokenService],
})
export class PublicModule {}
