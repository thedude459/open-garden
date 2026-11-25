import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  PageDto,
  PlantDetailDto,
  PlantListQueryDto,
  PlantSummaryDto,
} from '@open-garden/shared-types';
import { PlantCatalogCacheService } from './plant-catalog-cache.service';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class PlantsApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(PlantCatalogCacheService);
  /** The last whole-catalog first page, kept to filter offline. */
  private memory: PageDto<PlantSummaryDto> | null = null;
  private memoryKey: string | null = null;

  /**
   * Online, a page comes from the server, or from a saved copy of this exact
   * query while the server refreshes it. Only offline does the app filter
   * saved pages itself (offlineAnswer), since a filtered page can miss
   * matches the server would find.
   */
  async list(query: PlantListQueryDto = {}): Promise<PageDto<PlantSummaryDto>> {
    const key = this.cache.listKey(query as Record<string, string | number | undefined>);
    const exact = key === this.memoryKey ? this.memory : await this.cache.getList(key);
    if (exact?.items.length) {
      void this.fetchList(query, key);
      return exact;
    }
    return this.fetchList(query, key);
  }

  private remember(page: PageDto<PlantSummaryDto>, key: string) {
    this.memory = page;
    this.memoryKey = key;
  }

  /**
   * The best saved answer when the server cannot be reached: this exact
   * query, else the first catalog page filtered here. It may miss matches
   * past that page; offline, some answer beats none.
   */
  private async offlineAnswer(
    query: PlantListQueryDto,
    key: string,
  ): Promise<PageDto<PlantSummaryDto> | null> {
    const exact = await this.cache.getList(key);
    if (exact?.items.length) return exact;
    // Sowing windows are worked out by the server; a later page would repeat the first.
    if (query.sowNowFor || !isFirstPage(query)) return null;
    for (const browseKey of [this.memoryKey, this.browseKey(100), this.browseKey(20)]) {
      if (!browseKey) continue;
      const browse =
        browseKey === this.memoryKey ? this.memory : await this.cache.getList(browseKey);
      if (!browse) continue;
      const filtered = this.cache.filterCached(browse, query);
      if (filtered.items.length) return filtered;
    }
    return null;
  }

  private browseKey(pageSize: number): string {
    return this.cache.listKey({ page: 1, pageSize });
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
      if (isWholeCatalog(query)) this.remember(page, key);
      return page;
    } catch {
      return (
        (await this.offlineAnswer(query, key)) ?? {
          items: [],
          page: 1,
          pageSize: query.pageSize ?? 20,
          totalCount: 0,
        }
      );
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

/** The catalog's first page with nothing narrowing it: the page to filter offline. */
function isWholeCatalog(query: PlantListQueryDto): boolean {
  return (
    !query.q &&
    !query.family &&
    !query.area &&
    !query.plantType &&
    query.zone === undefined &&
    !query.sowNowFor &&
    isFirstPage(query)
  );
}

/**
 * Saved pages are first pages, filtered here; they cannot stand in for a
 * later page, which would repeat the first one's entries.
 */
function isFirstPage(query: PlantListQueryDto): boolean {
  return (query.page ?? 1) === 1;
}
