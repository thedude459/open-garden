import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountRef, securityEvent } from './security-log';

describe('securityEvent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes one greppable line, leaving out empty fields', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    securityEvent('sign_in_failed', { account: 'abc', ip: '203.0.113.7', user: undefined }, 'warn');
    expect(warn).toHaveBeenCalledWith('security.sign_in_failed account=abc ip=203.0.113.7');
  });

  it('names an account without its email address', () => {
    expect(accountRef(' Ann@Example.com ')).toBe(accountRef('ann@example.com'));
    expect(accountRef('ann@example.com')).toMatch(/^[0-9a-f]{12}$/);
    expect(accountRef('ann@example.com')).not.toBe(accountRef('bob@example.com'));
  });
});
