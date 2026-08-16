import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  BedCreateDto,
  NamedBedDto,
  PlantingCreateDto,
  PlantingDto,
  PlantingListDto,
  PlantingPatchDto,
} from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { GardenPlantingsCacheService } from './garden-plantings-cache.service';
import {
  PlantingsOfflineQueue,
  type ClientPlantingList,
  type PlantingPreview,
  type QueueItem,
} from './plantings-offline.queue';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class PlantingsApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(GardenPlantingsCacheService);
  private readonly queue = inject(PlantingsOfflineQueue);
  private readonly auth = inject(AuthApiService);

  async list(gardenId: string): Promise<ClientPlantingList | null> {
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
      return this.listOrThrow(gardenId);
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

  async renameBed(gardenId: string, bedId: string, name: string): Promise<NamedBedDto> {
    try {
      return await firstValueFrom(
        this.http.patch<NamedBedDto>(`${API}/gardens/${gardenId}/beds/${bedId}`, { name }, {
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
        body: { name },
        clientMutationId: crypto.randomUUID(),
        updatedAt: Date.now(),
      });
      return { id: bedId, name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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
          this.http.post(`${API}/gardens/${gardenId}/plantings`, item.body, { withCredentials: true }),
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
        this.http.patch(`${API}/gardens/${gardenId}/beds/${id}`, item.body, { withCredentials: true }),
      );
      return;
    }
    await firstValueFrom(
      this.http.delete(`${API}/gardens/${gardenId}/beds/${id}`, { withCredentials: true }),
    );
  }

  private async fetchAllPages(gardenId: string): Promise<PlantingListDto> {
    const first = await this.fetchPage(gardenId, 1, 200);
    const plantings = [...first.plantings];
    const pages = Math.max(1, Math.ceil(first.total / first.pageSize));
    for (let page = 2; page <= pages; page++) {
      const next = await this.fetchPage(gardenId, page, first.pageSize);
      plantings.push(...next.plantings);
    }
    return { ...first, plantings };
  }

  private fetchPage(gardenId: string, page: number, pageSize: number) {
    const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    return firstValueFrom(
      this.http.get<PlantingListDto>(`${API}/gardens/${gardenId}/plantings`, {
        params,
        withCredentials: true,
      }),
    );
  }

  private async listOrThrow(gardenId: string): Promise<ClientPlantingList> {
    const list = await this.list(gardenId);
    if (!list) throw new Error('Garden not found');
    return list;
  }

  private async enqueue(item: QueueItem) {
    await this.queue.put(item);
  }

  private userId(): string | null {
    return this.auth.currentUserId();
  }

  private rethrowClientError(err: unknown): void {
    if (err instanceof HttpErrorResponse && err.status >= 400 && err.status < 500) {
      throw err;
    }
  }
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

function apiMessage(err: unknown): string | undefined {
  if (!(err instanceof HttpErrorResponse)) return undefined;
  const body = err.error as { error?: { message?: string } } | null;
  return body?.error?.message;
}
