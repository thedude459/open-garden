import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GardenLayoutDto } from '@open-garden/shared-types';

interface LayoutCacheDb extends DBSchema {
  layouts: {
    key: string;
    value: { key: string; layout: GardenLayoutDto; savedAt: number };
  };
}

@Injectable({ providedIn: 'root' })
export class GardenLayoutCacheService {
  private dbPromise: Promise<IDBPDatabase<LayoutCacheDb>> | null = null;

  private db() {
    if (!this.dbPromise) {
      this.dbPromise = openDB<LayoutCacheDb>('og-layout', 1, {
        upgrade(db) {
          db.createObjectStore('layouts', { keyPath: 'key' });
        },
      });
    }
    return this.dbPromise;
  }

  cacheKey(userId: string, gardenId: string): string {
    return `${userId}:${gardenId}`;
  }

  async save(userId: string, layout: GardenLayoutDto) {
    const db = await this.db();
    const key = this.cacheKey(userId, layout.gardenId);
    await db.put('layouts', { key, layout, savedAt: Date.now() });
  }

  async get(userId: string, gardenId: string): Promise<GardenLayoutDto | null> {
    const db = await this.db();
    return (await db.get('layouts', this.cacheKey(userId, gardenId)))?.layout ?? null;
  }

  async delete(userId: string, gardenId: string) {
    const db = await this.db();
    await db.delete('layouts', this.cacheKey(userId, gardenId));
  }
}
