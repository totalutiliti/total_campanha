import { SetMetadata } from '@nestjs/common';

/**
 * Marca um handler/controller como público (pula o JwtAuthGuard).
 * Útil para login/signup/webhooks/opt-in.
 */
export const IS_PUBLIC_KEY = 'tc:isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
