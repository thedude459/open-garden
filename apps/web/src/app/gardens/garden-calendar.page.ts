import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { overlapsThisWeek } from '@open-garden/planting-calendar/this-week';
import type {
  CalendarDto,
  CalendarEntryDto,
  FavoriteListItemDto,
  PlantSummaryDto,
  PlantType,
  SeasonalWindowDto,
} from '@open-garden/shared-types';
import { PLANT_TYPES } from '@open-garden/shared-types';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantsApiService } from '../plants/plants-api.service';
import { CalendarApiService } from './calendar-api.service';
import { OnlineRequiredError } from './gardens-api.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <p><a [routerLink]="['/gardens', gardenId]">Back to garden</a></p>
    <h2>Planting calendar</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (!calendar()) {
      <p class="muted">Garden unavailable or not found.</p>
    } @else {
      @if (calendar(); as cal) {
        @if (!cal.windowsAvailable) {
          <p class="banner" role="status">
            Windows cannot be produced until both last frost and first frost dates are set.
            Plants on this calendar are still listed below.
          </p>
        }
        @if (canEdit()) {
          <form class="filters" (ngSubmit)="searchCatalog()">
            <input
              [(ngModel)]="searchQ"
              name="calendarSearch"
              placeholder="Search catalog to add"
            />
            <button type="submit">Search catalog</button>
            <button type="button" (click)="loadFavorites()">Show favorites</button>
          </form>
          @if (catalogHits().length) {
            <ul class="card-list">
              @for (p of catalogHits(); track p.id) {
                <li class="row">
                  <span>{{ p.commonName }}</span>
                  <button type="button" (click)="add(p.id)">Add {{ p.commonName }}</button>
                </li>
              }
            </ul>
          }
          @if (favorites().length) {
            <h3>Your favorites</h3>
            <ul class="card-list">
              @for (f of favorites(); track f.favoriteId) {
                <li class="row">
                  <span>{{ f.plant.commonName }}</span>
                  <button type="button" (click)="add(f.plant.id)">
                    Add favorite {{ f.plant.commonName }}
                  </button>
                </li>
              }
            </ul>
          }
        }
        <div class="filters">
          <label>
            Type
            <select [(ngModel)]="typeFilter" name="plantTypeFilter">
              <option value="">All types</option>
              @for (t of types; track t) {
                <option [value]="t">{{ t }}</option>
              }
            </select>
          </label>
        </div>
        @if (visible().length === 0 && cal.entries.length === 0) {
          <p class="muted">No plants on this calendar yet.</p>
        } @else if (visible().length === 0) {
          <p class="muted">No plants match this type.</p>
          <button type="button" (click)="clearFilter()">Clear filter</button>
        } @else {
          <div class="card-list">
            @for (e of visible(); track e.plantId) {
              <article class="row" [class.this-week-row]="isThisWeek(e)">
                <div>
                  @if (isThisWeek(e)) {
                    <span class="this-week">This week</span>
                  }
                  <strong>{{ e.commonName }}</strong>
                  <span class="muted"> · {{ e.plantType }}</span>
                  @if (e.status !== 'active') {
                    <span class="badge">Unavailable variety</span>
                  }
                  @if (e.zoneMismatch) {
                    <span class="badge">Zone mismatch</span>
                  }
                  <p class="muted">
                    Indoor {{ formatWindow(e.windows.indoorStart) }} · Sow
                    {{ formatWindow(e.windows.outdoorSow) }} · Transplant
                    {{ formatWindow(e.windows.transplant) }} · Harvest
                    {{ formatWindow(e.windows.harvest) }}
                  </p>
                </div>
                @if (canEdit()) {
                  <button type="button" (click)="remove(e.plantId)">Remove {{ e.commonName }}</button>
                }
              </article>
            }
          </div>
        }
      }
    }
  `,
})
export class GardenCalendarPage implements OnInit {
  private readonly api = inject(CalendarApiService);
  private readonly plants = inject(PlantsApiService);
  private readonly favoritesApi = inject(FavoritesApiService);
  private readonly route = inject(ActivatedRoute);
  gardenId = '';
  calendar = signal<CalendarDto | null>(null);
  loading = signal(true);
  error = signal('');
  searchQ = '';
  typeFilter = '';
  types = PLANT_TYPES;
  catalogHits = signal<PlantSummaryDto[]>([]);
  favorites = signal<FavoriteListItemDto[]>([]);

  ngOnInit() {
    this.gardenId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.gardenId) void this.load();
  }

  canEdit() {
    const role = this.calendar()?.myRole;
    return role === 'owner' || role === 'collaborator';
  }

  visible(): CalendarEntryDto[] {
    const cal = this.calendar();
    if (!cal) return [];
    const today = new Date();
    const filtered = this.typeFilter
      ? cal.entries.filter((e) => e.plantType === (this.typeFilter as PlantType))
      : cal.entries;
    return [...filtered].sort((a, b) => compareEntries(a, b, today));
  }

  isThisWeek(entry: CalendarEntryDto): boolean {
    return overlapsThisWeek(
      [entry.windows.indoorStart, entry.windows.outdoorSow, entry.windows.transplant],
      new Date(),
    );
  }

  formatWindow(window: SeasonalWindowDto | null): string {
    if (!window) return 'unavailable';
    const a = formatMd(window.earliest);
    const b = formatMd(window.latest);
    return a === b ? a : `${a} – ${b}`;
  }

  clearFilter() {
    this.typeFilter = '';
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    const calendar = await this.api.get(this.gardenId);
    this.calendar.set(calendar);
    this.loading.set(false);
  }

  async searchCatalog() {
    this.error.set('');
    const page = await this.plants.list({ q: this.searchQ, page: 1, pageSize: 20 });
    this.catalogHits.set(page.items);
  }

  async loadFavorites() {
    this.error.set('');
    const page = await this.favoritesApi.list();
    this.favorites.set(page.items);
  }

  async add(plantId: string) {
    this.error.set('');
    try {
      const calendar = await this.api.add(this.gardenId, { plantId });
      this.calendar.set(calendar);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async remove(plantId: string) {
    this.error.set('');
    try {
      await this.api.remove(this.gardenId, plantId);
      await this.load();
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }
}

function compareEntries(a: CalendarEntryDto, b: CalendarEntryDto, today: Date): number {
  const ae = overlapsThisWeek(
    [a.windows.indoorStart, a.windows.outdoorSow, a.windows.transplant],
    today,
  )
    ? 0
    : 1;
  const be = overlapsThisWeek(
    [b.windows.indoorStart, b.windows.outdoorSow, b.windows.transplant],
    today,
  )
    ? 0
    : 1;
  if (ae !== be) return ae - be;
  const an = nextStartKey(a, today);
  const bn = nextStartKey(b, today);
  if (an !== bn) return an - bn;
  return a.commonName.localeCompare(b.commonName);
}

function nextStartKey(entry: CalendarEntryDto, today: Date): number {
  const windows = [
    entry.windows.indoorStart,
    entry.windows.outdoorSow,
    entry.windows.transplant,
  ].filter((w): w is SeasonalWindowDto => w != null);
  if (!windows.length) return Number.POSITIVE_INFINITY;
  const todayKey = mdKey({ month: today.getMonth() + 1, day: today.getDate() });
  const keys = windows.map((w) => mdKey(w.earliest));
  const upcoming = keys.filter((k) => k >= todayKey);
  return upcoming.length ? Math.min(...upcoming) : Math.min(...keys) + 1300;
}

function mdKey(md: { month: number; day: number }): number {
  return md.month * 100 + md.day;
}

function formatMd(md: { month: number; day: number }): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[md.month - 1] ?? md.month} ${md.day}`;
}

function messageFrom(err: unknown): string {
  if (err instanceof OnlineRequiredError) return err.message;
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: { message?: string } } | null)?.error?.message;
    if (msg) return msg;
  }
  return 'Could not update calendar';
}
