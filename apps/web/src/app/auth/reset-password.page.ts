import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NoticeService } from '../ui/notice.service';
import { AuthApiService } from './auth-api.service';
import { apiMessage } from '../ui/error-message';

/** The page a reset link opens: choose a new password. */
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <h2>Choose a new password</h2>
      <form class="authform card" (ngSubmit)="submit()">
        <label>
          New password (at least 8 characters)
          <input
            [(ngModel)]="password"
            name="password"
            type="password"
            autocomplete="new-password"
            minlength="8"
            required
          />
        </label>
        <label>
          Repeat new password
          <input
            [(ngModel)]="repeat"
            name="repeat"
            type="password"
            autocomplete="new-password"
            required
          />
        </label>
        <button
          type="submit"
          class="btn btn-primary"
          [attr.aria-busy]="notices.busyMap().has('reset-password') || null"
          [disabled]="notices.busyMap().has('reset-password')"
        >
          Set password
        </button>
      </form>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <p><a routerLink="/login">Back to sign in</a></p>
    </div>
  `,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);
  readonly notices = inject(NoticeService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  password = '';
  repeat = '';
  readonly error = signal('');

  async submit() {
    this.error.set('');
    if (this.password.length < 8) {
      this.error.set('The new password needs at least 8 characters.');
      return;
    }
    if (this.password !== this.repeat) {
      this.error.set('The new passwords do not match.');
      return;
    }
    await this.notices.run('reset-password', async () => {
      try {
        await this.auth.resetPassword(this.token, this.password);
        await this.router.navigateByUrl('/login');
        this.notices.success('Password changed. Sign in with the new one.');
      } catch (err) {
        this.error.set(apiMessage(err) ?? 'Could not set the password. Try again later.');
      }
    });
  }
}
