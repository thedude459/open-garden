import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { PLANT_TYPES, plantName } from '@open-garden/shared-types';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { GardenSummaryDto, PlantSummaryDto, PlantType } from '@open-garden/shared-types';
import { PlantsApiService } from './plants-api.service';
import { GardensApiService } from '../gardens/gardens-api.service';
import { localIso } from '../today/today-groups';
import { EmptyState } from '../ui/empty-state';
import { PlantIcon } from '../ui/plant-icon';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, EmptyState, PlantIcon],
  template: `
    <h2>Plant catalog</h2>
    <div class="filters">
      <input
        [(ngModel)]="q"
        name="q"
        placeholder="Search name / species / variety"
        (ngModelChange)="scheduleLoad()"
      />
      <select [(ngModel)]="zone" name="zone" (ngModelChange)="scheduleLoad()">
        <option [ngValue]="undefined">Any zone</option>
        @for (z of zones; track z) {
          <option [ngValue]="z">Zone {{ z }}</option>
        }
      </select>
      <select
        [(ngModel)]="plantType"
        name="plantType"
        aria-label="Type"
        (ngModelChange)="scheduleLoad()"
      >
        <option [ngValue]="undefined">Any type</option>
        @for (t of types; track t) {
          <option [ngValue]="t">{{ t }}</option>
        }
      </select>
      @if (families().length) {
        <select
          [(ngModel)]="family"
          name="family"
          aria-label="Family"
          (ngModelChange)="scheduleLoad()"
        >
          <option [ngValue]="undefined">Any family</option>
          @for (f of families(); track f) {
            <option [ngValue]="f">{{ f }}</option>
          }
        </select>
      }
      @if (gardens().length) {
        <select
          [(ngModel)]="sowNowFor"
          name="sowNowFor"
          aria-label="Can sow now"
          (ngModelChange)="scheduleLoad()"
        >
          <option [ngValue]="undefined">Any time</option>
          @for (g of gardens(); track g.id) {
            <option [ngValue]="g.id">Can sow this week at {{ g.name }}</option>
          }
        </select>
      }
      <button
        type="button"
        class="btn btn-primary"
        (click)="load()"
        [attr.aria-busy]="searching() || null"
      >
        Apply
      </button>
    </div>
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (items().length === 0) {
      <og-empty-state
        title="No plants match"
        [body]="
          sowNowFor
            ? 'Nothing opens to sow or plant there this week. Try another week on the Calendar.'
            : 'Try another name or clear filters.'
        "
      />
    } @else {
      <div class="card-list">
        @for (p of items(); track p.id) {
          <a class="row" [routerLink]="['/plants', p.id]">
            @if (p.illustrationUrl) {
              <img [src]="p.illustrationUrl" alt="" width="32" height="32" decoding="async" />
            } @else {
              <og-plant-icon [plantType]="p.plantType" [family]="p.family" />
            }
            <span>
              <strong>{{ plantName(p) }}</strong>
              <span class="muted"> — {{ p.species }} </span>
            </span>
            <span class="muted">{{ p.plantType }} · z{{ p.zoneMin }}–{{ p.zoneMax }}</span>
          </a>
        }
      </div>
    }
  `,
})
export class PlantListPage implements OnInit, OnDestroy {
  readonly plantName = plantName;
  private readonly api = inject(PlantsApiService);
  private readonly gardensApi = inject(GardensApiService);
  q = '';
  zone: number | undefined;
  plantType: PlantType | undefined;
  family: string | undefined;
  /** A property: show only crops whose window there is open this week. */
  sowNowFor: string | undefined;
  readonly families = signal<string[]>([]);
  readonly gardens = signal<GardenSummaryDto[]>([]);
  zones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  types = PLANT_TYPES;
  items = signal<PlantSummaryDto[]>([]);
  loading = signal(false);
  searching = signal(false);
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private loadGen = 0;

  ngOnInit() {
    void this.load();
    void this.api.families().then((f) => this.families.set(f));
    void this.gardensApi
      .listAll()
      .then((page) => this.gardens.set(page.items))
      .catch(() => undefined);
  }

  ngOnDestroy() {
    if (this.loadTimer) clearTimeout(this.loadTimer);
  }

  scheduleLoad() {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.loadTimer = setTimeout(() => void this.load(), 180);
  }

  async load() {
    if (this.loadTimer) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
    const gen = ++this.loadGen;
    this.searching.set(true);
    if (!this.items().length) this.loading.set(true);
    try {
      const page = await this.api.list({
        q: this.q || undefined,
        zone: this.zone,
        plantType: this.plantType,
        family: this.family,
        sowNowFor: this.sowNowFor,
        asOf: this.sowNowFor ? localIso() : undefined,
        page: 1,
        pageSize: 100,
      });
      if (gen !== this.loadGen) return;
      this.items.set(page.items);
    } finally {
      if (gen === this.loadGen) {
        this.loading.set(false);
        this.searching.set(false);
      }
    }
  }
}
