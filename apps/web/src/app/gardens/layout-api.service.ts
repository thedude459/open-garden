import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  BedCreateDto,
  GardenLayoutDto,
  LayoutPutDto,
  TransplantListDto,
} from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { GardenLayoutCacheService } from './garden-layout-cache.service';
import { GardenPlantingsCacheService } from './garden-plantings-cache.service';
import { OnlineRequiredError } from './gardens-api.service';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class LayoutApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(GardenLayoutCacheService);
  private readonly plantingsCache = inject(GardenPlantingsCacheService);
  private readonly auth = inject(AuthApiService);

  async get(gardenId: string): Promise<GardenLayoutDto | null> {
    const userId = this.userId();
    try {
      const layout = await firstValueFrom(
        this.http.get<GardenLayoutDto>(`${API}/gardens/${gardenId}/layout`, {
          withCredentials: true,
        }),
      );
      if (userId) await this.cache.save(userId, layout);
      return layout;
    } catch (err) {
      if (isNotFound(err)) {
        if (userId) await this.cache.delete(userId, gardenId);
        return null;
      }
      if (userId) return this.cache.get(userId, gardenId);
      return null;
    }
  }

  async createBed(gardenId: string, body: BedCreateDto): Promise<void> {
    this.assertOnline();
    try {
      await firstValueFrom(
        this.http.post(`${API}/gardens/${gardenId}/beds`, body, { withCredentials: true }),
      );
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  async deleteBed(gardenId: string, bedId: string): Promise<void> {
    this.assertOnline();
    try {
      await firstValueFrom(
        this.http.delete(`${API}/gardens/${gardenId}/beds/${bedId}`, { withCredentials: true }),
      );
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  async deleteArea(gardenId: string, areaId: string): Promise<void> {
    this.assertOnline();
    try {
      await firstValueFrom(
        this.http.delete(`${API}/gardens/${gardenId}/areas/${areaId}`, { withCredentials: true }),
      );
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  async getTransplants(gardenId: string): Promise<TransplantListDto | null> {
    try {
      return await firstValueFrom(
        this.http.get<TransplantListDto>(`${API}/gardens/${gardenId}/transplants`, {
          withCredentials: true,
        }),
      );
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async put(gardenId: string, body: LayoutPutDto): Promise<GardenLayoutDto> {
    this.assertOnline();
    try {
      const layout = await firstValueFrom(
        this.http.put<GardenLayoutDto>(`${API}/gardens/${gardenId}/layout`, body, {
          withCredentials: true,
        }),
      );
      const userId = this.userId();
      if (userId) {
        await this.cache.save(userId, layout);
        await this.plantingsCache.delete(userId, gardenId);
      }
      return layout;
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  private userId(): string | null {
    return this.auth.currentUserId();
  }

  private assertOnline() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new OnlineRequiredError();
    }
  }

  private rethrowConnectivity(err: unknown): never {
    if (err instanceof OnlineRequiredError) throw err;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new OnlineRequiredError();
    }
    if (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 502)) {
      throw new OnlineRequiredError();
    }
    throw err;
  }
}

function isNotFound(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 404 || err.status === 403);
}
