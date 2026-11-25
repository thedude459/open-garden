import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  type ArgumentsHost,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function respond(exception: unknown) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status, locals: { requestId: 'req-7' } }) }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
}

describe('AllExceptionsFilter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps a domain CONFLICT to 409 with its message', () => {
    const err = Object.assign(new Error('An account with this email already exists.'), {
      code: 'CONFLICT',
    });
    expect(respond(err)).toEqual({
      status: 409,
      body: { error: { code: 'CONFLICT', message: 'An account with this email already exists.' } },
    });
  });

  it('maps TOO_MANY_REQUESTS to 429 with its message', () => {
    const err = Object.assign(new Error('Too many attempts. Try again in 15 minutes.'), {
      code: 'TOO_MANY_REQUESTS',
    });
    expect(respond(err).status).toBe(429);
  });

  it('never sends raw query details of an unexpected error, even outside production', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'development');
    const err = new Error(
      'Failed query: insert into "users" ... params: a@example.com,$2b$10$secrethash,E2E,user',
    );
    const { status, body } = respond(err);
    vi.unstubAllEnvs();

    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: 'INTERNAL', message: 'An unexpected error occurred' } });
    expect(JSON.stringify(body)).not.toContain('secrethash');
  });

  it('logs the unexpected error on the server, with its stack and request id', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const err = new Error('Failed query: boom');
    respond(err);
    expect(log).toHaveBeenCalledWith('request.failed id=req-7 Failed query: boom', err.stack);
  });

  describe("Nest's own exceptions leave in the app's error shape", () => {
    it('an unknown route', () => {
      expect(respond(new NotFoundException('Cannot GET /api/nope'))).toEqual({
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'Cannot GET /api/nope' } },
      });
    });

    it('malformed JSON', () => {
      const { status, body } = respond(
        new BadRequestException("Expected property name or '}' in JSON at position 1"),
      );
      expect(status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('a body that is too large, raised with a plain string', () => {
      expect(respond(new PayloadTooLargeException('request entity too large'))).toEqual({
        status: 413,
        body: { error: { code: 'PAYLOAD_TOO_LARGE', message: 'request entity too large' } },
      });
    });

    it('a list of validation messages: the first one', () => {
      const { body } = respond(new BadRequestException(['name is required', 'size is required']));
      expect(body.error.message).toBe('name is required');
    });

    it("keeps an exception already in the app's shape", () => {
      const err = new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Garden not found' },
      });
      expect(respond(err).body).toEqual({
        error: { code: 'NOT_FOUND', message: 'Garden not found' },
      });
    });

    it('hides and logs a server error', () => {
      const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const { status, body } = respond(
        new InternalServerErrorException('pool exhausted at db:5432'),
      );
      expect(status).toBe(500);
      expect(body).toEqual({
        error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
      });
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('request.failed id=req-7 pool exhausted'),
        expect.any(String),
      );
    });
  });
});
