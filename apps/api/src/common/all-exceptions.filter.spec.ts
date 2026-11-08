import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, type ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function respond(exception: unknown) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
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

  it('logs the unexpected error on the server', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const err = new Error('Failed query: boom');
    respond(err);
    expect(log).toHaveBeenCalledWith(err);
  });
});
