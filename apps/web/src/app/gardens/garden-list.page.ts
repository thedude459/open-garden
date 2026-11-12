import { Component, OnDestroy, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  convertLength,
  inchesFromInput,
  lengthInput,
  lengthStep,
  lengthUnit,
  snapHalfFoot,
} from '@open-garden/garden-layout';
import { embedMapReachable, embedMapUrl } from '@open-garden/garden-place';
import type { GardenSummaryDto, PlaceCandidateDto, Units } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { HttpErrorResponse } from '@angular/common/http';
import { GardensApiService, OnlineRequiredError } from './gardens-api.service';
import { NoticeService } from '../ui/notice.service';
import { EmptyState } from '../ui/empty-state';
import { localIso } from '../today/today-groups';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, EmptyState],
  template: `
    <h2>Properties</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (items().length > 0 && !creating()) {
      <p>
        <button type="button" class="btn btn-secondary" (click)="creating.set(true)">
          New property
        </button>
      </p>
    }
    @if ((!loading() && items().length === 0) || creating()) {
      <form class="filters card" (ngSubmit)="create()">
        <input [(ngModel)]="name" name="gardenName" placeholder="Property name" required />
        <label>
          Length ({{ lengthUnit(units()) }})
          <input
            type="number"
            [min]="lengthStep(units())"
            [step]="lengthStep(units())"
            name="gardenLength"
            [(ngModel)]="lengthValue"
            required
          />
        </label>
        <label>
          Width ({{ lengthUnit(units()) }})
          <input
            type="number"
            [min]="lengthStep(units())"
            [step]="lengthStep(units())"
            name="gardenWidth"
            [(ngModel)]="widthValue"
            required
          />
        </label>
        <input [(ngModel)]="notes" name="gardenNotes" placeholder="Notes (optional)" />
        <input [(ngModel)]="addressQuery" name="gardenAddress" placeholder="Garden address" />
        <button type="button" class="btn btn-secondary" (click)="lookup()" [disabled]="lookingUp()">
          Look up address
        </button>
        @if (lookupError()) {
          <p class="error">{{ lookupError() }}</p>
        }
        @if (truncated()) {
          <p>Type a more specific address.</p>
        }
        @for (candidate of candidates(); track candidate.placeId) {
          <button type="button" class="btn btn-secondary" (click)="choose(candidate)">
            {{ candidate.formattedAddress }}
          </button>
        }
        @if (mapSrc(); as src) {
          <iframe
            class="garden-map"
            style="width: 100%; height: 220px; border: 0"
            [src]="src"
            title="Garden map"
            (error)="onMapError()"
          ></iframe>
        }
        @if (mapUnavailable()) {
          <p>The map is unavailable.</p>
        }
        <button
          type="submit"
          class="btn btn-primary"
          [attr.aria-busy]="notices.busyMap().has('create-garden') || null"
          [disabled]="notices.busyMap().has('create-garden') || !canCreate()"
        >
          Create property
        </button>
      </form>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (items().length === 0) {
      <og-empty-state title="No properties yet" [body]="emptyBody()" />
    } @else {
      <div class="card-list">
        @for (g of items(); track g.id) {
          <a class="garden-card" [routerLink]="['/gardens', g.id, 'layout']">
            <span class="garden-card-header">
              <strong>{{ g.name }}</strong>
              <span class="role">{{ g.myRole }}</span>
            </span>
            <span class="garden-facts">
              <span>{{ g.bedCount }} {{ g.bedCount === 1 ? 'bed' : 'beds' }}</span>
              <span
                >{{ g.placementCount }} {{ g.placementCount === 1 ? 'plant' : 'plants' }} in
                beds</span
              >
              <span>
                @if (g.hardinessZone != null) {
                  Zone {{ g.hardinessZone }}
                } @else {
                  Zone not set
                }
              </span>
              @if (g.overdueCount) {
                <span>{{ g.overdueCount }} overdue</span>
              }
              @if (g.thisWeekCount) {
                <span>{{ g.thisWeekCount }} this week</span>
              }
            </span>
          </a>
        }
      </div>
    }
  `,
})
export class GardenListPage implements OnInit, OnDestroy {
  private readonly api = inject(GardensApiService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly notices = inject(NoticeService);
  name = '';
  notes = '';
  addressQuery = '';
  readonly units = inject(AuthApiService).units;
  readonly lengthUnit = lengthUnit;
  readonly lengthStep = lengthStep;
  /** Units the size fields are typed in; a switch converts what is typed. */
  sizeUnits: Units = this.units();
  /** Property size as typed (20 × 10 ft to start). */
  lengthValue = lengthInput(240, this.sizeUnits);
  widthValue = lengthInput(120, this.sizeUnits);
  private readonly followUnits = effect(() => {
    const units = this.units();
    untracked(() => {
      if (units === this.sizeUnits) return;
      this.lengthValue = convertLength(this.lengthValue, this.sizeUnits, units);
      this.widthValue = convertLength(this.widthValue, this.sizeUnits, units);
      this.sizeUnits = units;
    });
  });
  readonly candidates = signal<PlaceCandidateDto[]>([]);
  readonly truncated = signal(false);
  readonly selected = signal<PlaceCandidateDto | null>(null);
  readonly mapSrc = signal<SafeResourceUrl | null>(null);
  readonly mapReady = signal(false);
  readonly mapFailed = signal(false);
  readonly lookingUp = signal(false);
  readonly lookupError = signal('');
  items = signal<GardenSummaryDto[]>([]);
  readonly creating = signal(false);
  loading = signal(true);
  error = signal('');
  private loadGen = 0;
  private mapGen = 0;
  private mapWatch: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    void this.load();
  }

