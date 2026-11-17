import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NoticeService } from '../ui/notice.service';
import { gardenErrorMessage } from '../gardens/garden-error-message';
import { AuthApiService } from './auth-api.service';

/** The signed-in member's own account: their password. */
@Component({
  standalone: true,
  imports: [FormsModule],
  styles: `
    .authform {
      max-width: 22rem;
    }
    label {
      display: grid;
      gap: 0.25rem;
    }
  `,
  template: `
    <h2>Account</h2>
    <section class="card">
      <h3>Change password</h3>
      <form class="authform" (ngSubmit)="changePassword()">
        <label>
          Current password
          <input
            [(ngModel)]="currentPassword"
            name="currentPassword"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        <label>
          New password (at least 8 characters)
          <input
            [(ngModel)]="newPassword"
            name="newPassword"
            type="password"
            autocomplete="new-password"
            minlength="8"
            required
          />
        </label>
        <label>
          Repeat new password
          <input
            [(ngModel)]="repeatPassword"
            name="repeatPassword"
            type="password"
            autocomplete="new-password"
            required
          />
        </label>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button
          type="submit"
          class="btn btn-primary"
          [attr.aria-busy]="notices.busyMap().has('change-password') || null"
          [disabled]="notices.busyMap().has('change-password')"
        >
          Change password
        </button>
      </form>
    </section>
  `,
})
export class AccountPage {
  private readonly auth = inject(AuthApiService);
  readonly notices = inject(NoticeService);
  currentPassword = '';
  newPassword = '';
  repeatPassword = '';
  readonly error = signal('');

  async changePassword() {
    this.error.set('');
    if (this.newPassword.length < 8) {
      this.error.set('The new password needs at least 8 characters.');
      return;
    }
    if (this.newPassword !== this.repeatPassword) {
      this.error.set('The new passwords do not match.');
      return;
    }
    await this.notices.run('change-password', async () => {
      try {
        await this.auth.changePassword(this.currentPassword, this.newPassword);
        this.currentPassword = this.newPassword = this.repeatPassword = '';
        this.notices.success('Password changed. Other devices are signed out.');
      } catch (err) {
        this.error.set(gardenErrorMessage(err, 'Could not change the password.'));
      }
    });
  }
}
