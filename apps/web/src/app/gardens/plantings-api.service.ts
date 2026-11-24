import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  BedCreateDto,
  NamedBedDto,
  PlantingCreateDto,
  PlantingDto,
  PlantingListDto,
  HarvestTotalsDto,
  PlantingPatchDto,
  PlantingRepeatResultDto,
  SoilTestCreateDto,
  SoilTestDto,
  SoilTestOwner,
} from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { GardenLayoutCacheService } from './garden-layout-cache.service';
import { GardenPlantingsCacheService } from './garden-plantings-cache.service';
import {
  PlantingsOfflineQueue,
  type ClientPlantingList,
  type PlantingPreview,
  type QueueItem,
} from './plantings-offline.queue';
import { apiMessage, UserFacingError } from '../ui/error-message';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class PlantingsApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(GardenPlantingsCacheService);
  private readonly layoutCache = inject(GardenLayoutCacheService);
  private readonly queue = inject(PlantingsOfflineQueue);
  private readonly auth = inject(AuthApiService);

  /**
   * The current season's plantings, kept for offline use with queued edits
   * on top; or with `season`, the next season's (ADR 0040), which needs a
   * connection and is not kept.
   */
  async list(gardenId: string, season?: number | null): Promise<ClientPlantingList | null> {
    if (season) {
      try {
        return await this.fetchAllPages(gardenId, season);
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    }
    const userId = this.userId();
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        await this.drain(gardenId);
      } catch {
        /* drain errors surface as failed queue items */
      }
    }
    try {
      const list = await this.fetchAllPages(gardenId);
      if (userId) await this.cache.save(userId, list);
      const pending = userId ? await this.queue.listForGarden(gardenId) : [];
      return this.queue.overlay(list, pending);
    } catch (err) {
      if (isNotFound(err)) {
        if (userId) {
          await this.cache.delete(userId, gardenId);
          await this.queue.dropGarden(gardenId);
        }
        return null;
      }
      if (userId) {
        const cached = await this.cache.get(userId, gardenId);
        if (cached) {
          const pending = await this.queue.listForGarden(gardenId);
          return this.queue.overlay(cached, pending);
        }
      }
      throw err;
    }
  }

  async create(
    gardenId: string,
    body: PlantingCreateDto,
    preview?: PlantingPreview,
  ): Promise<ClientPlantingList> {
    const payload: PlantingCreateDto = {
      ...body,
      id: body.id ?? crypto.randomUUID(),
      clientMutationId: body.clientMutationId ?? crypto.randomUUID(),
    };
    try {
      await firstValueFrom(
        this.http.post<PlantingListDto>(`${API}/gardens/${gardenId}/plantings`, payload, {
          withCredentials: true,
        }),
      );
      await this.invalidateLayout(gardenId);
      return this.listOrThrow(gardenId, body.seasonYear);
    } catch (err) {
      this.rethrowClientError(err);
      await this.enqueue({
        key: this.queue.entityKey('planting', payload.id!),
        kind: 'planting',
        gardenId,
        op: 'create',
        body: payload,
        preview,
        clientMutationId: payload.clientMutationId!,
        updatedAt: Date.now(),
      });
      await this.invalidateLayout(gardenId);
      return this.listOrThrow(gardenId);
    }
  }

  async update(gardenId: string, plantingId: string, body: PlantingPatchDto): Promise<PlantingDto> {
    const clientMutationId = body.clientMutationId ?? crypto.randomUUID();
    try {
      const planting = await firstValueFrom(
        this.http.patch<PlantingDto>(`${API}/gardens/${gardenId}/plantings/${plantingId}`, body, {
          withCredentials: true,
        }),
      );
      return planting;
    } catch (err) {
      this.rethrowClientError(err);
      await this.enqueue({
        key: this.queue.entityKey('planting', plantingId),
        kind: 'planting',
        gardenId,
        op: 'update',
        body: { ...body, clientMutationId },
        clientMutationId,
        updatedAt: Date.now(),
      });
      const list = await this.listOrThrow(gardenId);
      const found = list.plantings.find((p) => p.id === plantingId);
      if (!found) throw err;
      return found;
    }
  }

  async remove(gardenId: string, plantingId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${API}/gardens/${gardenId}/plantings/${plantingId}`, {
          withCredentials: true,
        }),
      );
      await this.invalidateLayout(gardenId);
    } catch (err) {
      this.rethrowClientError(err);
      await this.enqueue({
        key: this.queue.entityKey('planting', plantingId),
        kind: 'planting',
        gardenId,
        op: 'delete',
        clientMutationId: crypto.randomUUID(),
        updatedAt: Date.now(),
      });
      await this.invalidateLayout(gardenId);
    }
  }

  async createBed(gardenId: string, body: BedCreateDto): Promise<NamedBedDto> {
    const payload: BedCreateDto = { ...body, id: body.id ?? crypto.randomUUID() };
    try {
      return await firstValueFrom(
        this.http.post<NamedBedDto>(`${API}/gardens/${gardenId}/beds`, payload, {
          withCredentials: true,
        }),
      );
    } catch (err) {
      this.rethrowClientError(err);
      await this.enqueue({
        key: this.queue.entityKey('bed', payload.id!),
        kind: 'bed',
        gardenId,
        op: 'create',
        body: payload,
        clientMutationId: crypto.randomUUID(),
        updatedAt: Date.now(),
      });
      return {
        id: payload.id!,
        name: payload.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async renameBed(
    gardenId: string,
    bedId: string,
    name: string,
    sun?: 'full' | 'part' | 'shade' | null,
    extra?: { site?: 'raised' | 'in_ground'; mulch?: NamedBedDto['mulch'] },
  ): Promise<NamedBedDto> {
    const body = {
      name,
      ...(sun !== undefined ? { sun } : {}),
      ...(extra?.site !== undefined ? { site: extra.site } : {}),
      ...(extra?.mulch !== undefined ? { mulch: extra.mulch } : {}),
    };
    try {
      return await firstValueFrom(
        this.http.patch<NamedBedDto>(`${API}/gardens/${gardenId}/beds/${bedId}`, body, {
          withCredentials: true,
        }),
      );
    } catch (err) {
      this.rethrowClientError(err);
      await this.enqueue({
        key: this.queue.entityKey('bed', bedId),
        kind: 'bed',
        gardenId,
        op: 'update',
        body,
        clientMutationId: crypto.randomUUID(),
        updatedAt: Date.now(),
      });
      return {
        id: bedId,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async deleteBed(gardenId: string, bedId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.delete(`${API}/gardens/${gardenId}/beds/${bedId}`, { withCredentials: true }),
      );
    } catch (err) {
      this.rethrowClientError(err);
      await this.enqueue({
        key: this.queue.entityKey('bed', bedId),
        kind: 'bed',
        gardenId,
        op: 'delete',
        clientMutationId: crypto.randomUUID(),
        updatedAt: Date.now(),
      });
    }
  }

  async syncFailures(gardenId: string): Promise<QueueItem[]> {
    return (await this.queue.listForGarden(gardenId)).filter((item) => Boolean(item.failedMessage));
  }

  async drain(gardenId: string) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const pending = await this.queue.listForGarden(gardenId);
    for (const item of pending) {
      if (item.failedMessage) continue;
      try {
        await this.play(item);
        await this.queue.delete(item.key);
      } catch (err) {
        if (isNotFound(err)) {
          const message = apiMessage(err) ?? 'Planting not found';
          if (item.op !== 'create') {
            await this.queue.markFailed(item.key, message);
            continue;
          }
        }
        if (isGardenGone(err)) {
          const userId = this.userId();
          if (userId) await this.cache.delete(userId, gardenId);
          await this.queue.dropGarden(gardenId);
          return;
        }
        if (isClientError(err)) {
          await this.queue.markFailed(item.key, apiMessage(err) ?? 'Sync failed');
        }
      }
    }
  }

  private async play(item: QueueItem) {
    const { gardenId } = item;
    const id = item.key.split(':')[1]!;
    if (item.kind === 'planting') {
      if (item.op === 'create') {
        await firstValueFrom(
          this.http.post(`${API}/gardens/${gardenId}/plantings`, item.body, {
            withCredentials: true,
          }),
        );
        return;
      }
      if (item.op === 'update') {
        await firstValueFrom(
          this.http.patch(`${API}/gardens/${gardenId}/plantings/${id}`, item.body, {
            withCredentials: true,
          }),
        );
        return;
      }
      await firstValueFrom(
        this.http.delete(`${API}/gardens/${gardenId}/plantings/${id}`, { withCredentials: true }),
      );
      return;
    }
    if (item.op === 'create') {
      await firstValueFrom(
        this.http.post(`${API}/gardens/${gardenId}/beds`, item.body, { withCredentials: true }),
      );
      return;
    }
    if (item.op === 'update') {
      await firstValueFrom(
        this.http.patch(`${API}/gardens/${gardenId}/beds/${id}`, item.body, {
          withCredentials: true,
        }),
      );
      return;
    }
    await firstValueFrom(
      this.http.delete(`${API}/gardens/${gardenId}/beds/${id}`, { withCredentials: true }),
    );
  }

  private async fetchAllPages(gardenId: string, season?: number): Promise<PlantingListDto> {
    const first = await this.fetchPage(gardenId, 1, 200, season);
    const plantings = [...first.plantings];
    const pages = Math.max(1, Math.ceil(first.total / first.pageSize));
    for (let page = 2; page <= pages; page++) {
      const next = await this.fetchPage(gardenId, page, first.pageSize, season);
      plantings.push(...next.plantings);
    }
    return { ...first, plantings };
  }

  private fetchPage(gardenId: string, page: number, pageSize: number, season?: number) {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (season) params = params.set('season', String(season));
    return firstValueFrom(
      this.http.get<PlantingListDto>(`${API}/gardens/${gardenId}/plantings`, {
        params,
        withCredentials: true,
      }),
    );
  }

  private async listOrThrow(gardenId: string, season?: number): Promise<ClientPlantingList> {
    const list = await this.list(gardenId, season);
    if (!list) throw new UserFacingError('Garden not found');
    return list;
  }

  private async enqueue(item: QueueItem) {
    await this.queue.put(item);
  }

  /**
   * Succession planting: sow it again every N weeks until a date. Needs the
   * server (the series is worked out there), so it is not queued offline.
   */
  async repeat(
    gardenId: string,
    plantingId: string,
    body: { everyWeeks: number; until: string },
  ): Promise<PlantingRepeatResultDto> {
    return firstValueFrom(
      this.http.post<PlantingRepeatResultDto>(
        `${API}/gardens/${gardenId}/plantings/${plantingId}/repeat`,
        body,
        { withCredentials: true },
      ),
    );
  }

  /** Log a harvest (ADR 0038). Needs the server; amounts are not queued offline. */
  async logHarvest(
    gardenId: string,
    plantingId: string,
    body: { harvestedOn: string; grams: number | null; count: number | null },
  ): Promise<PlantingDto> {
    return firstValueFrom(
      this.http.post<PlantingDto>(
        `${API}/gardens/${gardenId}/plantings/${plantingId}/harvests`,
        body,
        { withCredentials: true },
      ),
    );
  }

  async deleteHarvest(
    gardenId: string,
    plantingId: string,
    harvestedOn: string,
  ): Promise<PlantingDto> {
    return firstValueFrom(
      this.http.delete<PlantingDto>(
        `${API}/gardens/${gardenId}/plantings/${plantingId}/harvests/${harvestedOn}`,
        { withCredentials: true },
      ),
    );
  }

  /** A season's harvests by crop; the latest season with any when none is given. */
  async harvestTotals(gardenId: string, season?: number): Promise<HarvestTotalsDto> {
    return firstValueFrom(
      this.http.get<HarvestTotalsDto>(`${API}/gardens/${gardenId}/harvests`, {
        params: season ? { season: String(season) } : {},
        withCredentials: true,
      }),
    );
  }

  /** The last sowing of a planting's crop that ripens before frost here, or null. */
  async repeatPlan(gardenId: string, plantingId: string): Promise<string | null> {
    try {
      const plan = await firstValueFrom(
        this.http.get<{ lastSowOn: string | null }>(
          `${API}/gardens/${gardenId}/plantings/${plantingId}/repeat`,
          { withCredentials: true },
        ),
      );
      return plan.lastSowOn;
    } catch {
      return null;
    }
  }

  /** Soil tests need the server: a lab report is entered once, not queued (ADR 0033). */
  async recordSoilTest(
    gardenId: string,
    owner: SoilTestOwner,
    test: SoilTestCreateDto,
  ): Promise<SoilTestDto> {
    const saved = await firstValueFrom(
      this.http.post<SoilTestDto>(soilTestsPath(gardenId, owner), test, { withCredentials: true }),
    );
    await this.invalidateLayout(gardenId);
    return saved;
  }

  /** Deletes a test and returns its owner's latest test now. */
  async deleteSoilTest(
    gardenId: string,
    owner: SoilTestOwner,
    testId: string,
  ): Promise<SoilTestDto | null> {
    const result = await firstValueFrom(
      this.http.delete<{ latest: SoilTestDto | null }>(
        `${soilTestsPath(gardenId, owner)}/${testId}`,
        { withCredentials: true },
      ),
    );
    await this.invalidateLayout(gardenId);
    return result.latest;
  }

  private userId(): string | null {
    return this.auth.currentUserId();
  }

  private async invalidateLayout(gardenId: string): Promise<void> {
    const userId = this.userId();
    if (userId) await this.layoutCache.delete(userId, gardenId);
  }

  private rethrowClientError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status >= 400 && err.status < 500) {
      throw err;
    }
  }
}

function soilTestsPath(gardenId: string, owner: SoilTestOwner): string {
  const where = 'bedId' in owner ? `beds/${owner.bedId}` : `areas/${owner.areaId}`;
  return `${API}/gardens/${gardenId}/${where}/soil-tests`;
}

function isNotFound(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 404;
}

function isGardenGone(err: unknown): boolean {
  return isNotFound(err) && apiMessage(err) === 'Garden not found';
}

function isClientError(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status >= 400 && err.status < 500;
}
