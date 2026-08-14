import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:4200',
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
}

void bootstrap();
