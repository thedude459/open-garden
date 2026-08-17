import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { ReminderItemDto } from '@open-garden/shared-types';
import {
  RemindersApiService,
  RemindersColdOfflineError,
} from './reminders-api.service';
import { PlantingsApiService } from './plantings-api.service';
import { type ClientReminderItem, type ClientReminderList } from './reminders-offline.queue';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <p><a [routerLink]="['/gardens', gardenId]">Back to garden</a></p>
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
        <ul class="card-list">
          @for (item of data.items; track trackItem(item)) {
            <li class="row">
              <div>
                <strong>{{ item.commonName }}</strong>
                @if (item.status !== 'active') {
                  <span class="badge">Unavailable variety</span>
                }
                <p>
                  <span class="badge">{{ kindLabel(item.kind) }}</span>
                  <span class="badge">{{ urgencyLabel(item.urgency) }}</span>
                  due {{ item.dueOn }}
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
                  <button type="button" (click)="complete(item)">Complete</button>
                  <button type="button" (click)="dismiss(item)">Dismiss</button>
                </div>
              }
            </li>
          }
        </ul>
      }
    }
  `,
})
export class GardenRemindersPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(RemindersApiService);
  private readonly plantingsApi = inject(PlantingsApiService);

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

  kindLabel(kind: ReminderItemDto['kind']) {
    if (kind === 'harvest') return 'Harvest';
    if (kind === 'water') return 'Water';
    return 'Fertilize';
  }

  urgencyLabel(urgency: ReminderItemDto['urgency']) {
    if (urgency === 'overdue') return 'Overdue';
    if (urgency === 'dueToday') return 'Due today';
    return 'Upcoming';
  }

  async complete(item: ClientReminderItem) {
    await this.mutate(item, 'complete');
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
      this.list.set(next);
    } catch (err) {
      this.error.set(readError(err));
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
      this.list.set(data);
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
