import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NoticeService } from '../ui/notice.service';
import { gardenErrorMessage } from '../gardens/garden-error-message';
import { AuthApiService } from './auth-api.service';

/** The signed-in member's own account: their password, and deleting it. */
@Component({
  standalone: true,
  imports: [FormsModule],
  styles: `
    .authform {
      max-width: 22rem;
    }
    section + section {
      margin-top: 1rem;
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
    <section class="card">
      <h3>Delete account</h3>
      <p>
        Deletes your account and every property only you belong to. A property others also belong to
        must first be handed over (Transfer ownership in its Settings) or deleted.
      </p>
      @if (!confirmDelete()) {
        <button type="button" class="btn btn-secondary" (click)="confirmDelete.set(true)">
          Delete account
        </button>
      } @else {
        <form class="authform" (ngSubmit)="deleteAccount()">
          <label>
            Your password
            <input
              [(ngModel)]="deletePassword"
              name="deletePassword"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>
          @if (deleteError()) {
            <p class="error" role="alert">{{ deleteError() }}</p>
          }
          <button
            type="submit"
            class="btn btn-destructive"
            [attr.aria-busy]="notices.busyMap().has('delete-account') || null"
            [disabled]="notices.busyMap().has('delete-account')"
          >
            Delete my account permanently
          </button>
          <button type="button" class="btn btn-secondary" (click)="cancelDelete()">Cancel</button>
        </form>
      }
    </section>
  `,
})
export class AccountPage {
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);
  readonly notices = inject(NoticeService);
  currentPassword = '';
  newPassword = '';
  repeatPassword = '';
  readonly error = signal('');
  readonly confirmDelete = signal(false);
  deletePassword = '';
  readonly deleteError = signal('');

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

  cancelDelete() {
    this.confirmDelete.set(false);
    this.deletePassword = '';
    this.deleteError.set('');
  }

  async deleteAccount() {
    this.deleteError.set('');
    await this.notices.run('delete-account', async () => {
      try {
        await this.auth.deleteAccount(this.deletePassword);
        await this.router.navigateByUrl('/login');
        this.notices.success('Your account is deleted.');
      } catch (err) {
        this.deleteError.set(gardenErrorMessage(err, 'Could not delete the account.'));
      }
    });
  }
}
