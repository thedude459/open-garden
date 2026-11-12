/** Reminder delivery settings from the environment; a channel is off unless set up. */
export interface NotificationConfig {
  push: { publicKey: string; privateKey: string; subject: string } | null;
  smtp: {
    host: string;
    port: number;
    user: string | undefined;
    password: string | undefined;
    from: string;
  } | null;
  reminderHour: number;
  appUrl: string;
}

export function notificationConfig(env: NodeJS.ProcessEnv = process.env): NotificationConfig {
  const publicKey = env['VAPID_PUBLIC_KEY']?.trim();
  const privateKey = env['VAPID_PRIVATE_KEY']?.trim();
  const appUrl = env['APP_URL']?.trim() ?? '';
  const host = env['SMTP_HOST']?.trim();
  const from = env['SMTP_FROM']?.trim();
  return {
    push:
      publicKey && privateKey
        ? {
            publicKey,
            privateKey,
            // Push services want a contact: a mailto: or https: URL.
            subject: env['VAPID_SUBJECT']?.trim() || appUrl || 'mailto:admin@localhost',
          }
        : null,
    smtp:
      host && from
        ? {
            host,
            port: Number(env['SMTP_PORT'] ?? 587),
            user: env['SMTP_USER']?.trim() || undefined,
            password: env['SMTP_PASSWORD'] || undefined,
            from,
          }
        : null,
    reminderHour: Number(env['REMINDER_HOUR'] ?? 7),
    appUrl,
  };
}
