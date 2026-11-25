import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';

const logger = new Logger('Security');

type Fields = Record<string, string | number | undefined>;

/**
 * One line per security event, as `security.<event> key=value …`, so an
 * operator can grep for them. Never pass a password, token, or email body;
 * name an account by its id, or by {@link accountRef} before one is known.
 */
export function securityEvent(event: string, fields: Fields = {}, level: 'log' | 'warn' = 'log') {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`);
  logger[level](['security.' + event, ...parts].join(' '));
}

/**
 * A short, stable reference to the account an email address names, so repeated
 * attempts on one account can be seen together without logging the address.
 */
export function accountRef(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
}
