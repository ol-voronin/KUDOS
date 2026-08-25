// Мусить іти першим: решта модулів читає process.env на етапі імпорту.
// Шукає .env поруч із apps/api — там символьне посилання на корінь монорепо.
import 'dotenv/config';
import 'reflect-metadata';
import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === '__replace_me__') {
    throw new Error(
      `${name} все ще має значення __replace_me__. Згенеруйте секрет:\n` +
      `  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    );
  }
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function bootstrap(): Promise<void> {
  // Fail fast at boot rather than at the first request that needs a secret.
  requiredEnv('DATABASE_URL');
  requiredEnv('JWT_ACCESS_SECRET');
  requiredEnv('JWT_REFRESH_SECRET');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // The Monobank webhook must verify a signature over the exact raw bytes
    // of the request body — Nest stashes them on `req.rawBody` when this is on.
    rawBody: true,
  });

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalFilters(new HttpExceptionFilter());

  const origins = (process.env['CORS_ORIGINS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (origins.includes('*')) {
    throw new Error('CORS_ORIGINS must not contain a wildcard');
  }
  app.enableCors({ origin: origins, credentials: true, maxAge: 600 });

  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Doggie Tale API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env['PORT'] ?? 4000);
  await app.listen(port);
  new Logger('bootstrap').log(`API listening on :${port}`);
}

void bootstrap();
