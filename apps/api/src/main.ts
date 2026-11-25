import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { assertBootEnv } from './boot-env';
import { logLevels, requestLog } from './common/request-log';

assertBootEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: logLevels(process.env['LOG_LEVEL']?.trim() || undefined),
  });
  // Docker stops the API with SIGTERM: finish open requests and close the
  // database pool rather than be killed after the grace period.
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
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
