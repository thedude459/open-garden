import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  formatSpacing,
  formatTemperature,
  formatTemperatureRange,
} from '@open-garden/garden-layout';
import type { CatalogCompanionDto, PlantDetailDto } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { PlantsApiService } from './plants-api.service';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { NoticeService } from '../ui/notice.service';

const EVIDENCE_LABELS: Record<CatalogCompanionDto['evidence'], string> = {
  research: 'Research',
  extension: 'Extension guidance',
  traditional: 'Traditional',
};

const BENEFIT_LABELS: Record<CatalogCompanionDto['benefits'][number], string> = {
  'deters-pests': 'deters pests',
  'trap-crop': 'trap crop',
  'attracts-beneficials': 'draws beneficial insects',
  'attracts-pollinators': 'draws pollinators',
  'fixes-nitrogen': 'fixes nitrogen',
  support: 'support to climb',
  shade: 'shade',
  'ground-cover': 'ground cover',
  competes: 'competes',
  'suppresses-growth': 'suppresses growth',
  'shares-pests': 'shares pests',
};

@Component({
  standalone: true,
  imports: [RouterLink],
  styles: `
    .companion-list {
      list-style: none;
      padding: 0;
    }
    .companion-list li {
      margin-block: 0.75rem;
    }
    .companion-list .badge {
      margin-inline-start: 0.5rem;
    }
    .companion-list p {
      margin: 0.25rem 0 0;
    }
    .small {
      font-size: 0.875rem;
    }
  `,
  template: `
    <p class="back-link"><a routerLink="/plants">Back to catalog</a></p>
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (plant(); as p) {
      <h2>{{ p.commonName }}</h2>
      <p class="muted">
        {{ p.species }}
        @if (p.cultivar) {
          · Variety {{ p.cultivar }}
        }
      </p>
      <dl class="plant-facts">
        <dt>Type</dt>
        <dd>{{ p.plantType }}</dd>
        <dt>Zones</dt>
        <dd>{{ p.zoneMin }}–{{ p.zoneMax }}</dd>
        <dt>Sun</dt>
        <dd>{{ p.sunRequirements ?? 'Unavailable' }}</dd>
        <dt>Water</dt>
        <dd>{{ p.waterNeeds ?? 'Unavailable' }}</dd>
        <dt>Days to maturity</dt>
        <dd>{{ p.daysToMaturity ?? 'Unavailable' }}</dd>
        @if (p.sowingTemperature; as t) {
          <dt>Grows in</dt>
          <dd>{{ formatTemperatureRange(t.minC, t.maxC, units()) }}</dd>
          @if (t.minSoilC != null) {
            <dt>Soil to sow</dt>
            <dd>{{ formatTemperature(t.minSoilC, units()) }} or warmer</dd>
          }
        }
        @if (p.soilPh; as ph) {
          <dt>Soil pH</dt>
          <dd>{{ ph.min.toFixed(1) }}–{{ ph.max.toFixed(1) }}</dd>
        }
        @if (p.cropCoefficients; as kc) {
          <dt>Crop coefficient</dt>
          <dd>
            {{ kc.initial.toFixed(2) }} young, {{ kc.mid.toFixed(2) }} at full growth,
            {{ kc.end.toFixed(2) }} at harvest
          </dd>
          @if (kc.stageDays; as d) {
            <dt>Growth stages</dt>
            <dd>
              {{ d.initial }} days young, {{ d.development }} growing, {{ d.mid }} at full growth,
              {{ d.late }} ripening
            </dd>
          }
        }
        <dt>Spacing</dt>
        <dd>
          {{ p.spacingInches != null ? formatSpacing(p.spacingInches, units()) : 'Unavailable' }}
        </dd>
      </dl>
      <button
        type="button"
        class="btn btn-primary"
        (click)="toggleFavorite()"
        [attr.aria-busy]="notices.busyMap().has('favorite') || null"
        [disabled]="notices.busyMap().has('favorite')"
      >
        {{ p.isFavorite ? 'Remove favorite' : 'Save favorite' }}
      </button>
      @if (pending()) {
        <span class="badge">Pending sync</span>
      }
      @if (p.companions?.length) {
        <section class="companions" aria-labelledby="companions-heading">
          <h2 id="companions-heading">Companions</h2>
          <p class="muted">
            Advice from research trials and extension guidance; it never stops you planting.
            @if (p.companionZones?.length) {
              Pairs shown near zone {{ p.companionZones.join(', ') }} (your properties) come first.
            }
          </p>
          @for (group of companionGroups(p); track group.title) {
            <h3>{{ group.title }}</h3>
            <ul class="companion-list">
              @for (c of group.pairs; track c.cropId) {
                <li>
                  <strong>{{ c.name }}</strong>
                  <span class="badge">{{ evidenceLabel(c.evidence) }}</span>
                  <span class="muted"> · {{ benefitsLabel(c.benefits) }}</span>
                  <p>{{ c.reason }}</p>
                  <p class="muted small">
                    Shown in {{ placesLabel(c) }}.
                    @if (c.reference) {
                      Source: {{ c.reference }}.
                    }
                  </p>
                </li>
              }
            </ul>
          }
        </section>
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
  readonly notices = inject(NoticeService);
  readonly units = inject(AuthApiService).units;
  readonly formatSpacing = formatSpacing;
  readonly formatTemperature = formatTemperature;
  readonly formatTemperatureRange = formatTemperatureRange;
  plant = signal<PlantDetailDto | null>(null);
  pending = signal(false);
  loading = signal(true);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.load(id);
    else this.loading.set(false);
  }

  async load(id: string) {
    this.loading.set(true);
    try {
      this.plant.set(await this.api.detail(id));
    } finally {
      this.loading.set(false);
    }
  }

  companionGroups(p: PlantDetailDto) {
    const all = p.companions ?? [];
    return [
      { title: 'Grows well with', pairs: all.filter((c) => c.kind === 'helps') },
      { title: 'Keep apart from', pairs: all.filter((c) => c.kind === 'hinders') },
    ].filter((group) => group.pairs.length > 0);
  }

  evidenceLabel(evidence: CatalogCompanionDto['evidence']): string {
    return EVIDENCE_LABELS[evidence];
  }

  benefitsLabel(benefits: CatalogCompanionDto['benefits']): string {
    return benefits.map((b) => BENEFIT_LABELS[b]).join(', ');
  }

  placesLabel(c: CatalogCompanionDto): string {
    return c.shownIn
      .map((place) =>
        place.zones
          ? `${place.where} (zone${place.zones.min === place.zones.max ? ` ${place.zones.min}` : `s ${place.zones.min}–${place.zones.max}`})`
          : place.where,
      )
      .join('; ');
  }

  async toggleFavorite() {
    const p = this.plant();
    if (!p) return;
    await this.notices.run('favorite', async () => {
      try {
        if (p.isFavorite) {
          this.pending.set(await this.favorites.remove(p.id));
          this.plant.set({ ...p, isFavorite: false });
          this.notices.success('Favorite removed');
        } else {
          this.pending.set(await this.favorites.add(p.id));
          this.plant.set({ ...p, isFavorite: true });
          this.notices.success('Favorite saved');
        }
      } catch {
        this.notices.error('Could not update favorite');
      }
    });
  }
}
