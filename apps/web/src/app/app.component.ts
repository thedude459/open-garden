import { Component, inject } from '@angular/core';
import { NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthApiService } from './auth/auth-api.service';
import { NoticeHost } from './ui/notice-host';
import { NoticeService } from './ui/notice.service';

@Component({
  selector: 'og-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NoticeHost],
  template: `
    <div class="shell">
      <nav class="nav">
        <h1><a routerLink="/plants">Open Garden</a></h1>
        <a routerLink="/plants">Catalog</a>
        <a routerLink="/gardens">Gardens</a>
        <a routerLink="/favorites">Favorites</a>
        @if (isAdmin()) {
          <a routerLink="/admin/pipeline">Pipeline</a>
        }
        <a routerLink="/login">Login</a>
      </nav>
      <router-outlet />
    </div>
    <og-notice-host />
  `,
})
export class AppComponent {
  private readonly auth = inject(AuthApiService);

  constructor() {
    const notices = inject(NoticeService);
    inject(Router)
      .events.pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(() => notices.clear());
  }

  isAdmin() {
    return this.auth.isAdmin();
  }
}
