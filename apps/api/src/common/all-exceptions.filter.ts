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
  TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

/** Codes for Nest's own exceptions (a bad route, bad JSON, a body too large). */
const STATUS_CODE: Record<number, string> = {
  ...Object.fromEntries(Object.entries(DOMAIN_STATUS).map(([code, status]) => [status, code])),
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
};

/**
 * Every error leaves as `{ error: { code, message } }`. Ours already are;
 * Nest's arrive as a string or `{ statusCode, message, error }`.
 */
function httpError(status: number, body: unknown): { code: string; message: string } {
  const ours = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  if (typeof ours?.code === 'string' && typeof ours.message === 'string') {
    return { code: ours.code, message: ours.message };
  }
  const code = STATUS_CODE[status] ?? (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST');
  if (status >= 500) return { code, message: 'An unexpected error occurred' };
  const raw = typeof body === 'string' ? body : (body as { message?: unknown } | null)?.message;
  const message: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  return { code, message: typeof message === 'string' && message ? message : 'Request failed' };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) this.logger.error(exception);
      res.status(status).json({ error: httpError(status, exception.getResponse()) });
      return;
    }

    const rawCode =
      exception && typeof exception === 'object' && 'code' in exception
        ? String(exception.code)
        : 'INTERNAL';
    const isDomain = rawCode in DOMAIN_STATUS;
    if (!isDomain) {
      this.logger.error(exception);
    }
    const message = exception instanceof Error ? exception.message : 'Unexpected error';
    // Only domain errors carry messages written for users. Anything else (a
    // failed query, a driver error) can include SQL and parameters such as
    // password hashes, so it stays in the server log in every environment.
    const exposeDetails = isDomain;
    const httpStatus =
      exception && typeof exception === 'object' && 'httpStatus' in exception
        ? Number((exception as { httpStatus?: unknown }).httpStatus)
        : undefined;
    const status =
      httpStatus && Number.isInteger(httpStatus)
        ? httpStatus
        : (DOMAIN_STATUS[rawCode] ?? HttpStatus.INTERNAL_SERVER_ERROR);

    res.status(status).json({
      error: {
        code: isDomain ? rawCode : 'INTERNAL',
        message: exposeDetails ? message : 'An unexpected error occurred',
      },
    });
  }
}
