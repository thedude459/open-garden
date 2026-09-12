import type { CookieOptions } from 'express';

export function sessionCookieOptions(forwardedProto?: string): CookieOptions {
  const flag = process.env['COOKIE_SECURE'];
  const proto = forwardedProto?.split(',')[0]?.trim();
  const secure = flag === 'true' || (flag !== 'false' && proto === 'https');
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
  };
}
