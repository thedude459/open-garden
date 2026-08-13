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

const API = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class PlantsApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(PlantCatalogCacheService);

  async list(query: PlantListQueryDto = {}): Promise<PageDto<PlantSummaryDto>> {
    const key = this.cache.listKey(query as Record<string, string | number | undefined>);
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
      await this.cache.saveList(key, page);
      return page;
    } catch {
      const cached = await this.cache.getList(key);
      if (cached) return cached;
      // Fallback: filter a default browse cache client-side
      const browse = await this.cache.getList(this.cache.listKey({ page: 1, pageSize: 20 }));
      if (browse) {
        return this.cache.filterCached(browse, {
          zone: query.zone,
          plantType: query.plantType,
          q: query.q,
        });
      }
      return { items: [], page: 1, pageSize: 20, totalCount: 0 };
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
