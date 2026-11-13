import { describe, expect, it } from 'vitest';
import { API_ORIGIN, TEST_PASSWORD, liveEnabled, uniqueEmail } from './live-http';

async function register(email: string) {
  const res = await fetch(`${API_ORIGIN}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, displayName: 'E2E' }),
  });
  return { status: res.status, text: await res.text() };
}

describe.skipIf(!liveEnabled)('register (requires E2E_LIVE=1)', () => {
  it('returns 409 without query details when the email is taken', async () => {
    const email = uniqueEmail('dup');
    expect((await register(email)).status).toBe(201);

    const again = await register(email.toUpperCase());
    expect(again.status).toBe(409);
    expect(JSON.parse(again.text)).toEqual({
      error: {
        code: 'CONFLICT',
        message: 'An account with this email already exists. Sign in instead.',
      },
    });
    expect(again.text).not.toMatch(/Failed query|password_hash|\$2[aby]\$/);
  });

  it('gives one account and one 409 when two sign-ups race for the same email', async () => {
    const email = uniqueEmail('race');
    const results = await Promise.all([register(email), register(email)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe.skipIf(!liveEnabled)('sign-in limits (requires E2E_LIVE=1)', () => {
  async function login(email: string, password: string) {
    const res = await fetch(`${API_ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return { status: res.status, body: (await res.json()) as { error?: { message?: string } } };
  }

  it('locks an address for a while after five wrong passwords, even for the right one', async () => {
    const email = uniqueEmail('limit');
    expect((await register(email)).status).toBe(201);
    for (let i = 0; i < 5; i++) {
      expect((await login(email, 'not-the-password')).status).toBe(401);
    }
    const blocked = await login(email, TEST_PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error?.message).toMatch(/Too many attempts\. Try again in \d+ minutes?\./);
  });
});
