import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { CalendarAddDto, CalendarDto } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { GardenCalendarCacheService } from './garden-calendar-cache.service';
import { OnlineRequiredError } from './gardens-api.service';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class CalendarApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(GardenCalendarCacheService);
  private readonly auth = inject(AuthApiService);

  async get(gardenId: string, page = 1, pageSize = 100): Promise<CalendarDto | null> {
    const userId = this.userId();
    try {
      const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
      const calendar = await firstValueFrom(
        this.http.get<CalendarDto>(`${API}/gardens/${gardenId}/calendar`, {
          params,
          withCredentials: true,
        }),
      );
      if (userId) await this.cache.save(userId, calendar);
      return calendar;
    } catch (err) {
      if (isNotFound(err)) {
        if (userId) await this.cache.delete(userId, gardenId);
        return null;
      }
      if (userId) return this.cache.get(userId, gardenId);
      return null;
    }
  }

  async add(gardenId: string, body: CalendarAddDto): Promise<CalendarDto> {
    this.assertOnline();
    try {
      const calendar = await firstValueFrom(
        this.http.post<CalendarDto>(`${API}/gardens/${gardenId}/calendar`, body, {
          withCredentials: true,
        }),
      );
      const userId = this.userId();
      if (userId) await this.cache.save(userId, calendar);
      return calendar;
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  async remove(gardenId: string, plantId: string): Promise<void> {
    this.assertOnline();
    try {
      await firstValueFrom(
        this.http.delete(`${API}/gardens/${gardenId}/calendar/${plantId}`, {
          withCredentials: true,
        }),
      );
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
  return err instanceof HttpErrorResponse && err.status === 404;
}
