import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** An id a proxy in front may already have given the request. */
const PASSED_ID = /^[\w-]{1,64}$/;

/** The id of the request a response belongs to, set by {@link requestLog}. */
export function requestIdOf(res: Response): string | undefined {
  const id: unknown = (res.locals as Record<string, unknown> | undefined)?.['requestId'];
  return typeof id === 'string' ? id : undefined;
}

/**
 * Logs each request once it is answered: method, path (never the query, which
 * can carry a reset token), status, milliseconds, and an id. The id is sent
 * back as `X-Request-Id`, and error lines repeat it. Health checks, every few
 * seconds from Docker, log at debug.
 */
export function requestLog(logger = new Logger('HTTP')) {
  return (req: Request, res: Response, next: NextFunction) => {
    const passed = req.headers['x-request-id'];
    const id = typeof passed === 'string' && PASSED_ID.test(passed) ? passed : randomUUID();
    res.locals['requestId'] = id;
    res.setHeader('X-Request-Id', id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
      const path = req.originalUrl.split('?')[0] ?? '';
      const line = `request method=${req.method} path=${path} status=${res.statusCode} ms=${ms} id=${id}`;
      if (path === '/api/health') logger.debug(line);
      else logger.log(line);
    });
    next();
  };
}

/** `LOG_LEVEL` as Nest's list of levels to print; `log` when unset. */
export function logLevels(level = 'log'): ('error' | 'warn' | 'log' | 'debug' | 'verbose')[] {
  const order = ['error', 'warn', 'log', 'debug', 'verbose'] as const;
  const at = order.indexOf(level as (typeof order)[number]);
  return order.slice(0, (at < 0 ? 2 : at) + 1);
}
