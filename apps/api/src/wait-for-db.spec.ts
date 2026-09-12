import { describe, expect, it, vi } from 'vitest';
import { waitForDb } from './wait-for-db';

describe('waitForDb', () => {
  it('retries then throws on timeout', async () => {
    const connect = vi.fn(async () => {
      throw new Error('refused');
    });
    await expect(
      waitForDb({
        url: 'postgresql://unused',
        timeoutMs: 40,
        intervalMs: 10,
        connect,
      }),
    ).rejects.toThrow(/Timed out waiting for database/);
    expect(connect.mock.calls.length).toBeGreaterThan(1);
  });

  it('returns after a later connect succeeds', async () => {
    let attempts = 0;
    const connect = vi.fn(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('not yet');
    });
    await waitForDb({
      url: 'postgresql://unused',
      timeoutMs: 200,
      intervalMs: 5,
      connect,
    });
    expect(connect).toHaveBeenCalledTimes(3);
  });
});
