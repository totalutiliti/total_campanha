import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailHashService } from './email-hash.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { TotpService } from './totp.service.js';

@Module({
  imports: [
    JwtModule.register({}), // configurações são passadas por chamada — usa secrets do env via TokenService.
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    EmailHashService,
    TokenService,
    TotpService,
    JwtAuthGuard,
  ],
  exports: [TokenService, JwtAuthGuard, PasswordService, EmailHashService],
})
export class AuthModule {}
