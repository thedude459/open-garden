import { describe, expect, test } from 'vitest';
import { liveEnabled, LiveClient } from './live-http';

// The e2e stack sets VAPID keys (generated per run) and no SMTP server.
describe.skipIf(!liveEnabled)('notifications http', () => {
  type Settings = {
    pushAvailable: boolean;
    vapidPublicKey: string | null;
    emailAvailable: boolean;
    emailDigest: boolean;
    pushDevices: number;
    reminderHour: number;
  };

  async function member(): Promise<LiveClient> {
    const request = new LiveClient();
    const email = `notify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const res = await request.post('/api/auth/register', {
      data: { email, password: 'password123' },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    return request;
  }

  const device = (id: string) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${id}`,
    keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' },
  });

  test('settings need a session', async () => {
    const res = await new LiveClient().get('/api/notifications');
    expect(res.status()).toBe(401);
  });

  test('a member turns push on and off for a device; settings show it', async () => {
    const request = await member();
    const before = (await (await request.get('/api/notifications')).json()) as Settings;
    expect(before).toMatchObject({ pushAvailable: true, emailAvailable: false, pushDevices: 0 });
    expect(before.vapidPublicKey).toMatch(/^[A-Za-z0-9_-]+$/);

    const id = Math.random().toString(36).slice(2);
    expect((await request.put('/api/notifications/push', { data: device(id) })).status()).toBe(204);
    // The same device again is not a second device.
    expect((await request.put('/api/notifications/push', { data: device(id) })).status()).toBe(204);
    let settings = (await (await request.get('/api/notifications')).json()) as Settings;
    expect(settings.pushDevices).toBe(1);

    const off = await request.delete('/api/notifications/push', {
      data: { endpoint: device(id).endpoint },
    });
    expect(off.status()).toBe(204);
    settings = (await (await request.get('/api/notifications')).json()) as Settings;
    expect(settings.pushDevices).toBe(0);
  });

  test('refuses an endpoint that is not a browser push service', async () => {
    const request = await member();
    const res = await request.put('/api/notifications/push', {
      data: { ...device('x'), endpoint: 'https://169.254.169.254/latest/meta-data' },
    });
    expect(res.status()).toBe(400);
  });

  test('email cannot be turned on without SMTP, and off is always allowed', async () => {
    const request = await member();
    const on = await request.put('/api/notifications/email', { data: { enabled: true } });
    expect(on.status()).toBe(400);
    expect(await on.text()).toContain('Email reminders are not set up');
    const off = await request.put('/api/notifications/email', { data: { enabled: false } });
    expect(off.status()).toBe(204);
  });
});
