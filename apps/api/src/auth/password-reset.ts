import { RESET_LINK_MS } from '@open-garden/auth';

/** The web page a reset link opens; `appUrl` is the APP_URL setting. */
export function resetLink(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, '')}/reset-password?token=${token}`;
}

/** The reset email's subject and plain-text body. */
export function resetEmail(link: string): { subject: string; text: string } {
  const minutes = RESET_LINK_MS / 60_000;
  return {
    subject: 'Reset your Open Garden password',
    text: [
      'Someone asked to reset the password for your Open Garden account.',
      '',
      `To choose a new password, open this link within ${minutes} minutes:`,
      link,
      '',
      'It works once. If you did not ask for this, ignore this email; your password stays as it is.',
    ].join('\n'),
  };
}
