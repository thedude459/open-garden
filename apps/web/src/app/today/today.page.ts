import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { alertAdvice, alertHeadline } from '@open-garden/reminder-delivery/messages';
import type { TodayDto, TodayTaskDto } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { GardensApiService } from '../gardens/gardens-api.service';
import { RemindersApiService } from '../gardens/reminders-api.service';
import { EmptyState } from '../ui/empty-state';
import { ReminderSettings } from './reminder-settings';
import { NoticeService } from '../ui/notice.service';
import { groupTodayTasks, localIso, type TodayGroup } from './today-groups';
import { errorMessage } from '../ui/error-message';

type Alert = NonNullable<TodayDto['alerts']>[number];

/** The home page: what needs doing today across every property. */
@Component({
  standalone: true,
  imports: [RouterLink, EmptyState, ReminderSettings],
  template: `
    <h2>Today</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (!hasProperties()) {
      <og-empty-state
        title="No properties yet"
        body="Add your garden as a property. Watering, feeding, and harvest tasks, and crops to sow this week, then show up here."
      >
        <a class="btn btn-primary" routerLink="/gardens">Add a property</a>
      </og-empty-state>
    } @else if (groups().length === 0 && alerts().length === 0) {
      <og-empty-state
        title="Nothing to do today"
        body="Watering, feeding, and harvest tasks, and crops whose sowing window opens this week, show up here once your beds have plantings."
      >
        <a class="btn btn-secondary" routerLink="/gardens">Your properties</a>
      </og-empty-state>
    } @else {
      @if (alerts().length) {
        <section class="weather-alerts" aria-labelledby="weather-heading">
          <h3 id="weather-heading">Weather</h3>
          <ul class="card-list">
            @for (alert of alerts(); track alert.gardenId + alert.kind) {
              <li class="row weather-alert" [attr.data-kind]="alert.kind">
                <div>
                  <strong>{{ headline(alert) }}</strong>
                  <p>
                    <a [routerLink]="['/gardens', alert.gardenId, 'layout']">{{
                      alert.gardenName
                    }}</a>: {{ advice(alert) }}
                  </p>
                </div>
              </li>
            }
          </ul>
        </section>
      }
      @for (group of groups(); track group.gardenId) {
        <section>
          <h3>
            <a [routerLink]="['/gardens', group.gardenId, 'layout']">{{ group.gardenName }}</a>
          </h3>
          @if (group.due.length) {
            <ul class="card-list" [attr.aria-label]="'Due at ' + group.gardenName">
              @for (task of group.due; track taskKey(task)) {
                <li class="row">
                  <div>
                    <strong>{{ task.title }}</strong>
                    <p class="muted">
                      @if (task.bedName) {
                        {{ task.bedName }} ·
                      }
                      <span [class.reminder-overdue]="task.kind === 'overdue'">{{
                        task.kind === 'overdue' ? 'Overdue' : 'Due today'
                      }}</span>
                    </p>
                  </div>
                  @if (task.reminder && task.canEdit !== false) {
                    <button
                      type="button"
                      class="btn btn-secondary"
                      [attr.aria-label]="'Done: ' + task.title"
                      (click)="complete(task)"
                    >
                      Done
                    </button>
                  }
                </li>
              }
            </ul>
          }
          @if (group.start.length) {
            <h4>Start this week</h4>
            <ul class="card-list">
              @for (task of group.start; track taskKey(task)) {
                <li class="row">
                  <strong>{{ task.title }}</strong>
                  <a
                    class="btn btn-secondary"
                    [routerLink]="['/gardens', task.gardenId, 'calendar']"
                    >Calendar</a
                  >
                </li>
              }
            </ul>
          }
        </section>
      }
    }
    @if (!loading() && hasProperties()) {
      <og-reminder-settings />
    }
  `,
})
export class TodayPage implements OnInit {
  private readonly gardens = inject(GardensApiService);
  private readonly reminders = inject(RemindersApiService);
  private readonly notices = inject(NoticeService);
  private readonly units = inject(AuthApiService).units;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly hasProperties = signal(false);
  readonly groups = signal<TodayGroup[]>([]);
  /** Frost and heat ahead for plants in beds, soonest first. */
  readonly alerts = signal<Alert[]>([]);
  private tasks: TodayTaskDto[] = [];

  ngOnInit() {
    void this.load();
  }

  headline(alert: Alert) {
    return alertHeadline(alert, this.units());
  }

  advice(alert: Alert) {
    const text = alertAdvice(alert);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  taskKey(task: TodayTaskDto) {
    const r = task.reminder;
    return r ? `${r.plantingId}:${r.kind}:${r.dueOn}` : `${task.gardenId}:${task.title}`;
  }

  async complete(task: TodayTaskDto) {
    const r = task.reminder;
    if (!r) return;
    this.error.set('');
    try {
      // Queued when offline, like the Tasks page.
      await this.reminders.complete(
        task.gardenId,
        { plantingId: r.plantingId, kind: r.kind, dueOn: r.dueOn },
        r.intervalDays,
      );
      this.tasks = this.tasks.filter((t) => t !== task);
      this.groups.set(groupTodayTasks(this.tasks));
      this.notices.success(`${task.title}: done`);
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not load today’s tasks'));
    }
  }

  private async load() {
    this.loading.set(true);
    try {
      const [page, today] = await Promise.all([
        this.gardens.listAll(),
        this.gardens.today(localIso()),
      ]);
      this.hasProperties.set(page.items.length > 0);
      this.tasks = today.tasks;
      this.groups.set(groupTodayTasks(this.tasks));
      this.alerts.set([...(today.alerts ?? [])].sort((a, b) => a.date.localeCompare(b.date)));
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not load today’s tasks'));
    } finally {
      this.loading.set(false);
    }
  }
}
