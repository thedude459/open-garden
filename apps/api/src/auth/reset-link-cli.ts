// Prints a one-time password reset link for an account, for servers without
// SMTP (or when the email does not arrive). Run by whoever runs the server:
//   docker compose exec api node dist/reset-link.js person@example.com
//   npm run reset-link -- person@example.com          (from a source checkout)
import { existsSync } from 'node:fs';
import { AuthService, RESET_LINK_MS } from '@open-garden/auth';
import { createDb } from '@open-garden/plant-catalog-data';
import { notificationConfig } from '../notifications/notification-config';
import { resetLink } from './password-reset';

if (existsSync('.env')) process.loadEnvFile();

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error('Usage: reset-link <email>');
    process.exitCode = 2;
    return;
  }
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL required');
  const { db, pool } = createDb(url);
  try {
    const reset = await new AuthService(db).createPasswordReset(email);
    if (!reset) {
      console.error(`No account uses ${email}.`);
      process.exitCode = 1;
      return;
    }
    const appUrl = notificationConfig().appUrl;
    console.log(
      appUrl
        ? resetLink(appUrl, reset.token)
        : `${resetLink('', reset.token)}\n(Put the address you open Open Garden at in front, or set APP_URL to get a full link.)`,
    );
    console.log(
      `Give it to ${reset.email}. It works once, for ${RESET_LINK_MS / 60_000} minutes, and signs out their other devices.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
