import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NoticeService } from '../ui/notice.service';
import { AuthApiService } from './auth-api.service';
import { apiMessage } from '../ui/error-message';

/** Ask for a password reset link by email. */
@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <h2>Reset your password</h2>
      @if (sent()) {
        <p class="card authform" role="status">
          If an account uses {{ email }}, a reset link is on its way. It works once, for 60 minutes.
        </p>
      } @else {
        <form class="authform card" (ngSubmit)="submit()">
          <label>
            Email
            <input [(ngModel)]="email" name="email" type="email" autocomplete="email" required />
          </label>
          <button
            type="submit"
            class="btn btn-primary"
            [attr.aria-busy]="notices.busyMap().has('reset-request') || null"
            [disabled]="notices.busyMap().has('reset-request')"
          >
            Email me a link
          </button>
        </form>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <p><a routerLink="/login">Back to sign in</a></p>
    </div>
  `,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthApiService);
  readonly notices = inject(NoticeService);
  email = inject(ActivatedRoute).snapshot.queryParamMap.get('email') ?? '';
  readonly sent = signal(false);
  readonly error = signal('');

  async submit() {
    this.error.set('');
    await this.notices.run('reset-request', async () => {
      try {
        await this.auth.requestPasswordReset(this.email.trim());
        this.sent.set(true);
      } catch (err) {
        this.error.set(apiMessage(err) ?? 'Could not send a reset link. Try again later.');
      }
    });
  }
}
