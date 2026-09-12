import type { CookieOptions } from 'express';

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env['COOKIE_SECURE'] === 'true',
  };
}
