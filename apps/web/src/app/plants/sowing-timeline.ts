import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { plantTimeline } from '@open-garden/planting-calendar/timeline';
import type {
  GardenDetailDto,
  GardenSummaryDto,
  PlantDetailDto,
  SeasonalWindowDto,
} from '@open-garden/shared-types';
import { formatMonthDay } from '@open-garden/web-ui';
import { CalendarApiService } from '../gardens/calendar-api.service';
import { GardensApiService, OnlineRequiredError } from '../gardens/gardens-api.service';
import { NoticeService } from '../ui/notice.service';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * When to sow, plant out, and harvest a crop at one of the member's
 * properties, worked out on the device from that property's frost dates or
 * monthly temperatures, with a button to put the crop on its calendar.
 */
@Component({
  selector: 'og-sowing-timeline',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styles: `
    .timeline {
      display: grid;
      grid-template-columns: minmax(7rem, max-content) 1fr;
      gap: var(--space-2) var(--space-3);
      align-items: center;
      margin-block: var(--space-4);
    }
    .months,
    .track {
      position: relative;
      display: grid;
      grid-template-columns: repeat(12, 1fr);
    }
    .months span {
      font-size: 0.75rem;
      color: var(--muted);
      text-align: center;
    }
    .track {
      height: 1.25rem;
      background: var(--sand);
      border-radius: var(--radius);
    }
    .span {
      position: absolute;
      inset-block: 0;
      border-radius: var(--radius);
      background: var(--leaf);
    }
    .span[data-kind='transplant'] {
      background: #4f7f5a;
    }
    .span[data-kind='harvest'] {
      background: #8a5a1f;
    }
    .today {
      position: absolute;
      inset-block: -0.25rem;
      width: 2px;
      background: var(--ink);
    }
    .label small {
      display: block;
      color: var(--muted);
    }
  `,
  template: `
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading">When to sow</h2>
      @if (gardens().length === 0) {
        <p class="muted">
          <a routerLink="/gardens">Add a property</a> to see when to sow this crop where you grow.
        </p>
      } @else {
        <label>
          Property
          <select [ngModel]="gardenId()" (ngModelChange)="choose($event)" name="timelineGarden">
            @for (g of gardens(); track g.id) {
              <option [ngValue]="g.id">{{ g.name }}</option>
            }
          </select>
        </label>
        @if (loading()) {
          <p class="muted">Loading…</p>
        } @else if (rows() === null) {
          <p class="muted">
            Set this property's frost dates in
            <a [routerLink]="['/gardens', gardenId(), 'configure']">Settings</a> to see when to sow
            here.
          </p>
        } @else if (rows()!.length === 0) {
          <p class="muted">The catalog has no sowing times for this crop here.</p>
        } @else {
          <div class="timeline">
            <span></span>
            <div class="months" aria-hidden="true">
              @for (m of months; track $index) {
                <span>{{ m }}</span>
              }
            </div>
            @for (row of rows(); track row.kind) {
              <span class="label">
                {{ row.label }}
                <small>{{ range(row.window) }}</small>
              </span>
              <div class="track" aria-hidden="true">
                @for (s of row.spans; track $index) {
                  <span
                    class="span"
                    [attr.data-kind]="row.kind"
                    [style.left.%]="s.startPct"
                    [style.width.%]="s.widthPct"
                  ></span>
                }
                <span class="today" [style.left.%]="todayPct"></span>
              </div>
            }
          </div>
        }
        @if (canEdit()) {
          <button
            type="button"
            class="btn btn-secondary"
            (click)="addToPlan()"
            [disabled]="notices.busyMap().has('add-to-plan')"
            [attr.aria-busy]="notices.busyMap().has('add-to-plan') || null"
          >
            Add to plan
          </button>
        }
      }
    </section>
  `,
})
export class SowingTimeline implements OnInit {
  private readonly gardensApi = inject(GardensApiService);
  private readonly calendarApi = inject(CalendarApiService);
  readonly notices = inject(NoticeService);

  readonly plant = input.required<PlantDetailDto>();
  readonly gardens = signal<GardenSummaryDto[]>([]);
  readonly gardenId = signal<string | null>(null);
  private readonly detail = signal<GardenDetailDto | null>(null);
  readonly loading = signal(false);
  readonly months = MONTHS;
  readonly todayPct = (dayOfYear(new Date()) / 365) * 100;

  readonly rows = computed(() => {
    const garden = this.detail();
    return garden ? plantTimeline(garden, this.plant(), new Date()) : null;
  });
  readonly canEdit = computed(() => {
    const g = this.gardens().find((x) => x.id === this.gardenId());
    return !!g && g.myRole !== 'viewer';
  });

  ngOnInit() {
    void this.loadGardens();
  }

  private async loadGardens() {
    try {
      const page = await this.gardensApi.listAll();
      this.gardens.set(page.items);
      const first = page.items[0];
      if (first) await this.choose(first.id);
    } catch {
      this.gardens.set([]);
    }
  }

  async choose(id: string) {
    this.gardenId.set(id);
    this.loading.set(true);
    try {
      const detail = await this.gardensApi.detail(id);
      if (this.gardenId() === id) this.detail.set(detail);
    } finally {
      if (this.gardenId() === id) this.loading.set(false);
    }
  }

  range(window: SeasonalWindowDto): string {
    const a = formatMonthDay(window.earliest);
    const b = formatMonthDay(window.latest);
    return a === b ? a : `${a} – ${b}`;
  }

  async addToPlan() {
    const id = this.gardenId();
    const garden = this.gardens().find((g) => g.id === id);
    if (!id || !garden) return;
    await this.notices.run('add-to-plan', async () => {
      try {
        await this.calendarApi.add(id, { plantId: this.plant().id });
        this.notices.success(`Added to the ${garden.name} calendar`);
      } catch (err) {
        this.notices.error(messageFrom(err));
      }
    });
  }
}

function dayOfYear(d: Date): number {
  return Math.min(
    364,
    Math.floor(
      (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) /
        86_400_000,
    ),
  );
}

function messageFrom(err: unknown): string {
  if (err instanceof OnlineRequiredError) return err.message;
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: { message?: string } } | null)?.error?.message;
    if (msg) return msg;
  }
  return 'Could not add to the plan';
}
