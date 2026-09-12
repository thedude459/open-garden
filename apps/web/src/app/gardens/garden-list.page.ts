import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { overlapsThisWeek } from '@open-garden/planting-calendar/this-week';
import type { GardenSummaryDto } from '@open-garden/shared-types';
import { HttpErrorResponse } from '@angular/common/http';
import { GardensApiService, OnlineRequiredError } from './gardens-api.service';
import { CalendarApiService } from './calendar-api.service';
import { RemindersApiService } from './reminders-api.service';
import { NoticeService } from '../ui/notice.service';
import { EmptyState } from '../ui/empty-state';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, EmptyState],
  template: `
    <h2>Gardens</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    <form class="filters" (ngSubmit)="create()">
      <input [(ngModel)]="name" name="gardenName" placeholder="Garden name" required />
      <input [(ngModel)]="notes" name="gardenNotes" placeholder="Notes (optional)" />
      <button
        type="submit"
        class="btn btn-primary"
        [attr.aria-busy]="notices.busyMap().has('create-garden') || null"
        [disabled]="notices.busyMap().has('create-garden')"
      >
        Create garden
      </button>
    </form>
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (items().length === 0) {
      <og-empty-state title="No gardens yet" [body]="emptyBody()" />
    } @else {
      <div class="card-list">
        @for (g of items(); track g.id) {
          <a class="row" [routerLink]="['/gardens', g.id, 'layout']">
            <span>
              <strong>{{ g.name }}</strong>
              <span class="muted"> · {{ g.myRole }}</span>
            </span>
            <span class="muted">
              {{ g.bedCount }} beds · {{ g.placementCount }} placements
              ·
              @if (g.hardinessZone != null) {
                zone {{ g.hardinessZone }}
              } @else {
                zone not set
              }
              @if (note(g.id); as a) {
                @if (a.overdue) {
                  <span class="needs-attention"> · {{ a.overdue }} overdue</span>
                }
                @if (a.thisWeek) {
                  <span class="this-week"> · {{ a.thisWeek }} this week</span>
                }
              }
            </span>
          </a>
        }
      </div>
    }
  `,
})
export class GardenListPage implements OnInit {
  private readonly api = inject(GardensApiService);
  private readonly reminders = inject(RemindersApiService);
  private readonly calendar = inject(CalendarApiService);
  readonly notices = inject(NoticeService);
  name = '';
  notes = '';
  items = signal<GardenSummaryDto[]>([]);
  attention = signal<Record<string, { overdue: number; thisWeek: number }>>({});
  loading = signal(false);
  error = signal('');
  private loadGen = 0;

  note(id: string) {
    return this.attention()[id];
  }

  ngOnInit() {
    void this.load();
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
    this.items.set(page.items.map(withCounts));
    this.loading.set(false);
    void this.enrich(this.items());
  }

  // ponytail: O(gardens with beds/placements) extra GETs. Quiet gardens skip. Upgrade: counts on GET /gardens.
  private async enrich(gardens: GardenSummaryDto[]) {
    const need = gardens.filter((g) => (g.bedCount ?? 0) > 0 || (g.placementCount ?? 0) > 0);
    if (!need.length) return;
    const pairs = await Promise.all(
      need.map(async (g) => {
        const [reminders, calendar] = await Promise.all([
          this.reminders.list(g.id).catch(() => null),
          this.calendar.get(g.id).catch(() => null),
        ]);
        const overdue =
          reminders?.items.filter((i) => i.urgency === 'overdue' || i.urgency === 'dueToday')
            .length ?? 0;
        const today = new Date();
        const thisWeek =
          calendar?.entries.filter((e) =>
            overlapsThisWeek(
              [e.windows.indoorStart, e.windows.outdoorSow, e.windows.transplant],
              today,
            ),
          ).length ?? 0;
        return [g.id, { overdue, thisWeek }] as const;
      }),
    );
    this.attention.update((cur) => {
      const next = { ...cur };
      for (const [id, a] of pairs) next[id] = a;
      return next;
    });
  }

  async create() {
    this.error.set('');
    await this.notices.run('create-garden', async () => {
      try {
        const created = await this.api.create({
          name: this.name,
          notes: this.notes.trim() ? this.notes : null,
        });
        this.name = '';
        this.notes = '';
        this.loadGen++;
        this.items.update((list) => [
          withCounts(created),
          ...list.filter((g) => g.id !== created.id),
        ]);
        this.loading.set(false);
        this.notices.success('Garden created');
      } catch (err) {
        this.notices.error(userMessage(err));
      }
    });
  }
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
