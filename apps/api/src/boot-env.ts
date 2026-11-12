const REQUIRED = ['DATABASE_URL'] as const;

/**
 * Fail fast on configuration the API cannot run with. Sessions are random
 * tokens stored hashed in Postgres, so there is no signing secret to check.
 */
export function assertBootEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const key of REQUIRED) {
    const value = env[key];
    if (value === undefined || value.trim() === '') {
      throw new Error(`${key} is required`);
    }
  }
  // Reminders: a half-set channel is a mistake worth stopping for.
  const vapidPublic = Boolean(env['VAPID_PUBLIC_KEY']?.trim());
  const vapidPrivate = Boolean(env['VAPID_PRIVATE_KEY']?.trim());
  if (vapidPublic !== vapidPrivate) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set together');
  }
  if (env['SMTP_HOST']?.trim() && !env['SMTP_FROM']?.trim()) {
    throw new Error('SMTP_FROM is required when SMTP_HOST is set');
  }
  const hour = env['REMINDER_HOUR'];
  if (hour !== undefined && hour.trim() !== '' && !/^(?:[01]?\d|2[0-3])$/.test(hour.trim())) {
    throw new Error(`REMINDER_HOUR must be an hour from 0 to 23: ${hour}`);
  }
  const adminEmail = env['ADMIN_EMAIL']?.trim();
  if (adminEmail && !/^[^\s@]+@[^\s@]+$/.test(adminEmail)) {
    throw new Error(`ADMIN_EMAIL is not an email address: ${adminEmail}`);
  }
}

const entry = process.argv[1] ?? '';
if (/(?:^|[/\\])boot-env\.(ts|js)$/.test(entry)) {
  try {
    assertBootEnv();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
