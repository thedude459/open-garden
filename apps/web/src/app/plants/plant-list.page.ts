import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { PlantSummaryDto, PlantType } from '@open-garden/shared-types';
import { PlantsApiService } from './plants-api.service';
import { NoticeService } from '../ui/notice.service';
import { EmptyState } from '../ui/empty-state';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, EmptyState],
  template: `
    <h2>Plant catalog</h2>
    <div class="filters">
      <input [(ngModel)]="q" name="q" placeholder="Search name / species / variety" />
      <select [(ngModel)]="zone" name="zone">
        <option [ngValue]="undefined">Any zone</option>
        @for (z of zones; track z) {
          <option [ngValue]="z">Zone {{ z }}</option>
        }
      </select>
      <select [(ngModel)]="plantType" name="plantType">
        <option [ngValue]="undefined">Any type</option>
        @for (t of types; track t) {
          <option [ngValue]="t">{{ t }}</option>
        }
      </select>
      <button
        type="button"
        class="btn btn-primary"
        (click)="load()"
        [attr.aria-busy]="notices.busyMap().has('search-catalog') || null"
        [disabled]="notices.busyMap().has('search-catalog')"
      >
        Apply
      </button>
    </div>
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (items().length === 0) {
      <og-empty-state
        title="No plants match"
        body="Try another name, clear filters, or run fixture sync."
      />
    } @else {
      <div class="card-list">
        @for (p of items(); track p.id) {
          <a class="row" [routerLink]="['/plants', p.id]">
            <span>
              <strong>{{ p.commonName }}</strong>
              <span class="muted">
                — {{ p.species }}
                @if (p.cultivar) {
                  ({{ p.cultivar }})
                }
              </span>
            </span>
            <span class="muted">{{ p.plantType }} · z{{ p.zoneMin }}–{{ p.zoneMax }}</span>
          </a>
        }
      </div>
    }
  `,
})
export class PlantListPage implements OnInit {
  private readonly api = inject(PlantsApiService);
  readonly notices = inject(NoticeService);
  q = '';
  zone: number | undefined;
  plantType: PlantType | undefined;
  zones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  types: PlantType[] = ['vegetable', 'herb', 'flower', 'fruit', 'shrub', 'tree'];
  items = signal<PlantSummaryDto[]>([]);
  loading = signal(false);

  ngOnInit() {
    void this.load();
  }

  async load() {
    await this.notices.run('search-catalog', async () => {
      this.loading.set(true);
      try {
        const page = await this.api.list({
          q: this.q || undefined,
          zone: this.zone,
          plantType: this.plantType,
          page: 1,
          pageSize: 20,
        });
        this.items.set(page.items);
      } finally {
        this.loading.set(false);
      }
    });
  }
}
