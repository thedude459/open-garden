import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDeviceData, deviceStore, recordDeviceOwner } from './device-data';

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

  it('opens no store between clearing the device and the next member claiming it', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = deviceStore('og-gardens', 1, () => undefined);
    await clearDeviceData();
    const open = vi.fn(() => {
      throw new Error('opened');
    });
    vi.stubGlobal('indexedDB', { open });
    // A response that arrives after sign-out must not recreate the database.
    await expect(store.db()).rejects.toThrow('Signed out');
    expect(open).not.toHaveBeenCalled();
    recordDeviceOwner('bob');
    expect(() => store.db()).toThrow('opened');
    expect(open).toHaveBeenCalledWith('og-gardens', 1);
  });
});
