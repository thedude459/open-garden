import { EventEmitter } from 'node:events';
import type { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { logLevels, requestIdOf, requestLog } from './request-log';

function run(url: string, headers: Record<string, string> = {}, status = 200) {
  const logger = { log: vi.fn(), debug: vi.fn() };
  const res = Object.assign(new EventEmitter(), {
    locals: {},
    statusCode: status,
    setHeader: vi.fn(),
  });
  const next = vi.fn() as NextFunction;
  requestLog(logger as unknown as Logger)(
    { method: 'POST', originalUrl: url, headers } as unknown as Request,
    res as unknown as Response,
    next,
  );
  res.emit('finish');
  return { logger, res, next };
}

describe('requestLog', () => {
  it('logs method, path, status, time and id once answered, and sends the id back', () => {
    const { logger, res, next } = run('/api/auth/login', {}, 401);
    expect(next).toHaveBeenCalled();
    const id = requestIdOf(res as unknown as Response);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', id);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^request method=POST path=/api/auth/login status=401 ms=\\d+ id=${id}$`),
      ),
    );
  });

  it('never logs the query, which can carry a reset token', () => {
    const { logger } = run('/api/auth/password-reset?token=secret-token');
    expect(logger.log.mock.calls[0]?.[0]).not.toContain('secret-token');
  });

  it('keeps an id a proxy gave, and replaces one that is not plain', () => {
    expect(
      requestIdOf(run('/api/x', { 'x-request-id': 'edge-42' }).res as unknown as Response),
    ).toBe('edge-42');
    const odd = run('/api/x', { 'x-request-id': 'a b\nforged=1' });
    expect(requestIdOf(odd.res as unknown as Response)).not.toContain('forged');
  });

  it('logs health checks at debug only', () => {
    const { logger } = run('/api/health');
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });
});

describe('logLevels', () => {
  it('prints the named level and everything more severe', () => {
    expect(logLevels()).toEqual(['error', 'warn', 'log']);
    expect(logLevels('warn')).toEqual(['error', 'warn']);
    expect(logLevels('debug')).toEqual(['error', 'warn', 'log', 'debug']);
  });
});
