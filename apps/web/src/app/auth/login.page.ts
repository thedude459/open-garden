import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApiService } from './auth-api.service';
import { NoticeService } from '../ui/notice.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2>Sign in</h2>
    <p class="muted">Use gardener&#64;example.com / password123 after seeding.</p>
    <form class="authform card" (ngSubmit)="submit()">
      <input [(ngModel)]="email" name="email" type="email" placeholder="Email" required />
      <input [(ngModel)]="password" name="password" type="password" placeholder="Password" required />
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
    </form>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);
  readonly notices = inject(NoticeService);
  email = 'gardener@example.com';
  password = 'password123';
  mode = signal<'login' | 'register'>('login');
  error = signal('');

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
          await this.auth.register(this.email, this.password);
        }
        this.auth.markAuthenticated();
        await this.router.navigateByUrl('/plants');
      } catch {
        this.notices.error('Authentication failed');
      }
    });
  }
}
