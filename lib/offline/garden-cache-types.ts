import type { GardenDetail } from "@/lib/garden/types";

const DB_NAME = "garden-offline";
const DB_VERSION = 1;
const GARDENS_STORE = "gardens";

function openGardenCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(GARDENS_STORE)) {
        db.createObjectStore(GARDENS_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open garden cache"));
  });
}

/** Read-only cache stub — full sync arrives in Phase 9 (T059–T061). */
export async function loadCachedGardenDetail(gardenId: string): Promise<GardenDetail | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  const db = await openGardenCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GARDENS_STORE, "readonly");
    const store = tx.objectStore(GARDENS_STORE);
    const request = store.get(gardenId);

    request.onsuccess = () => {
      resolve((request.result as GardenDetail | undefined) ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to read garden cache"));
    tx.oncomplete = () => db.close();
  });
}

export async function saveCachedGardenDetail(garden: GardenDetail): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }

  const db = await openGardenCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GARDENS_STORE, "readwrite");
    tx.objectStore(GARDENS_STORE).put(garden);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("Failed to write garden cache"));
  });
}

export async function listCachedGardenIds(): Promise<string[]> {
  if (typeof indexedDB === "undefined") {
    return [];
  }

  const db = await openGardenCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GARDENS_STORE, "readonly");
    const store = tx.objectStore(GARDENS_STORE);
    const request = store.getAllKeys();

    request.onsuccess = () => resolve((request.result as string[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Failed to list garden cache keys"));
    tx.oncomplete = () => db.close();
  });
}
