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

  /**
   * The current season's calendar, kept for offline use; or with `season`,
   * the next one (ADR 0040), which needs a connection and is not kept.
   */
  async get(
    gardenId: string,
    page = 1,
    pageSize = 100,
    season?: number | null,
  ): Promise<CalendarDto | null> {
    const userId = season ? null : this.userId();
    try {
      let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
      if (season) params = params.set('season', String(season));
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
      if (season) throw err;
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
      const userId = body.seasonYear ? null : this.userId();
      if (userId) await this.cache.save(userId, calendar);
      return calendar;
    } catch (err) {
      this.rethrowConnectivity(err);
    }
  }

  /** Takes a crop's unplaced, planned plantings off the season shown. */
  async remove(gardenId: string, plantId: string, season?: number | null): Promise<void> {
    this.assertOnline();
    try {
      await firstValueFrom(
        this.http.delete(`${API}/gardens/${gardenId}/calendar/${plantId}`, {
          withCredentials: true,
          params: season ? { season: String(season) } : {},
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
