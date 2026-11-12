import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import type { NotificationSettingsDto } from '@open-garden/shared-types';
import { firstValueFrom } from 'rxjs';
import { NotificationsApiService } from './notifications-api.service';

/** Push on this device and the daily email, for the signed-in member. */
@Component({
  selector: 'og-reminder-settings',
  standalone: true,
  template: `
    @if (settings(); as s) {
      <section class="card reminder-settings" aria-labelledby="reminder-settings-heading">
        <h3 id="reminder-settings-heading">Reminders</h3>
        <p class="muted">
          Due watering, feeding, and harvest tasks are sent once a day, from {{ hourLabel(s) }}.
        </p>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        @if (!s.pushAvailable) {
          <p class="muted">Push reminders are not set up on this server.</p>
        } @else if (!push.isEnabled) {
          <p class="muted">
            This browser cannot receive push reminders here. Install the app, or use a browser that
            supports notifications.
          </p>
        } @else if (onThisDevice()) {
          <p>
            Push reminders are on for this device.
            <button type="button" class="btn btn-secondary" [disabled]="busy()" (click)="pushOff()">
              Turn off on this device
            </button>
          </p>
        } @else {
          <p>
            <button type="button" class="btn btn-secondary" [disabled]="busy()" (click)="pushOn(s)">
              Turn on push reminders on this device
            </button>
          </p>
        }
        @if (!s.emailAvailable) {
          <p class="muted">Email reminders are not set up on this server.</p>
        } @else {
          <label>
            <input
              type="checkbox"
              name="emailDigest"
              [checked]="s.emailDigest"
              [disabled]="busy()"
              (change)="setEmail($event)"
            />
            Email me a daily summary
          </label>
        }
      </section>
    }
  `,
})
export class ReminderSettings implements OnInit {
  readonly push = inject(SwPush);
  private readonly api = inject(NotificationsApiService);
  readonly settings = signal<NotificationSettingsDto | null>(null);
  readonly onThisDevice = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  ngOnInit() {
    void this.load();
  }

  private async load() {
    try {
      this.settings.set(await this.api.settings());
      if (this.push.isEnabled) {
        this.onThisDevice.set((await firstValueFrom(this.push.subscription)) !== null);
      }
    } catch {
      /* the card stays hidden; Today still works without it */
    }
  }

  hourLabel(s: NotificationSettingsDto) {
    return `${String(s.reminderHour).padStart(2, '0')}:00`;
  }

  async pushOn(s: NotificationSettingsDto) {
    if (!s.vapidPublicKey) return;
    await this.run(async () => {
      const sub = (
        await this.push.requestSubscription({ serverPublicKey: s.vapidPublicKey! })
      ).toJSON();
      if (!sub.endpoint || !sub.keys?.['p256dh'] || !sub.keys?.['auth']) {
        throw new Error('This browser did not give a push subscription');
      }
      await this.api.subscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys['p256dh'], auth: sub.keys['auth'] },
      });
      this.onThisDevice.set(true);
    });
  }

  async pushOff() {
    await this.run(async () => {
      const sub = await firstValueFrom(this.push.subscription);
      if (sub) {
        await this.api.unsubscribe(sub.endpoint);
        await this.push.unsubscribe();
      }
      this.onThisDevice.set(false);
    });
  }

  async setEmail(event: Event) {
    const enabled = (event.target as HTMLInputElement).checked;
    await this.run(async () => {
      await this.api.setEmailDigest(enabled);
      this.settings.update((s) => (s ? { ...s, emailDigest: enabled } : s));
    });
  }

  private async run(action: () => Promise<void>) {
    this.error.set('');
    this.busy.set(true);
    try {
      await action();
    } catch (err) {
      this.error.set(messageFrom(err));
    } finally {
      this.busy.set(false);
    }
  }
}

function messageFrom(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body: unknown = err.error;
    if (body && typeof body === 'object' && 'error' in body) {
      return (body as { error?: { message?: string } }).error?.message ?? 'Request failed';
    }
    return 'Could not save the reminder setting';
  }
  // A blocked notification permission lands here.
  if (err instanceof Error && /denied|permission/i.test(err.message)) {
    return 'Notifications are blocked for this site. Allow them in the browser settings.';
  }
  return err instanceof Error ? err.message : 'Request failed';
}
