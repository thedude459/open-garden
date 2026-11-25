import { Injectable } from '@angular/core';
import type { DBSchema } from 'idb';
import type { CalendarDto } from '@open-garden/shared-types';
import { deviceStore } from '../device-data';

interface CalendarCacheDb extends DBSchema {
  calendars: {
    key: string;
    value: { key: string; calendar: CalendarDto; savedAt: number };
  };
}

@Injectable({ providedIn: 'root' })
export class GardenCalendarCacheService {
  private readonly store = deviceStore<CalendarCacheDb>('og-calendar', 1, (db) => {
    db.createObjectStore('calendars', { keyPath: 'key' });
  });

  private db() {
    return this.store.db();
  }

  cacheKey(userId: string, gardenId: string): string {
    return `${userId}:${gardenId}`;
  }

  async save(userId: string, calendar: CalendarDto) {
    const db = await this.db();
    const key = this.cacheKey(userId, calendar.gardenId);
    await db.put('calendars', { key, calendar, savedAt: Date.now() });
  }

  async get(userId: string, gardenId: string): Promise<CalendarDto | null> {
    const db = await this.db();
    return (await db.get('calendars', this.cacheKey(userId, gardenId)))?.calendar ?? null;
  }

  async delete(userId: string, gardenId: string) {
    const db = await this.db();
    await db.delete('calendars', this.cacheKey(userId, gardenId));
  }
}
