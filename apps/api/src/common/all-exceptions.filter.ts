import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
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

    const code =
      exception && typeof exception === 'object' && 'code' in exception
        ? String((exception as { code: string }).code)
        : 'INTERNAL';
    const message =
      exception instanceof Error ? exception.message : 'Unexpected error';
    const status =
      code === 'VALIDATION_ERROR'
        ? HttpStatus.BAD_REQUEST
        : code === 'NOT_FOUND'
          ? HttpStatus.NOT_FOUND
          : code === 'UNAUTHORIZED'
            ? HttpStatus.UNAUTHORIZED
            : HttpStatus.INTERNAL_SERVER_ERROR;

    res.status(status).json({
      error: {
        code: code === 'INTERNAL' ? 'INTERNAL' : code,
        message: code === 'INTERNAL' ? 'An unexpected error occurred' : message,
      },
    });
  }
}
