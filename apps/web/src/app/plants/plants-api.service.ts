import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  PageDto,
  PlantDetailDto,
  PlantListQueryDto,
  PlantSummaryDto,
  PlantType,
} from '@open-garden/shared-types';
import { PlantCatalogCacheService } from './plant-catalog-cache.service';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class PlantsApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(PlantCatalogCacheService);
  private memory: PageDto<PlantSummaryDto> | null = null;
  private memoryMeta: { zone?: number; plantType?: PlantType } = {};
  private lastBrowseKey: string | null = null;

  async list(query: PlantListQueryDto = {}): Promise<PageDto<PlantSummaryDto>> {
    const key = this.cache.listKey(query as Record<string, string | number | undefined>);
    const local = this.fromMemory(query);
    if (local?.items.length) {
      void this.fetchList(query, key);
      return local;
    }
    const idb = await this.fromIdb(query, key);
    if (idb?.items.length) {
      if (!query.q) this.remember(idb, query, key);
      void this.fetchList(query, key);
      return idb;
    }
    return this.fetchList(query, key);
  }

  private fromMemory(query: PlantListQueryDto): PageDto<PlantSummaryDto> | null {
    if (!this.memory || !this.memoryCovers(query)) return null;
    return this.cache.filterCached(this.memory, {
      zone: query.zone,
      plantType: query.plantType,
      q: query.q,
    });
  }

  private memoryCovers(query: PlantListQueryDto): boolean {
    if (this.memoryMeta.plantType && this.memoryMeta.plantType !== query.plantType) return false;
    if (this.memoryMeta.zone !== undefined && this.memoryMeta.zone !== query.zone) return false;
    return true;
  }

  private remember(page: PageDto<PlantSummaryDto>, query: PlantListQueryDto, key: string) {
    this.memory = page;
    this.memoryMeta = { zone: query.zone, plantType: query.plantType };
    this.lastBrowseKey = key;
  }

  private async fromIdb(
    query: PlantListQueryDto,
    key: string,
  ): Promise<PageDto<PlantSummaryDto> | null> {
    const exact = await this.cache.getList(key);
    if (exact?.items.length) return exact;
    const browseKeys = [this.lastBrowseKey, this.browseKey(query, 100), this.browseKey(query, 20)];
    for (const browseKey of browseKeys) {
      if (!browseKey) continue;
      const browse = await this.cache.getList(browseKey);
      if (!browse) continue;
      const filtered = this.cache.filterCached(browse, {
        zone: query.zone,
        plantType: query.plantType,
        q: query.q,
      });
      if (filtered.items.length) return filtered;
    }
    return null;
  }

  private browseKey(query: PlantListQueryDto, pageSize: number): string {
    return this.cache.listKey({
      page: 1,
      pageSize,
      zone: query.zone,
      plantType: query.plantType,
    });
  }

  private async fetchList(
    query: PlantListQueryDto,
    key: string,
  ): Promise<PageDto<PlantSummaryDto>> {
    try {
      let params = new HttpParams();
      if (query.q) params = params.set('q', query.q);
      if (query.zone !== undefined) params = params.set('zone', String(query.zone));
      if (query.plantType) params = params.set('plantType', query.plantType);
      if (query.page) params = params.set('page', String(query.page));
      if (query.pageSize) params = params.set('pageSize', String(query.pageSize));
      const page = await firstValueFrom(
        this.http.get<PageDto<PlantSummaryDto>>(`${API}/plants`, {
          params,
          withCredentials: true,
        }),
      );
      void this.cache.saveList(key, page);
      if (!query.q) this.remember(page, query, key);
      return page;
    } catch {
      const cached = await this.fromIdb(query, key);
      if (cached) return cached;
      if (this.memory) {
        return this.cache.filterCached(this.memory, {
          zone: query.zone,
          plantType: query.plantType,
          q: query.q,
        });
      }
      return { items: [], page: 1, pageSize: query.pageSize ?? 20, totalCount: 0 };
    }
  }

  async detail(id: string): Promise<PlantDetailDto | null> {
    try {
      const detail = await firstValueFrom(
        this.http.get<PlantDetailDto>(`${API}/plants/${id}`, { withCredentials: true }),
      );
      await this.cache.saveDetail(detail);
      return detail;
    } catch {
      return this.cache.getDetail(id);
    }
  }
}
