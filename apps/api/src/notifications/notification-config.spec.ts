import { describe, expect, it } from 'vitest';
import { notificationConfig } from './notification-config';
import { localDay } from './reminder-scheduler';

describe('notificationConfig', () => {
  it('turns a channel on only when it is set up', () => {
    expect(notificationConfig({})).toEqual({
      push: null,
      smtp: null,
      reminderHour: 7,
      appUrl: '',
    });
    const config = notificationConfig({
      VAPID_PUBLIC_KEY: 'pub',
      VAPID_PRIVATE_KEY: 'priv',
      APP_URL: 'https://garden.example',
      SMTP_HOST: 'smtp.example',
      SMTP_FROM: 'garden@example.com',
      SMTP_USER: 'garden',
      SMTP_PASSWORD: 'secret',
      SMTP_PORT: '465',
      REMINDER_HOUR: '6',
    });
    expect(config.push).toEqual({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'https://garden.example',
    });
    expect(config.smtp).toEqual({
      host: 'smtp.example',
      port: 465,
      user: 'garden',
      password: 'secret',
      from: 'garden@example.com',
    });
    expect(config.reminderHour).toBe(6);
    expect(
      notificationConfig({
        VAPID_PUBLIC_KEY: 'pub',
        VAPID_PRIVATE_KEY: 'priv',
        VAPID_SUBJECT: 'mailto:me@example.com',
      }).push?.subject,
    ).toBe('mailto:me@example.com');
    expect(notificationConfig({ SMTP_HOST: 'smtp.example' }).smtp).toBeNull();
  });
});

describe('localDay', () => {
  it('is the server calendar day', () => {
    expect(localDay(new Date(2026, 5, 3, 23, 59))).toBe('2026-06-03');
  });
});
