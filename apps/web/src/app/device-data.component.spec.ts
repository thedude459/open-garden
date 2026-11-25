import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDeviceData, recordDeviceOwner } from './device-data';

// Deleting real databases is covered in a browser: web-e2e device-data.spec.ts.
describe('device data', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('tells the same member, no one recorded, and another member apart', () => {
    expect(recordDeviceOwner('ann')).toBe('none');
    expect(recordDeviceOwner('ann')).toBe('same');
    expect(recordDeviceOwner('bob')).toBe('other');
  });

  it('forgets the owner when it clears the device', async () => {
    vi.stubGlobal('indexedDB', undefined);
    recordDeviceOwner('ann');
    await clearDeviceData();
    expect(recordDeviceOwner('bob')).toBe('none');
  });

  it('has nothing to delete without IndexedDB, as in some private windows', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(clearDeviceData()).resolves.toBeUndefined();
  });

  it('treats blocked storage as no owner recorded', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(recordDeviceOwner('ann')).toBe('none');
  });
});
