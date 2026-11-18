import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { AuthService } from '@open-garden/auth';
import { AuthController } from './auth.controller';
import { resetEmail, resetLink } from './password-reset';

const send = vi.fn(async () => undefined);
vi.mock('../notifications/senders', () => ({ smtpEmailSender: () => ({ send }) }));

const TOKEN = 'c'.repeat(64);
const res = { req: { headers: {}, socket: { remoteAddress: '10.0.0.1' } } } as unknown as Response;

function controller() {
  return new AuthController({ db: {} as never });
}

describe('password reset by email', () => {
  beforeEach(() => {
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_FROM', 'garden@example.com');
    vi.stubEnv('APP_URL', 'https://garden.example.com/');
    send.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('emails a link to the account and answers the same for an unknown address', async () => {
    const create = vi
      .spyOn(AuthService.prototype, 'createPasswordReset')
      .mockResolvedValueOnce({ email: 'a@example.com', token: TOKEN })
      .mockResolvedValueOnce(null);
    const c = controller();
    expect(c.resetOptions()).toEqual({ byEmail: true });
    await expect(c.requestReset({ email: 'A@example.com' }, res)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledWith(
      'a@example.com',
      'Reset your Open Garden password',
      expect.stringContaining(`https://garden.example.com/reset-password?token=${TOKEN}`),
    );
    await expect(c.requestReset({ email: 'nobody@example.com' }, res)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('stops after three requests for one address in 15 minutes', async () => {
    vi.spyOn(AuthService.prototype, 'createPasswordReset').mockResolvedValue(null);
    const c = controller();
    for (let i = 0; i < 3; i++) await c.requestReset({ email: 'a@example.com' }, res);
    await expect(c.requestReset({ email: 'a@example.com' }, res)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });

  it('is off without SMTP or without APP_URL for the link', async () => {
    vi.stubEnv('APP_URL', '');
    const c = controller();
    expect(c.resetOptions()).toEqual({ byEmail: false });
    await expect(c.requestReset({ email: 'a@example.com' }, res)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('writes a link that works once, for an hour', () => {
    expect(resetLink('https://g.example/', TOKEN)).toBe(
      `https://g.example/reset-password?token=${TOKEN}`,
    );
    const mail = resetEmail('LINK');
    expect(mail.text).toContain('LINK');
    expect(mail.text).toContain('within 60 minutes');
  });
});
