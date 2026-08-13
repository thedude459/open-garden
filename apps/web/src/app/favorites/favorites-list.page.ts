import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FavoriteListItemDto } from '@open-garden/shared-types';
import { FavoritesApiService } from './favorites-api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <h2>Favorites</h2>
    @if (items().length === 0) {
      <p class="muted">No favorites yet.</p>
    } @else {
      <div class="card-list">
        @for (f of items(); track f.favoriteId) {
          <div class="row">
            <a [routerLink]="['/plants', f.plant.id]">
              {{ f.plant.commonName }}
              @if (f.unavailable) {
                <span class="badge">Unavailable</span>
              }
            </a>
            <button type="button" (click)="remove(f.plant.id)">Remove</button>
          </div>
        }
      </div>
    }
  `,
})
export class FavoritesListPage implements OnInit {
  private readonly api = inject(FavoritesApiService);
  items = signal<FavoriteListItemDto[]>([]);

  ngOnInit() {
    void this.load();
  }

  async load() {
    const page = await this.api.list();
    this.items.set(page.items);
  }

  async remove(plantId: string) {
    await this.api.remove(plantId);
    await this.load();
  }
}
