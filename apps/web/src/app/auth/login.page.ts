import { HttpErrorResponse } from '@angular/common/http';
import { apiMessage } from '../ui/error-message';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthApiService } from './auth-api.service';
import { NoticeService } from '../ui/notice.service';
import { SOURCE_CODE_URL } from '../source-link';
import { safeReturnUrl } from './session-expiry';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="brand-hero">
        <img src="assets/mark.svg" alt="Open Garden" width="72" height="72" />
        <p class="muted">Household garden planner</p>
      </div>
      <h2>{{ mode() === 'login' ? 'Sign in' : 'Create account' }}</h2>
      @if (expired) {
        <p class="banner" role="status">Your session ended. Sign in again to carry on.</p>
      }
      <form class="authform card" (ngSubmit)="submit()">
        @if (mode() === 'register') {
          <input [(ngModel)]="displayName" name="displayName" placeholder="Display name" required />
        }
        <input [(ngModel)]="email" name="email" type="email" placeholder="Email" required />
        <input
          [(ngModel)]="password"
          name="password"
          type="password"
          placeholder="Password"
          required
        />
        <button
          type="submit"
          class="btn btn-primary"
          [attr.aria-busy]="notices.busyMap().has('login') || null"
          [disabled]="notices.busyMap().has('login')"
        >
          {{ mode() === 'login' ? 'Login' : 'Register' }}
        </button>
        <button type="button" class="btn btn-secondary" (click)="toggle()">
          {{ mode() === 'login' ? 'Need an account?' : 'Have an account?' }}
        </button>
        @if (mode() === 'login' && canReset()) {
          <a routerLink="/forgot-password" [queryParams]="email ? { email } : {}"
            >Forgot password?</a
          >
        }
      </form>
      <p class="source-link">
        Open Garden is free software (AGPL-3.0).
        <a [href]="sourceCodeUrl" target="_blank" rel="noopener">Source code</a>
      </p>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
    </div>
  `,
})
export class LoginPage {
  readonly sourceCodeUrl = SOURCE_CODE_URL;
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly notices = inject(NoticeService);
  email = this.route.snapshot.queryParamMap.get('email') ?? '';
  password = '';
  displayName = '';
  mode = signal<'login' | 'register'>(
    this.route.snapshot.queryParamMap.get('register') === '1' ? 'register' : 'login',
  );
  error = signal('');
  /** "Forgot password?" shows only where the server can email a link. */
  readonly canReset = signal(false);

  constructor() {
    void this.auth.resetByEmail().then((ok) => this.canReset.set(ok));
  }
  /** Sent here because the server ended the session (see sessionExpiredInterceptor). */
  readonly expired = this.route.snapshot.queryParamMap.get('expired') === '1';

  toggle() {
    this.mode.update((m) => (m === 'login' ? 'register' : 'login'));
  }

  async submit() {
    this.error.set('');
    await this.notices.run('login', async () => {
      try {
        if (this.mode() === 'login') {
          await this.auth.login(this.email, this.password);
        } else {
          await this.auth.register(this.email, this.password, this.displayName.trim() || undefined);
        }
        this.auth.markAuthenticated();
        await this.router.navigateByUrl(
          safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        );
      } catch (err) {
        // Sign-in keeps one generic message. Sign-up says when the email is
        // already registered, so people know to sign in instead, and both say
        // when too many attempts mean waiting.
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        const said =
          status === 429 || (this.mode() === 'register' && status === 409)
            ? apiMessage(err)
            : undefined;
        this.notices.error(said ?? 'Authentication failed');
      }
    });
  }
}
