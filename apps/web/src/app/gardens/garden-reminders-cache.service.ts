import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ReminderListDto } from '@open-garden/shared-types';

interface RemindersCacheDb extends DBSchema {
  lists: {
    key: string;
    value: { key: string; list: ReminderListDto; savedAt: number };
  };
}

@Injectable({ providedIn: 'root' })
export class GardenRemindersCacheService {
  private dbPromise: Promise<IDBPDatabase<RemindersCacheDb>> | null = null;

  private db() {
    if (!this.dbPromise) {
      this.dbPromise = openDB<RemindersCacheDb>('og-reminders', 1, {
        upgrade(db) {
          db.createObjectStore('lists', { keyPath: 'key' });
        },
      });
    }
    return this.dbPromise;
  }

  cacheKey(userId: string, gardenId: string): string {
    return `${userId}:${gardenId}`;
  }

  async save(userId: string, list: ReminderListDto) {
    const db = await this.db();
    const key = this.cacheKey(userId, list.gardenId);
    await db.put('lists', { key, list, savedAt: Date.now() });
  }

  async get(userId: string, gardenId: string): Promise<ReminderListDto | null> {
    const db = await this.db();
    return (await db.get('lists', this.cacheKey(userId, gardenId)))?.list ?? null;
  }

  async delete(userId: string, gardenId: string) {
    const db = await this.db();
    await db.delete('lists', this.cacheKey(userId, gardenId));
  }
}
