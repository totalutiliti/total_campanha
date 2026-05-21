import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';

import { Env, loadEnv } from './env.js';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => loadEnv(raw),
    }),
  ],
  exports: [NestConfigModule],
})
export class AppConfigModule {}

// Helper tipado para acessar env validado.
//
// O schema Zod (loadEnv) já valida no boot: vars obrigatórias ausentes derrubam
// a aplicação ali. Vars `.optional()` podem legitimamente retornar `undefined` —
// por isso este helper NÃO lança; apenas devolve o valor tipado.
export function env<K extends keyof Env>(config: ConfigService, key: K): Env[K] {
  return config.get<Env[K]>(key as string) as Env[K];
}
