import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthApiService } from './auth/auth-api.service';

@Component({
  selector: 'og-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
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
  `,
})
export class AppComponent {
  private readonly auth = inject(AuthApiService);

  isAdmin() {
    return this.auth.isAdmin();
  }
}
