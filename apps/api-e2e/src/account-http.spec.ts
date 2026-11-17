import { describe, expect, test } from 'vitest';
import { liveEnabled, LiveClient } from './live-http';

describe.skipIf(!liveEnabled)('account http', () => {
  test('a member switches to metric and signing in again keeps it', async () => {
    const request = new LiveClient();
    const email = `units-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const registered = await request.post('/api/auth/register', {
      data: { email, password: 'password123' },
    });
    expect(((await registered.json()) as { user: { units: string } }).user.units).toBe('imperial');

    expect((await request.put('/api/account/units', { data: { units: 'metric' } })).status()).toBe(
      204,
    );
    expect((await request.put('/api/account/units', { data: { units: 'cubits' } })).status()).toBe(
      400,
    );

    const again = await new LiveClient().post('/api/auth/login', {
      data: { email, password: 'password123' },
    });
    expect(((await again.json()) as { user: { units: string } }).user.units).toBe('metric');
  });

  test('units need a session', async () => {
    const res = await new LiveClient().put('/api/account/units', { data: { units: 'metric' } });
    expect(res.status()).toBe(401);
  });

  test('changing the password signs out every other session', async () => {
    const email = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const here = new LiveClient();
    await here.post('/api/auth/register', { data: { email, password: 'password123' } });
    const elsewhere = new LiveClient();
    await elsewhere.post('/api/auth/login', { data: { email, password: 'password123' } });
    expect((await elsewhere.get('/api/gardens')).status()).toBe(200);

    const wrong = await here.put('/api/account/password', {
      data: { currentPassword: 'not-it', newPassword: 'new-password-1' },
    });
    expect(wrong.status()).toBe(400);
    expect(await wrong.text()).toContain('current password is not right');
    const short = await here.put('/api/account/password', {
      data: { currentPassword: 'password123', newPassword: 'short' },
    });
    expect(short.status()).toBe(400);

    const changed = await here.put('/api/account/password', {
      data: { currentPassword: 'password123', newPassword: 'new-password-1' },
    });
    expect(changed.status()).toBe(204);
    expect((await here.get('/api/gardens')).status()).toBe(200);
    expect((await elsewhere.get('/api/gardens')).status()).toBe(401);

    const old = await new LiveClient().post('/api/auth/login', {
      data: { email, password: 'password123' },
    });
    expect(old.status()).toBe(401);
    const fresh = await new LiveClient().post('/api/auth/login', {
      data: { email, password: 'new-password-1' },
    });
    expect(fresh.status()).toBe(200);
  });

  test('five wrong current passwords pause password changes', async () => {
    const email = `pw-limit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const request = new LiveClient();
    await request.post('/api/auth/register', { data: { email, password: 'password123' } });
    const attempt = (currentPassword: string) =>
      request.put('/api/account/password', {
        data: { currentPassword, newPassword: 'new-password-1' },
      });
    for (let i = 0; i < 5; i++) expect((await attempt('guess')).status()).toBe(400);
    const limited = await attempt('password123');
    expect(limited.status()).toBe(429);
    expect(await limited.text()).toContain('Too many attempts');
  });

  test('a password change needs a session', async () => {
    const res = await new LiveClient().put('/api/account/password', {
      data: { currentPassword: 'password123', newPassword: 'new-password-1' },
    });
    expect(res.status()).toBe(401);
  });
});
