import { describe, expect, it } from 'vitest';
import { assertBootEnv } from './boot-env';

describe('assertBootEnv', () => {
  it('throws naming DATABASE_URL when missing or empty', () => {
    expect(() => assertBootEnv({})).toThrow(/DATABASE_URL/);
    expect(() => assertBootEnv({ DATABASE_URL: '  ' })).toThrow(/DATABASE_URL/);
  });

  it('starts with only DATABASE_URL; SESSION_SECRET is no longer needed', () => {
    expect(() => assertBootEnv({ DATABASE_URL: 'postgresql://x' })).not.toThrow();
    // An old .env that still sets it keeps working.
    expect(() =>
      assertBootEnv({
        DATABASE_URL: 'postgresql://x',
        SESSION_SECRET: 'dev-only-change-me-in-production',
      }),
    ).not.toThrow();
  });

  it('accepts an ADMIN_EMAIL that looks like an email address', () => {
    expect(() =>
      assertBootEnv({ DATABASE_URL: 'postgresql://x', ADMIN_EMAIL: 'me@example.com' }),
    ).not.toThrow();
  });

  it('rejects an ADMIN_EMAIL that is not an email address', () => {
    expect(() =>
      assertBootEnv({ DATABASE_URL: 'postgresql://x', ADMIN_EMAIL: 'me at example' }),
    ).toThrow(/ADMIN_EMAIL is not an email address/);
  });

  it('rejects a half-set reminder channel and a bad reminder hour', () => {
    const db = { DATABASE_URL: 'postgresql://x' };
    expect(() => assertBootEnv({ ...db, VAPID_PUBLIC_KEY: 'pub' })).toThrow(/set together/);
    expect(() => assertBootEnv({ ...db, SMTP_HOST: 'smtp.example' })).toThrow(/SMTP_FROM/);
    expect(() => assertBootEnv({ ...db, REMINDER_HOUR: '24' })).toThrow(/REMINDER_HOUR/);
    expect(() => assertBootEnv({ ...db, REMINDER_HOUR: 'seven' })).toThrow(/REMINDER_HOUR/);
    expect(() => assertBootEnv({ ...db, CLIMATE_SOURCE: 'nasa' })).toThrow(/CLIMATE_SOURCE/);
    expect(() => assertBootEnv({ ...db, CLIMATE_SOURCE: 'nasa-power' })).not.toThrow();
    expect(() =>
      assertBootEnv({
        ...db,
        VAPID_PUBLIC_KEY: 'pub',
        VAPID_PRIVATE_KEY: 'priv',
        SMTP_HOST: 'smtp.example',
        SMTP_FROM: 'garden@example.com',
        REMINDER_HOUR: '7',
      }),
    ).not.toThrow();
  });
});
