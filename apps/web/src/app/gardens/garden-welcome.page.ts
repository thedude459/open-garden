import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { inchesFromInput, lengthInput, lengthStep, lengthUnit } from '@open-garden/garden-layout';
import type {
  GardenDetailDto,
  PlantListQueryDto,
  PlantSummaryDto,
} from '@open-garden/shared-types';
import { plantName } from '@open-garden/shared-types';
import { formatMonthDay } from '@open-garden/web-ui';
import { AuthApiService } from '../auth/auth-api.service';
import { PlantsApiService } from '../plants/plants-api.service';
import { localIso } from '../today/today-groups';
import { NoticeService } from '../ui/notice.service';
import { PlantIcon } from '../ui/plant-icon';
import { CalendarApiService } from './calendar-api.service';
import { GardensApiService } from './gardens-api.service';
import { PlantingsApiService } from './plantings-api.service';
import { starterCrops } from './starter-crops';
import { errorMessage } from '../ui/error-message';

/**
 * A new property's first run: the climate its address gave it, a few easy
 * crops for its calendar, and a first bed. Every step can be skipped.
 */
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, PlantIcon],
  styles: `
    .welcome-step {
      padding-block: var(--space-4);
      border-top: 1px solid var(--line);
    }
    .starter-list {
      list-style: none;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: var(--space-2);
    }
    .starter-list label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
  `,
  template: `
    @if (garden(); as g) {
      <h2>Set up {{ g.name }}</h2>
      <p class="muted">Three steps to a first plan. Skip any of them; all can be changed later.</p>
      <p><a [routerLink]="['/gardens', g.id, 'layout']">Go to the plan</a></p>

      <section class="welcome-step" aria-labelledby="climate-step">
        <h3 id="climate-step">1. Your climate</h3>
        @if (g.hardinessZone != null) {
          <p>Hardiness zone {{ g.hardinessZone }}.</p>
        }
        @if (g.lastFrost && g.firstFrost) {
          <p>
            Last spring frost around {{ formatMonthDay(g.lastFrost) }}, first fall frost around
            {{ formatMonthDay(g.firstFrost) }}. Sowing times count from these.
          </p>
        } @else if (g.frostFree) {
          <p>It rarely frosts here, so sowing times follow the monthly temperatures.</p>
        } @else {
          <p>No frost dates were found for this address.</p>
        }
        <p class="muted">
          From 30 years of weather at the address.
          <a [routerLink]="['/gardens', g.id, 'configure']" fragment="climate">Change them</a> if
          your garden differs.
        </p>
      </section>

      <section class="welcome-step" aria-labelledby="crops-step">
        <h3 id="crops-step">2. Pick a few crops</h3>
        @if (cropsLoading()) {
          <p class="muted">Loading…</p>
        } @else if (starters().length === 0) {
          <p class="muted">
            Search the <a routerLink="/plants">catalog</a> for crops; none of the starter crops grow
            in this zone.
          </p>
        } @else {
          <p class="muted">
            Easy crops that grow in this zone; those you can sow this week come first. They are
            planned for this season: the calendar says when to sow each one, and Bed View offers
            them to place in a bed.
          </p>
          <ul class="starter-list">
            @for (p of starters(); track p.id) {
              <li>
                <label>
                  <input
                    type="checkbox"
                    [checked]="picked().has(p.id)"
                    [disabled]="added().has(p.id)"
                    (change)="toggle(p.id)"
                  />
                  <og-plant-icon [plantType]="p.plantType" [cropId]="p.cropId" />
                  <span>
                    {{ plantName(p) }}
                    @if (added().has(p.id)) {
                      <span class="muted"> · on the calendar</span>
                    } @else if (sowable().has(p.id)) {
                      <span class="this-week">Sow this week</span>
                    }
                  </span>
                </label>
              </li>
            }
          </ul>
          <button
            type="button"
            class="btn btn-primary"
            (click)="addCrops()"
            [disabled]="toAdd().length === 0 || notices.busyMap().has('add-crops')"
            [attr.aria-busy]="notices.busyMap().has('add-crops') || null"
          >
            Add {{ toAdd().length }} to the calendar
          </button>
        }
      </section>

      <section class="welcome-step" aria-labelledby="bed-step">
        <h3 id="bed-step">3. Add a first bed</h3>
        @if (bedAdded()) {
          <p>{{ bedAdded() }} is on the plan.</p>
          <a class="btn btn-primary" [routerLink]="['/gardens', g.id, 'layout']">Open the plan</a>
        } @else {
          <form class="filters" (ngSubmit)="addBed(g)">
            <label>
              Name
              <input [(ngModel)]="bedName" name="bedName" required />
            </label>
            <label>
              Length ({{ lengthUnit(units()) }})
              <input
                type="number"
                [min]="lengthStep(units())"
                [step]="lengthStep(units())"
                [(ngModel)]="bedLength"
                name="bedLength"
                required
              />
            </label>
            <label>
              Width ({{ lengthUnit(units()) }})
              <input
                type="number"
                [min]="lengthStep(units())"
                [step]="lengthStep(units())"
                [(ngModel)]="bedWidth"
                name="bedWidth"
                required
              />
            </label>
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="notices.busyMap().has('add-bed')"
              [attr.aria-busy]="notices.busyMap().has('add-bed') || null"
            >
              Add bed
            </button>
          </form>
          <p class="muted">It goes in the middle of the property; move it on the plan.</p>
        }
      </section>
    } @else if (loading()) {
      <p class="muted">Loading…</p>
    } @else {
      <p class="muted">Garden unavailable offline or not found.</p>
    }
  `,
})
export class GardenWelcomePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly gardens = inject(GardensApiService);
  private readonly plants = inject(PlantsApiService);
  private readonly calendar = inject(CalendarApiService);
  private readonly plantings = inject(PlantingsApiService);
  readonly notices = inject(NoticeService);
  readonly units = inject(AuthApiService).units;
  readonly plantName = plantName;
  readonly formatMonthDay = formatMonthDay;
  readonly lengthUnit = lengthUnit;
  readonly lengthStep = lengthStep;

  readonly garden = signal<GardenDetailDto | null>(null);
  readonly loading = signal(true);
  readonly cropsLoading = signal(true);
  readonly starters = signal<PlantSummaryDto[]>([]);
  readonly sowable = signal<ReadonlySet<string>>(new Set());
  readonly picked = signal<ReadonlySet<string>>(new Set());
  readonly added = signal<ReadonlySet<string>>(new Set());
  readonly toAdd = computed(() => [...this.picked()].filter((id) => !this.added().has(id)));
  readonly bedAdded = signal('');
  bedName = 'Bed 1';
  /** A common raised bed: 8 × 4 ft. */
  bedLength = lengthInput(96, this.units());
  bedWidth = lengthInput(48, this.units());

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.load(id);
    else this.loading.set(false);
  }

  async load(id: string) {
    const garden = await this.gardens.detail(id);
    this.garden.set(garden);
    this.loading.set(false);
    if (garden) await this.loadStarters(garden);
  }

  private async loadStarters(g: GardenDetailDto) {
    try {
      const zone = g.hardinessZone ?? undefined;
      const [catalog, now] = await Promise.all([
        this.allPages({ zone }),
        this.allPages({ zone, sowNowFor: g.id, asOf: localIso() }),
      ]);
      const sowable = new Set(now.map((p) => p.id));
      this.sowable.set(sowable);
      this.starters.set(starterCrops(catalog, g.hardinessZone, sowable));
    } finally {
      this.cropsLoading.set(false);
    }
  }

  /** Every catalog entry matching a query; the catalog is a few hundred at most. */
  private async allPages(query: PlantListQueryDto): Promise<PlantSummaryDto[]> {
    const items: PlantSummaryDto[] = [];
    for (let page = 1; page <= 10; page++) {
      const result = await this.plants.list({ ...query, page, pageSize: 100 });
      items.push(...result.items);
      if (items.length >= result.totalCount || result.items.length === 0) break;
    }
    return items;
  }

  toggle(id: string) {
    const next = new Set(this.picked());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.picked.set(next);
  }

  async addCrops() {
    const g = this.garden();
    if (!g) return;
    await this.notices.run('add-crops', async () => {
      const ids = this.toAdd();
      try {
        for (const plantId of ids) {
          await this.calendar.add(g.id, { plantId });
          this.added.set(new Set([...this.added(), plantId]));
        }
        this.notices.success(`Added ${ids.length} to the calendar`);
      } catch (err) {
        this.notices.error(errorMessage(err, 'Could not add to the calendar'));
      }
    });
  }

  async addBed(g: GardenDetailDto) {
    const units = this.units();
    const length = Math.min(g.lengthInches, Math.max(6, inchesFromInput(this.bedLength, units)));
    const width = Math.min(g.widthInches, Math.max(6, inchesFromInput(this.bedWidth, units)));
    const name = this.bedName.trim() || 'Bed 1';
    await this.notices.run('add-bed', async () => {
      try {
        await this.plantings.createBed(g.id, {
          name,
          lengthInches: length,
          widthInches: width,
          originXInches: Math.round((g.lengthInches - length) / 2),
          originYInches: Math.round((g.widthInches - width) / 2),
        });
        this.bedAdded.set(name);
        this.notices.success(`${name} added`);
      } catch (err) {
        this.notices.error(errorMessage(err, 'Could not add the bed'));
      }
    });
  }
}
