import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ReminderListDto } from '@open-garden/shared-types';

export function deviceToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** A cached outlook from another local date must not keep watering optional. */
export function rainForDeviceDay(list: ReminderListDto, today = deviceToday()): ReminderListDto {
  if (list.outlookOn === today) return list;
  return {
    ...list,
    items: list.items.map((item) =>
      item.kind === 'water' ? { ...item, required: true, rainNote: null } : item,
    ),
  };
}

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
    const list = (await db.get('lists', this.cacheKey(userId, gardenId)))?.list ?? null;
    return list ? rainForDeviceDay(list) : null;
  }

  async delete(userId: string, gardenId: string) {
    const db = await this.db();
    await db.delete('lists', this.cacheKey(userId, gardenId));
  }
}
