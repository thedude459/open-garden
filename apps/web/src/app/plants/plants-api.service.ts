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
      if (isBrowse(query)) this.remember(idb, query, key);
      void this.fetchList(query, key);
      return idb;
    }
    return this.fetchList(query, key);
  }

  private fromMemory(query: PlantListQueryDto): PageDto<PlantSummaryDto> | null {
    if (!this.memory || !this.memoryCovers(query)) return null;
    if (!standsIn(this.memory, this.memoryMeta, query)) return null;
    return this.cache.filterCached(this.memory, query);
  }

  private memoryCovers(query: PlantListQueryDto): boolean {
    // Sowing windows are worked out by the server; a cached page cannot answer.
    if (query.sowNowFor || !isFirstPage(query)) return false;
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
    if (query.sowNowFor || !isFirstPage(query)) return null;
    const own = { zone: query.zone, plantType: query.plantType };
    const browseKeys: [string | null, BrowseMeta][] = [
      [this.lastBrowseKey, this.memoryMeta],
      [this.browseKey(query, 100), own],
      [this.browseKey(query, 20), own],
    ];
    for (const [browseKey, meta] of browseKeys) {
      if (!browseKey) continue;
      const browse = await this.cache.getList(browseKey);
      if (!browse || !standsIn(browse, meta, query)) continue;
      const filtered = this.cache.filterCached(browse, query);
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
      if (query.area) params = params.set('area', query.area);
      if (query.family) params = params.set('family', query.family);
      if (query.sowNowFor) params = params.set('sowNowFor', query.sowNowFor);
      if (query.asOf) params = params.set('asOf', query.asOf);
      if (query.page) params = params.set('page', String(query.page));
      if (query.pageSize) params = params.set('pageSize', String(query.pageSize));
      const page = await firstValueFrom(
        this.http.get<PageDto<PlantSummaryDto>>(`${API}/plants`, {
          params,
          withCredentials: true,
        }),
      );
      void this.cache.saveList(key, page);
      if (isBrowse(query)) this.remember(page, query, key);
      return page;
    } catch {
      const cached = await this.fromIdb(query, key);
      if (cached) return cached;
      if (this.memory && !query.sowNowFor && isFirstPage(query)) {
        return this.cache.filterCached(this.memory, query);
      }
      return { items: [], page: 1, pageSize: query.pageSize ?? 20, totalCount: 0 };
    }
  }

  /** Families in the catalog, for its family filter; none while offline. */
  async families(): Promise<string[]> {
    try {
      return await firstValueFrom(
        this.http.get<string[]>(`${API}/plants/families`, { withCredentials: true }),
      );
    } catch {
      return [];
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

/** A page worth keeping in memory to filter offline: no search or narrowing filter. */
/**
 * A cached browse page answers a narrower query only when it holds the whole
 * catalog; otherwise filtering it would drop matches past its first page.
 */
type BrowseMeta = { zone?: number; plantType?: PlantType };

function standsIn(
  page: PageDto<PlantSummaryDto>,
  meta: BrowseMeta,
  query: PlantListQueryDto,
): boolean {
  if (page.items.length >= page.totalCount) return true;
  return isBrowse(query) && meta.zone === query.zone && meta.plantType === query.plantType;
}

function isBrowse(query: PlantListQueryDto): boolean {
  // An area query is a filtered page; it never stands in for the whole browse.
  return !query.q && !query.family && !query.area && !query.sowNowFor && isFirstPage(query);
}

/**
 * Cached pages are first pages, filtered here; they cannot stand in for a
 * later page, which would repeat the first one's entries.
 */
function isFirstPage(query: PlantListQueryDto): boolean {
  return (query.page ?? 1) === 1;
}
