import { describe, expect, it } from 'vitest';
import { FailureLimiter } from './failure-limiter';

describe('FailureLimiter', () => {
  it('blocks a key after max failures in the window, until the oldest ages out', () => {
    let now = 0;
    const limiter = new FailureLimiter(3, 1000, () => now);
    for (const t of [0, 100, 200]) {
      now = t;
      expect(limiter.retryAfterMs('a')).toBe(0);
      limiter.fail('a');
    }
    now = 300;
    expect(limiter.retryAfterMs('a')).toBe(700);
    expect(limiter.retryAfterMs('b')).toBe(0);
    now = 1000;
    expect(limiter.retryAfterMs('a')).toBe(0);
  });

  it('forgets a key on success', () => {
    const limiter = new FailureLimiter(1, 1000, () => 0);
    limiter.fail('a');
    expect(limiter.retryAfterMs('a')).toBe(1000);
    limiter.clear('a');
    expect(limiter.retryAfterMs('a')).toBe(0);
  });
});
