import 'reflect-metadata';

import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { env } from './config/config.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.flushLogs();

  const config = app.get(ConfigService);
  const nodeEnv = env(config, 'NODE_ENV');
  const port = env(config, 'API_PORT');

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  app.enableCors({
    origin: env(config, 'CORS_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  });

  // Global pipe é o ZodValidationPipe (registrado via APP_PIPE em AppModule),
  // que valida DTOs criados com createZodDto. Não precisamos do ValidationPipe.

  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger disponível APENAS em development/staging (BOOTSTRAP 1.1).
  if (nodeEnv !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('Total Campanha API')
      .setDescription('Plataforma SaaS B2B de campanhas Email + WhatsApp (BYOA).')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .build();
    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[total-campanha/api] listening on http://0.0.0.0:${port}/api/v1 (${nodeEnv})`);
}

void bootstrap();
