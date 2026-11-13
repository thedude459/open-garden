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
});
