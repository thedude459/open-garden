import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'og-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="shell">
      <nav class="nav">
        <h1><a routerLink="/plants">Open Garden</a></h1>
        <a routerLink="/plants">Catalog</a>
        <a routerLink="/favorites">Favorites</a>
        <a routerLink="/login">Login</a>
      </nav>
      <router-outlet />
    </div>
  `,
})
export class AppComponent {}
