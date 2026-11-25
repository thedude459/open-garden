import { Injectable } from '@angular/core';
import type { DBSchema } from 'idb';
import type { GardenDetailDto, GardenSummaryDto, PageDto } from '@open-garden/shared-types';
import { deviceStore } from '../device-data';

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
  private readonly store = deviceStore<GardenCacheDb>('og-gardens', 1, (db) => {
    db.createObjectStore('lists', { keyPath: 'key' });
    db.createObjectStore('details', { keyPath: 'id' });
  });

  private db() {
    return this.store.db();
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
    const page = (await db.get('lists', key))?.page ?? null;
    if (!page) return null;
    return {
      ...page,
      items: page.items.map((g) => ({
        ...g,
        bedCount: g.bedCount ?? 0,
        placementCount: g.placementCount ?? 0,
      })),
    };
  }

  async saveDetail(detail: GardenDetailDto) {
    const db = await this.db();
    await db.put('details', detail);
  }

  async getDetail(id: string): Promise<GardenDetailDto | null> {
    const db = await this.db();
    const detail = (await db.get('details', id)) ?? null;
    if (!detail) return null;
    return {
      ...detail,
      bedCount: detail.bedCount ?? 0,
      placementCount: detail.placementCount ?? 0,
    };
  }

  async deleteDetail(id: string) {
    const db = await this.db();
    await db.delete('details', id);
  }
}
