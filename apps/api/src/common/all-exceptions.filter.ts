import {
  Catch,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

const DOMAIN_STATUS: Record<string, HttpStatus> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  CONFLICT: HttpStatus.CONFLICT,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(
        typeof body === 'string'
          ? { error: { code: 'INTERNAL', message: body } }
          : body,
      );
      return;
    }

    const rawCode =
      exception && typeof exception === 'object' && 'code' in exception
        ? String((exception as { code: unknown }).code)
        : 'INTERNAL';
    const isDomain = rawCode in DOMAIN_STATUS;
    if (!isDomain) {
      this.logger.error(exception);
    }
    const message =
      exception instanceof Error ? exception.message : 'Unexpected error';
    const exposeDetails = isDomain || process.env['NODE_ENV'] !== 'production';

    res.status(DOMAIN_STATUS[rawCode] ?? HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: isDomain ? rawCode : 'INTERNAL',
        message: exposeDetails ? message : 'An unexpected error occurred',
      },
    });
  }
}
