import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AreaKind, PageDto, PlantDetailDto, PlantSummaryDto } from '@open-garden/shared-types';
import { allowsPlant } from '@open-garden/shared-types';
import { withCompanionDefaults } from './cached-detail';

interface CatalogCacheDb extends DBSchema {
  lists: {
    key: string;
    value: { key: string; page: PageDto<PlantSummaryDto>; savedAt: number };
  };
  details: {
    key: string;
    value: PlantDetailDto;
  };
}

@Injectable({ providedIn: 'root' })
export class PlantCatalogCacheService {
  private dbPromise: Promise<IDBPDatabase<CatalogCacheDb>> | null = null;

  private db() {
    if (!this.dbPromise) {
      this.dbPromise = openDB<CatalogCacheDb>('og-plant-catalog', 1, {
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

  async saveList(key: string, page: PageDto<PlantSummaryDto>) {
    const db = await this.db();
    await db.put('lists', { key, page, savedAt: Date.now() });
  }

  async getList(key: string): Promise<PageDto<PlantSummaryDto> | null> {
    const db = await this.db();
    const row = await db.get('lists', key);
    return row?.page ?? null;
  }

  async saveDetail(detail: PlantDetailDto) {
    const db = await this.db();
    await db.put('details', detail);
  }

  async getDetail(id: string): Promise<PlantDetailDto | null> {
    const db = await this.db();
    const detail = await db.get('details', id);
    return detail ? withCompanionDefaults(detail) : null;
  }

  /** Offline filters apply only to an already-cached browse page. */
  filterCached(
    page: PageDto<PlantSummaryDto>,
    opts: { zone?: number; plantType?: string; area?: AreaKind; family?: string; q?: string },
  ): PageDto<PlantSummaryDto> {
    let items = page.items;
    if (opts.family) {
      items = items.filter((p) => p.family === opts.family);
    }
    if (opts.plantType) {
      items = items.filter((p) => p.plantType === opts.plantType);
    }
    if (opts.area) {
      const area = opts.area;
      items = items.filter((p) => allowsPlant(area, p.plantType));
    }
    if (opts.zone !== undefined) {
      items = items.filter((p) => p.zoneMin <= opts.zone! && opts.zone! <= p.zoneMax);
    }
    if (opts.q?.trim()) {
      const q = opts.q.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.commonName.toLowerCase().includes(q) ||
          p.species.toLowerCase().includes(q) ||
          (p.cultivar?.toLowerCase().includes(q) ?? false),
      );
    }
    return { ...page, items, totalCount: items.length };
  }
}
