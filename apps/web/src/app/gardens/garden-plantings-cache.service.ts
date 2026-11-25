import { Injectable } from '@angular/core';
import type { DBSchema } from 'idb';
import type { PlantingListDto } from '@open-garden/shared-types';
import { deviceStore } from '../device-data';

interface PlantingsCacheDb extends DBSchema {
  lists: {
    key: string;
    value: { key: string; list: PlantingListDto; savedAt: number };
  };
}

@Injectable({ providedIn: 'root' })
export class GardenPlantingsCacheService {
  private readonly store = deviceStore<PlantingsCacheDb>('og-plantings', 1, (db) => {
    db.createObjectStore('lists', { keyPath: 'key' });
  });

  private db() {
    return this.store.db();
  }

  cacheKey(userId: string, gardenId: string): string {
    return `${userId}:${gardenId}`;
  }

  async save(userId: string, list: PlantingListDto) {
    const db = await this.db();
    const key = this.cacheKey(userId, list.gardenId);
    await db.put('lists', { key, list, savedAt: Date.now() });
  }

  async get(userId: string, gardenId: string): Promise<PlantingListDto | null> {
    const db = await this.db();
    return (await db.get('lists', this.cacheKey(userId, gardenId)))?.list ?? null;
  }

  async delete(userId: string, gardenId: string) {
    const db = await this.db();
    await db.delete('lists', this.cacheKey(userId, gardenId));
  }
}
