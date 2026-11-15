import { describe, expect, it } from 'vitest';
import { endsSession, safeReturnUrl } from './session-expiry';

describe('endsSession', () => {
  it('treats a 401 from the API as an ended session', () => {
    expect(endsSession('/api/gardens')).toBe(true);
    expect(endsSession('/api/gardens/abc/layout?x=1')).toBe(true);
    expect(endsSession('http://localhost:4200/api/plants')).toBe(true);
  });

  it('leaves sign-in, sign-up, sign-out, and other origins alone', () => {
    expect(endsSession('/api/auth/login')).toBe(false);
    expect(endsSession('/api/auth/register')).toBe(false);
    expect(endsSession('/api/auth/logout')).toBe(false);
    expect(endsSession('https://tile.openstreetmap.org/1/2/3.png')).toBe(false);
    expect(endsSession('/assets/icon-512.png')).toBe(false);
  });
});

describe('safeReturnUrl', () => {
  it('returns to a page of this app', () => {
    expect(safeReturnUrl('/gardens/abc/layout')).toBe('/gardens/abc/layout');
    expect(safeReturnUrl('/plants?q=tomato')).toBe('/plants?q=tomato');
  });

  it('goes to Today for anything else', () => {
    expect(safeReturnUrl(null)).toBe('/today');
    expect(safeReturnUrl('')).toBe('/today');
    expect(safeReturnUrl('https://evil.example')).toBe('/today');
    expect(safeReturnUrl('//evil.example')).toBe('/today');
    expect(safeReturnUrl('/\\evil.example')).toBe('/today');
    expect(safeReturnUrl('/login?expired=1')).toBe('/today');
  });
});
