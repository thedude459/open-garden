import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  RemindersApiService,
  RemindersColdOfflineError,
} from './reminders-api.service';
import { PlantingsApiService } from './plantings-api.service';
import { NoticeService } from '../ui/notice.service';
import { type ClientReminderItem, type ClientReminderList } from './reminders-offline.queue';
import { rainForDeviceDay } from './garden-reminders-cache.service';
@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <h2>Reminders</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (coldOffline()) {
      <p class="muted">Connect to load reminders for the first time.</p>
    } @else if (!list()) {
      <p class="muted">Garden unavailable or not found.</p>
    } @else if (list(); as data) {
      @if (data.items.length === 0) {
        @if (emptyGarden()) {
          <p class="muted">Record plantings to see care reminders.</p>
          <p><a [routerLink]="['/gardens', gardenId, 'plantings']">Go to plantings</a></p>
        } @else {
          <p class="muted">Nothing due or not ready yet.</p>
        }
      } @else {
        @for (group of groups(data.items); track group.bedName) {
          <h3>{{ group.bedName }}</h3>
          <ul class="card-list">
          @for (item of group.items; track trackItem(item)) {
            <li class="row">
              <div>
                <strong>{{ item.commonName }}</strong>
                @if (item.status !== 'active') {
                  <span class="badge">Unavailable variety</span>
                }
                <p>
                  <span class="badge">{{ kindLabel(item.kind) }}</span>
                  <span class="badge" [class.reminder-overdue]="item.required !== false && item.urgency === 'overdue'">{{ urgencyLabel(item) }}</span>
                  due {{ item.dueOn }}
                  @if (item.rainNote) {
                    <span>{{ item.rainNote }}</span>
                  }
                  @if (item.sync === 'pending') {
                    <span class="badge">pending</span>
                  }
                  @if (item.sync === 'failed') {
                    <span class="badge">needs attention</span>
                  }
                </p>
              </div>
              @if (canEdit()) {
                <div class="filters">
                  <button type="button" class="btn btn-secondary" (click)="complete(item)">Complete</button>
                  <button type="button" class="btn btn-secondary" (click)="dismiss(item)">Dismiss</button>
                </div>
              }
            </li>
          }
          </ul>
        }
      }
    }
  `,
})
export class GardenRemindersPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(RemindersApiService);
  private readonly plantingsApi = inject(PlantingsApiService);
  private readonly notices = inject(NoticeService);

  gardenId = '';
  readonly list = signal<ClientReminderList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly coldOffline = signal(false);
  readonly emptyGarden = signal(false);

  ngOnInit() {
    this.gardenId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.refresh();
  }

  canEdit(): boolean {
    const role = this.list()?.myRole;
    return role === 'owner' || role === 'collaborator';
  }

  trackItem(item: ClientReminderItem) {
    return `${item.plantingId}:${item.kind}:${item.dueOn}:${item.sync ?? ''}`;
  }

  kindLabel(kind: ClientReminderItem['kind']) {
    if (kind === 'harvest') return 'Harvest';
    if (kind === 'water') return 'Water';
    return 'Fertilize';
  }

  urgencyLabel(item: ClientReminderItem) {
    if (item.required === false) return 'Not needed';
    if (item.urgency === 'overdue') return 'Overdue';
    if (item.urgency === 'dueToday') return 'Due today';
    return 'Upcoming';
  }

  groups(items: ClientReminderItem[]) {
    const order: string[] = [];
    const byBed = new Map<string, ClientReminderItem[]>();
    for (const item of items) {
      const name = item.bedName?.trim() || 'Not in a bed';
      if (!byBed.has(name)) {
        byBed.set(name, []);
        order.push(name);
      }
      byBed.get(name)!.push(item);
    }
    order.sort((a, b) => {
      if (a === 'Not in a bed') return 1;
      if (b === 'Not in a bed') return -1;
      return a.localeCompare(b);
    });
    return order.map((bedName) => ({ bedName, items: byBed.get(bedName) ?? [] }));
  }

  async complete(item: ClientReminderItem) {
    const ok = await this.mutate(item, 'complete');
    if (!ok || item.kind !== 'harvest' || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
      return;
    }
    const body = { plantingId: item.plantingId, kind: item.kind, dueOn: item.dueOn };
    this.notices.success('Date saved', () => {
      void this.api.undo(this.gardenId, body).then(() => this.refresh());
    });
  }

  async dismiss(item: ClientReminderItem) {
    await this.mutate(item, 'dismiss');
  }

  private async mutate(item: ClientReminderItem, action: 'complete' | 'dismiss') {
    this.error.set(null);
    try {
      const body = { plantingId: item.plantingId, kind: item.kind, dueOn: item.dueOn };
      const next =
        action === 'complete'
          ? await this.api.complete(this.gardenId, body, item.intervalDays)
          : await this.api.dismiss(this.gardenId, body, item.intervalDays);
      this.list.set(next ? rainForDeviceDay(next) : next);
      return true;
    } catch (err) {
      this.error.set(readError(err));
      return false;
    }
  }

  private async refresh() {
    this.loading.set(true);
    this.error.set(null);
    this.coldOffline.set(false);
    try {
      const [data, plantings] = await Promise.all([
        this.api.list(this.gardenId),
        this.plantingsApi.list(this.gardenId),
      ]);
      this.list.set(data ? rainForDeviceDay(data) : data);
      this.emptyGarden.set((plantings?.plantings.length ?? 0) === 0);
    } catch (err) {
      if (err instanceof RemindersColdOfflineError) {
        this.coldOffline.set(true);
        this.list.set(null);
      } else {
        this.error.set(readError(err));
      }
    } finally {
      this.loading.set(false);
    }
  }
}

function readError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (body && typeof body === 'object' && 'error' in body) {
      return (body as { error?: { message?: string } }).error?.message ?? 'Request failed';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Request failed';
}
