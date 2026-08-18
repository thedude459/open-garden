import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { ReminderListDto, ReminderMutationDto } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { GardenRemindersCacheService } from './garden-reminders-cache.service';
import {
  RemindersOfflineQueue,
  type ClientReminderList,
  type ReminderQueueAction,
  type ReminderQueueItem,
} from './reminders-offline.queue';

const API = '/api';

export class RemindersColdOfflineError extends Error {
  constructor() {
    super('Connect to load reminders for the first time.');
    this.name = 'RemindersColdOfflineError';
  }
}

@Injectable({ providedIn: 'root' })
export class RemindersApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(GardenRemindersCacheService);
  private readonly queue = inject(RemindersOfflineQueue);
  private readonly auth = inject(AuthApiService);

  localTodayAsOf(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async list(gardenId: string): Promise<ClientReminderList | null> {
    const userId = this.userId();
    if (typeof navigator === 'undefined' || navigator.onLine) {
      try {
        await this.drain(gardenId);
      } catch {
        /* failed items remain marked */
      }
    }

    try {
      const list = await this.fetchList(gardenId);
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
      if (isOfflineFetch(err)) {
        throw new RemindersColdOfflineError();
      }
      throw err;
    }
  }

  async complete(
    gardenId: string,
    body: ReminderMutationDto,
    intervalDays: number | null,
  ): Promise<ClientReminderList | null> {
    return this.mutate(gardenId, body, 'complete', intervalDays);
  }

  async dismiss(
    gardenId: string,
    body: ReminderMutationDto,
    intervalDays: number | null,
  ): Promise<ClientReminderList | null> {
    return this.mutate(gardenId, body, 'dismiss', intervalDays);
  }

  private async mutate(
    gardenId: string,
    body: ReminderMutationDto,
    action: ReminderQueueAction,
    intervalDays: number | null,
  ): Promise<ClientReminderList | null> {
    const path =
      action === 'complete'
        ? `${API}/gardens/${gardenId}/reminders/complete`
        : `${API}/gardens/${gardenId}/reminders/dismiss`;

    try {
      await firstValueFrom(
        this.http.post(path, body, {
          withCredentials: true,
          responseType: 'text',
        }),
      );
      await this.queue.delete(this.queue.itemKey(body.plantingId, body.kind, body.dueOn));
      return this.list(gardenId);
    } catch (err) {
      if (isNotFound(err)) {
        const userId = this.userId();
        if (userId) {
          await this.cache.delete(userId, gardenId);
          await this.queue.dropGarden(gardenId);
        }
        return null;
      }
      this.rethrowClientError(err);
      await this.enqueue(gardenId, body, action, intervalDays);
      return this.list(gardenId);
    }
  }

  private async fetchList(gardenId: string): Promise<ReminderListDto> {
    const asOf = this.localTodayAsOf();
    return firstValueFrom(
      this.http.get<ReminderListDto>(`${API}/gardens/${gardenId}/reminders`, {
        params: { asOf },
        withCredentials: true,
      }),
    );
  }

  private async enqueue(
    gardenId: string,
    body: ReminderMutationDto,
    action: ReminderQueueAction,
    intervalDays: number | null,
  ) {
    const key = this.queue.itemKey(body.plantingId, body.kind, body.dueOn);
    await this.queue.put({
      key,
      gardenId,
      plantingId: body.plantingId,
      kind: body.kind,
      dueOn: body.dueOn,
      action,
      intervalDays,
      updatedAt: Date.now(),
    });
  }

  private async drain(gardenId: string) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const pending = await this.queue.listForGarden(gardenId);
    for (const item of pending) {
      if (item.failedMessage) continue;
      const path =
        item.action === 'complete'
          ? `${API}/gardens/${gardenId}/reminders/complete`
          : `${API}/gardens/${gardenId}/reminders/dismiss`;
      try {
        await firstValueFrom(
          this.http.post(
            path,
            { plantingId: item.plantingId, kind: item.kind, dueOn: item.dueOn },
            { withCredentials: true, responseType: 'text' },
          ),
        );
        await this.queue.delete(item.key);
      } catch (err) {
        if (isGardenGone(err)) {
          const userId = this.userId();
          if (userId) {
            await this.cache.delete(userId, gardenId);
            await this.queue.dropGarden(gardenId);
          }
          return;
        }
        if (isClientError(err)) {
          await this.queue.markFailed(item.key, errorMessage(err) ?? 'Sync failed');
        }
      }
    }
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
  return isNotFound(err) && errorMessage(err) === 'Garden not found';
}

function isClientError(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status >= 400 && err.status < 500;
}

function isOfflineFetch(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 502);
}

function errorMessage(err: unknown): string | undefined {
  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (body && typeof body === 'object' && 'error' in body) {
      return (body as { error?: { message?: string } }).error?.message;
    }
  }
  return undefined;
}
