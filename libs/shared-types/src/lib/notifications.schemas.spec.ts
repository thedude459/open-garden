import { describe, expect, it } from 'vitest';
import { emailDigestSchema, isPushServiceUrl, pushSubscriptionSchema } from './reminders.schemas';

describe('push subscriptions', () => {
  it('accepts only the browsers’ push services over https', () => {
    expect(isPushServiceUrl('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushServiceUrl('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isPushServiceUrl('https://web.push.apple.com/QG8')).toBe(true);
    expect(isPushServiceUrl('https://wns2-par02p.notify.windows.com/w/?token=1')).toBe(true);
    expect(isPushServiceUrl('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(isPushServiceUrl('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(isPushServiceUrl('https://169.254.169.254/latest')).toBe(false);
    expect(isPushServiceUrl('https://fcm.googleapis.com.evil.example/x')).toBe(false);
    expect(isPushServiceUrl('https://notify.windows.com.evil.example/x')).toBe(false);
    expect(isPushServiceUrl('not a url')).toBe(false);
  });

  it('needs base64url keys of a bounded size', () => {
    const ok = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      keys: { p256dh: 'BNc-abc_123', auth: 'tBHI' },
    };
    expect(pushSubscriptionSchema.safeParse(ok).success).toBe(true);
    expect(
      pushSubscriptionSchema.safeParse({ ...ok, keys: { p256dh: 'has space', auth: 'x' } }).success,
    ).toBe(false);
    expect(
      pushSubscriptionSchema.safeParse({ ...ok, keys: { p256dh: 'a'.repeat(300), auth: 'x' } })
        .success,
    ).toBe(false);
    expect(emailDigestSchema.safeParse({ enabled: 'yes' }).success).toBe(false);
  });
});
