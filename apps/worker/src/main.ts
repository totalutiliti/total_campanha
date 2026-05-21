import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  // Worker não expõe HTTP — só consome filas. createApplicationContext faz isso.
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  // eslint-disable-next-line no-console
  console.log('[total-campanha/worker] processadores ativos — aguardando jobs.');
}

void bootstrap();
