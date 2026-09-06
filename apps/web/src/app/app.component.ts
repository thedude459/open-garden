import { Component, inject } from '@angular/core';
import { NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthApiService } from './auth/auth-api.service';
import { NoticeHost } from './ui/notice-host';
import { NoticeService } from './ui/notice.service';

@Component({
  selector: 'og-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NoticeHost],
  template: `
    <div class="shell">
      <nav class="nav">
        <h1><a [routerLink]="signedIn() ? '/gardens' : '/login'">Open Garden</a></h1>
        @if (signedIn()) {
          <a routerLink="/gardens" routerLinkActive="active">Gardens</a>
          <a routerLink="/plants" routerLinkActive="active">Catalog</a>
          <a routerLink="/favorites" routerLinkActive="active">Favorites</a>
          @if (isAdmin()) {
            <a routerLink="/admin/pipeline" routerLinkActive="active">Pipeline</a>
          }
          <span class="nav-auth">
            <button type="button" class="nav-text" (click)="logout()">Sign out</button>
          </span>
        } @else {
          <span class="nav-auth">
            <a routerLink="/login" routerLinkActive="active">Login</a>
          </span>
        }
      </nav>
      <router-outlet />
    </div>
    <og-notice-host />
  `,
})
export class AppComponent {
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);

  constructor() {
    const notices = inject(NoticeService);
    this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => notices.clear());
  }

  isAdmin() {
    return this.auth.isAdmin();
  }

  signedIn() {
    return this.auth.isAuthenticated();
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
