import { afterEach, describe, expect, it } from 'vitest';
import { sessionCookieOptions } from './session-cookie';

describe('sessionCookieOptions', () => {
  const origCookie = process.env['COOKIE_SECURE'];
  const origNode = process.env['NODE_ENV'];

  afterEach(() => {
    if (origCookie === undefined) delete process.env['COOKIE_SECURE'];
    else process.env['COOKIE_SECURE'] = origCookie;
    if (origNode === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = origNode;
  });

  it('sets secure only when COOKIE_SECURE=true', () => {
    process.env['COOKIE_SECURE'] = 'true';
    process.env['NODE_ENV'] = 'development';
    expect(sessionCookieOptions().secure).toBe(true);
  });

  it('does not set secure from NODE_ENV=production alone', () => {
    delete process.env['COOKIE_SECURE'];
    process.env['NODE_ENV'] = 'production';
    expect(sessionCookieOptions().secure).toBe(false);
  });

  it('keeps httpOnly, sameSite lax, and path /', () => {
    const opts = sessionCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
  });
});