  ngOnDestroy() {
    this.clearMapWatch();
  }

  canCreate(): boolean {
    return this.selected() != null && this.mapReady() && !this.mapFailed() && !this.truncated();
  }

  mapUnavailable(): boolean {
    return this.selected() != null && this.mapFailed();
  }

  async lookup() {
    this.lookupError.set('');
    this.candidates.set([]);
    this.selected.set(null);
    this.truncated.set(false);
    this.clearMap();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.lookupError.set(new OnlineRequiredError().message);
      return;
    }
    this.lookingUp.set(true);
    try {
      const result = await this.api.lookupPlace(this.addressQuery);
      this.candidates.set(result.candidates);
      this.truncated.set(result.truncated);
      if (result.candidates.length === 1 && !result.truncated) this.choose(result.candidates[0]!);
    } catch (err) {
      this.lookupError.set(userMessage(err));
    } finally {
      this.lookingUp.set(false);
    }
  }

  choose(candidate: PlaceCandidateDto) {
    this.selected.set(candidate);
    this.clearMap();
    if (this.truncated()) return;
    const url = embedMapUrl(candidate.latitude, candidate.longitude);
    this.mapSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    this.watchMap(url);
  }

  onMapError() {
    this.clearMapWatch();
    this.mapFailed.set(true);
    this.mapReady.set(false);
  }

  private clearMap() {
    this.clearMapWatch();
    this.mapSrc.set(null);
    this.mapReady.set(false);
    this.mapFailed.set(false);
  }

  /** ponytail: iframe load also fires when the embed is aborted, and the parent cannot read that document. A no-cors fetch is the failure signal. Upgrade path is a load event that only fires for a finished document. */
  private watchMap(url: string) {
    this.clearMapWatch();
    const gen = this.mapGen;
    this.mapWatch = setTimeout(() => {
      if (gen === this.mapGen) this.onMapError();
    }, 3000);
    void embedMapReachable(url).then((ok) => {
      if (gen !== this.mapGen) return;
      if (!ok) {
        this.onMapError();
        return;
      }
      this.clearMapWatch();
      this.mapFailed.set(false);
      this.mapReady.set(true);
    });
  }

  private clearMapWatch() {
    this.mapGen++;
    if (this.mapWatch == null) return;
    clearTimeout(this.mapWatch);
    this.mapWatch = null;
  }

  emptyBody() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return new OnlineRequiredError().message;
    }
    return 'Create one to start planning with your household.';
  }

  async load() {
    const gen = ++this.loadGen;
    this.loading.set(true);
    const page = await this.api.listAll();
    if (gen !== this.loadGen) return;
    let counts = new Map<string, { overdue: number; thisWeek: number }>();
    try {
      const today = await this.api.today(localIso());
      if (gen !== this.loadGen) return;
      counts = new Map(today.gardens.map((garden) => [garden.id, garden]));
    } catch {
      /* the counts are optional on the property cards */
    }
    this.items.set(
      page.items.map((garden) => {
        const count = counts.get(garden.id);
        return withCounts({
          ...garden,
          overdueCount: count?.overdue ?? 0,
          thisWeekCount: count?.thisWeek ?? 0,
        });
      }),
    );
    this.loading.set(false);
  }

  async create() {
    const place = this.selected();
    if (!place || !this.canCreate()) return;
    this.error.set('');
    await this.notices.run('create-garden', async () => {
      try {
        const created = await this.api.create({
          name: this.name,
          notes: this.notes.trim() ? this.notes : null,
          lengthInches: gardenInches(this.lengthValue, this.sizeUnits),
          widthInches: gardenInches(this.widthValue, this.sizeUnits),
          place,
        });
        this.name = '';
        this.notes = '';
        this.addressQuery = '';
        this.candidates.set([]);
        this.selected.set(null);
        this.truncated.set(false);
        this.clearMap();
        this.sizeUnits = this.units();
        this.lengthValue = lengthInput(240, this.sizeUnits);
        this.widthValue = lengthInput(120, this.sizeUnits);
        this.loadGen++;
        this.items.update((list) => [
          withCounts(created),
          ...list.filter((g) => g.id !== created.id),
        ]);
        this.creating.set(false);
        this.loading.set(false);
        this.notices.success(
          created.seasonNotice ? `Garden created. ${created.seasonNotice}` : 'Garden created',
        );
      } catch (err) {
        this.notices.error(userMessage(err));
      }
    });
  }
}

function gardenInches(value: number, units: Units): number {
  return Math.max(6, snapHalfFoot(inchesFromInput(value, units)));
}

function userMessage(err: unknown): string {
  if (err instanceof OnlineRequiredError) return err.message;
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: { message?: string } } | null)?.error?.message;
    if (msg) return msg;
  }
  return 'Could not save garden';
}

function withCounts(g: GardenSummaryDto): GardenSummaryDto {
  return {
    ...g,
    bedCount: g.bedCount ?? 0,
    placementCount: g.placementCount ?? 0,
  };
}
