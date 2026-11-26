import { deleteDB, openDB, type DBSchema, type IDBPDatabase, type OpenDBCallbacks } from 'idb';

/**
 * Every IndexedDB database the app keeps on this device. A store must be
 * listed here to be opened, so {@link clearDeviceData} deletes all of them,
 * including ones this visit never opened.
 */
export const DEVICE_STORES = [
  'og-calendar',
  'og-favorites',
  'og-gardens',
  'og-layout',
  'og-plant-catalog',
  'og-plantings',
  'og-plantings-queue',
  'og-reminders',
  'og-reminders-queue',
] as const;
export type DeviceStoreName = (typeof DEVICE_STORES)[number];

const open = new Map<DeviceStoreName, { close(): void }>();

/** Who the data on this device belongs to; kept across tabs and restarts. */
const OWNER_KEY = 'og_device_owner';

/**
 * Set by {@link clearDeviceData} until a member claims the device again
 * ({@link recordDeviceOwner}). A request still in flight when its member
 * signed out must not open, and so recreate, a database just deleted (#277).
 */
let cleared = false;

/**
 * A lazily opened database. `db()` opens it on first use, and again after
 * {@link clearDeviceData} has closed and deleted it once a member has
 * claimed the device; until then it refuses.
 */
export function deviceStore<S extends DBSchema>(
  name: DeviceStoreName,
  version: number,
  upgrade: OpenDBCallbacks<S>['upgrade'],
) {
  let opening: Promise<IDBPDatabase<S>> | null = null;
  const store = {
    db(): Promise<IDBPDatabase<S>> {
      if (cleared) return Promise.reject(new Error('Signed out: nothing is kept on this device'));
      opening ??= openDB<S>(name, version, {
        upgrade,
        // Another tab is deleting this database: let go so it can.
        blocking: () => store.close(),
      });
      return opening;
    },
    close() {
      const closing = opening;
      opening = null;
      void closing?.then((db) => db.close()).catch(() => undefined);
    },
  };
  open.set(name, store);
  return store;
}

/**
 * Deletes everything the app keeps on this device: saved properties, plans,
 * plantings, reminders, favorites, the catalog, and changes waiting to sync.
 */
export async function clearDeviceData(): Promise<void> {
  cleared = true;
  for (const store of open.values()) store.close();
  // Without IndexedDB (some private windows) nothing was stored to delete.
  if (typeof indexedDB !== 'undefined') {
    await Promise.all(DEVICE_STORES.map((name) => deleteDB(name).catch(() => undefined)));
  }
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage is blocked, so no owner was recorded either.
  }
}

/**
 * Records who signed in, and says whose data the device held before:
 * `same` member, `none` recorded (signed out, or from before owners were
 * recorded), or an `other` member, whose data must go before anything shows.
 */
export function recordDeviceOwner(userId: string): 'same' | 'none' | 'other' {
  cleared = false;
  try {
    const previous = localStorage.getItem(OWNER_KEY);
    localStorage.setItem(OWNER_KEY, userId);
    if (previous === null) return 'none';
    return previous === userId ? 'same' : 'other';
  } catch {
    return 'none';
  }
}
