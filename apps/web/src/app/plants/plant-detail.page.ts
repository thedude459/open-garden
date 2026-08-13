import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { PlantDetailDto } from '@open-garden/shared-types';
import { PlantsApiService } from './plants-api.service';
import { FavoritesApiService } from '../favorites/favorites-api.service';

@Component({
  standalone: true,
  template: `
    @if (plant(); as p) {
      <h2>{{ p.commonName }}</h2>
      <p class="muted">
        {{ p.species }}
        @if (p.cultivar) {
          · Variety {{ p.cultivar }}
        }
      </p>
      <dl>
        <dt>Type</dt><dd>{{ p.plantType }}</dd>
        <dt>Zones</dt><dd>{{ p.zoneMin }}–{{ p.zoneMax }}</dd>
        <dt>Sun</dt><dd>{{ p.sunRequirements ?? 'Unavailable' }}</dd>
        <dt>Water</dt><dd>{{ p.waterNeeds ?? 'Unavailable' }}</dd>
        <dt>Days to maturity</dt><dd>{{ p.daysToMaturity ?? 'Unavailable' }}</dd>
        <dt>Spacing (in)</dt><dd>{{ p.spacingInches ?? 'Unavailable' }}</dd>
      </dl>
      <button type="button" (click)="toggleFavorite()">
        {{ p.isFavorite ? 'Remove favorite' : 'Save favorite' }}
      </button>
      @if (pending()) {
        <span class="badge">Pending sync</span>
      }
    } @else {
      <p class="muted">Plant unavailable offline or not found.</p>
    }
  `,
})
export class PlantDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PlantsApiService);
  private readonly favorites = inject(FavoritesApiService);
  plant = signal<PlantDetailDto | null>(null);
  pending = signal(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.load(id);
  }

  async load(id: string) {
    this.plant.set(await this.api.detail(id));
  }

  async toggleFavorite() {
    const p = this.plant();
    if (!p) return;
    if (p.isFavorite) {
      this.pending.set(await this.favorites.remove(p.id));
      this.plant.set({ ...p, isFavorite: false });
    } else {
      this.pending.set(await this.favorites.add(p.id));
      this.plant.set({ ...p, isFavorite: true });
    }
  }
}
