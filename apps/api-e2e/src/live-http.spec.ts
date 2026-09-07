import { describe, expect, it } from 'vitest';
import { liveEnabled, parseOgSessionCookie } from './live-http';

describe('parseOgSessionCookie', () => {
  it('reads og_session from a Set-Cookie header', () => {
    expect(parseOgSessionCookie('og_session=abc123; Path=/; HttpOnly; SameSite=Lax')).toBe('abc123');
  });

  it('reads og_session from a list of Set-Cookie headers', () => {
    expect(
      parseOgSessionCookie(['other=x; Path=/', 'og_session=tok%2Fval; Path=/; HttpOnly']),
    ).toBe('tok/val');
  });

  it('returns undefined when og_session is missing', () => {
    expect(parseOgSessionCookie('sid=nope; Path=/')).toBeUndefined();
    expect(parseOgSessionCookie(null)).toBeUndefined();
  });
});

describe.skipIf(!liveEnabled)('live HTTP (requires E2E_LIVE=1)', () => {
  it('unauthenticated plants is 401 on the API origin', async () => {
    const res = await fetch('http://localhost:3000/api/plants');
    expect(res.status).toBe(401);
  });
});
