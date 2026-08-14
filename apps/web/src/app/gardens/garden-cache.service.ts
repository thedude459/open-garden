import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GardenDetailDto, GardenSummaryDto, PageDto } from '@open-garden/shared-types';

interface GardenCacheDb extends DBSchema {
  lists: {
    key: string;
    value: { key: string; page: PageDto<GardenSummaryDto>; savedAt: number };
  };
  details: {
    key: string;
    value: GardenDetailDto;
  };
}

@Injectable({ providedIn: 'root' })
export class GardenCacheService {
  private dbPromise: Promise<IDBPDatabase<GardenCacheDb>> | null = null;

  private db() {
    if (!this.dbPromise) {
      this.dbPromise = openDB<GardenCacheDb>('og-gardens', 1, {
        upgrade(db) {
          db.createObjectStore('lists', { keyPath: 'key' });
          db.createObjectStore('details', { keyPath: 'id' });
        },
      });
    }
    return this.dbPromise;
  }

  listKey(params: Record<string, string | number | undefined>): string {
    return JSON.stringify(params);
  }

  async saveList(key: string, page: PageDto<GardenSummaryDto>) {
    const db = await this.db();
    await db.put('lists', { key, page, savedAt: Date.now() });
  }

  async getList(key: string): Promise<PageDto<GardenSummaryDto> | null> {
    const db = await this.db();
    return (await db.get('lists', key))?.page ?? null;
  }

  async saveDetail(detail: GardenDetailDto) {
    const db = await this.db();
    await db.put('details', detail);
  }

  async getDetail(id: string): Promise<GardenDetailDto | null> {
    const db = await this.db();
    return (await db.get('details', id)) ?? null;
  }

  async deleteDetail(id: string) {
    const db = await this.db();
    await db.delete('details', id);
  }
}
