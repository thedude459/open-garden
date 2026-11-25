import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { assertBootEnv } from './boot-env';
import { logLevels, requestLog } from './common/request-log';

assertBootEnv();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevels(process.env['LOG_LEVEL']?.trim() || undefined),
  });
  // Docker stops the API with SIGTERM: finish open requests and close the
  // database pool rather than be killed after the grace period.
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  // Names the framework to anyone probing for its known weaknesses; nothing needs it.
  app.disable('x-powered-by');
  app.use(requestLog());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:4200',
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/api`);
}

void bootstrap();
