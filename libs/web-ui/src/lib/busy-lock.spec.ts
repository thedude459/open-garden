import { describe, expect, it } from 'vitest';
import { createBusyLock } from './busy-lock';

describe('createBusyLock', () => {
  it('rejects a second tryBegin for the same key until end', () => {
    const lock = createBusyLock();
    expect(lock.tryBegin('save-layout')).toBe(true);
    expect(lock.tryBegin('save-layout')).toBe(false);
    expect(lock.has('save-layout')).toBe(true);
    lock.end('save-layout');
    expect(lock.has('save-layout')).toBe(false);
    expect(lock.tryBegin('save-layout')).toBe(true);
  });

  it('end on a missing key is a no-op', () => {
    const lock = createBusyLock();
    expect(() => lock.end('missing')).not.toThrow();
    expect(lock.has('missing')).toBe(false);
  });

  it('allows different keys at the same time', () => {
    const lock = createBusyLock();
    expect(lock.tryBegin('save-layout')).toBe(true);
    expect(lock.tryBegin('create-bed')).toBe(true);
  });
});
