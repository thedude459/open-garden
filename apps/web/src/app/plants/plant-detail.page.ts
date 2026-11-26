import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  formatSpacing,
  formatTemperature,
  formatTemperatureRange,
} from '@open-garden/garden-layout';
import type {
  CatalogCompanionDto,
  PestControlsDto,
  PestKind,
  PlantDetailDto,
  PlantPestDto,
  PlantVarietyDto,
  ScoutStage,
} from '@open-garden/shared-types';
import { plantName } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { PlantsApiService } from './plants-api.service';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { NoticeService } from '../ui/notice.service';
import { SowingTimeline } from './sowing-timeline';
import { PlantIcon } from '../ui/plant-icon';

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

const PEST_KIND_LABELS: Record<PestKind, string> = {
  insect: 'Insect',
  mite: 'Mite',
  disease: 'Disease',
};

const STAGE_LABELS: Record<ScoutStage, string> = {
  seedling: 'seedlings',
  vegetative: 'growing plants',
  flowering: 'flowering',
  fruiting: 'fruiting',
};

/** Steps that need no product first; organic products before conventional ones (ADR 0044). */
const CONTROL_GROUPS: ReadonlyArray<{ key: keyof PestControlsDto; title: string }> = [
  { key: 'cultural', title: 'Growing practices' },
  { key: 'physical', title: 'By hand or barrier' },
  { key: 'biological', title: 'Natural enemies' },
  { key: 'organic', title: 'Organic products' },
  { key: 'conventional', title: 'Conventional products' },
];

@Component({
  standalone: true,
  imports: [RouterLink, SowingTimeline, PlantIcon],
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
    .pest-list {
      list-style: none;
      padding: 0;
    }
    .pest-list > li {
      margin-block: 1.25rem;
    }
    .pest-list h3,
    .pest-list h4 {
      margin-block: 0.5rem 0.25rem;
    }
    .pest-list p {
      margin: 0.25rem 0;
    }
    .small {
      font-size: 0.875rem;
    }
    .plant-title {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
  `,
  template: `
    <p class="back-link"><a routerLink="/plants">Back to catalog</a></p>
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (plant(); as p) {
      <h2 class="plant-title">
        <og-plant-icon [plantType]="p.plantType" [cropId]="p.cropId" />
        {{ p.commonName }}
      </h2>
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
      <og-sowing-timeline [plant]="p" />
      @if (p.varieties.length) {
        <section class="varieties" aria-labelledby="varieties-heading">
          <h2 id="varieties-heading">{{ p.cultivar ? 'Other varieties' : 'Varieties' }}</h2>
          <ul class="card-list">
            @for (v of p.varieties; track v.id) {
              <li class="row">
                <a [routerLink]="['/plants', v.id]">{{ plantName(v) }}</a>
                @if (varietyFacts(v); as facts) {
                  <span class="muted">{{ facts }}</span>
                }
              </li>
            }
          </ul>
        </section>
      }
      @if (p.companions.length) {
        <section class="companions" aria-labelledby="companions-heading">
          <h2 id="companions-heading">Companions</h2>
          <p class="muted">
            Advice from research trials and extension guidance; it never stops you planting.
            @if (p.companionZones.length) {
              Pairs shown near zone {{ p.companionZones.join(', ') }} (your properties) come first.
            }
          </p>
          @for (group of companionGroups(p); track group.title) {
            <h3>{{ group.title }}</h3>
            <ul class="companion-list">
              @for (c of group.pairs; track c.cropId) {
                <li>
                  <strong>{{ c.name }}</strong>&ngsp;<span class="badge">{{
                    evidenceLabel(c.evidence)
                  }}</span>
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
      @if (p.pests.length) {
        <section class="pests" aria-labelledby="pests-heading">
          <h2 id="pests-heading">Pests and diseases</h2>
          <p class="muted">
            Common problems for this crop, not a complete list. Try the steps that need no product
            first; organic products are shown before any other.
          </p>
          <label>
            <input
              type="checkbox"
              [checked]="showConventional()"
              (change)="showConventional.set(!showConventional())"
            />
            Show conventional options
          </label>
          <ul class="pest-list">
            @for (pest of p.pests; track pest.id) {
              <li>
                <h3>
                  {{ pest.name }}&ngsp;<span class="badge">{{ kindLabel(pest.kind) }}</span>
                </h3>
                @if (pest.scientificName) {
                  <p class="muted small">
                    <i>{{ pest.scientificName }}</i>
                  </p>
                }
                <p>{{ pest.signs }}</p>
                <p class="muted small">Look for it on {{ stagesLabel(pest) }}.</p>
                @for (group of controlGroups(pest.controls); track group.title) {
                  <h4>{{ group.title }}</h4>
                  <ul>
                    @for (step of group.steps; track step) {
                      <li>{{ step }}</li>
                    }
                  </ul>
                }
                @if (pest.region; as r) {
                  <p class="muted small">{{ regionLabel(pest) }}</p>
                  <p><strong>When:</strong> {{ r.when }}</p>
                  @if (r.threshold) {
                    <p><strong>Act when:</strong> {{ r.threshold }}</p>
                  }
                  @for (group of controlGroups(r.controls); track group.title) {
                    <h4>{{ group.title }}</h4>
                    <ul>
                      @for (step of group.steps; track step) {
                        <li>{{ step }}</li>
                      }
                    </ul>
                  }
                  @if (!r.controls.organic.length) {
                    <p class="muted small">
                      This guidance names no organic product; the steps above are the organic
                      options.
                    </p>
                  }
                  @if (showConventional() && !r.controls.conventional.length) {
                    <p class="muted small">This guidance names no conventional product.</p>
                  }
                  <p class="muted small">Source: {{ r.reference }}.</p>
                } @else {
                  <p class="muted small">
                    We have no timing or products for your country yet; the steps above apply
                    anywhere.
                  </p>
                }
              </li>
            }
          </ul>
          <p class="muted small">
            The label is the law: follow it, and choose products labelled for organic use.
          </p>
        </section>
      }
    } @else {
      <p class="muted">Plant unavailable offline or not found.</p>
    }
  `,
})
export class PlantDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(PlantsApiService);
  private readonly favorites = inject(FavoritesApiService);
  readonly notices = inject(NoticeService);
  readonly units = inject(AuthApiService).units;
  readonly formatSpacing = formatSpacing;
  readonly plantName = plantName;
  readonly formatTemperature = formatTemperature;
  readonly formatTemperatureRange = formatTemperatureRange;
  plant = signal<PlantDetailDto | null>(null);
  pending = signal(false);
  loading = signal(true);
  /** Conventional products are shown only on request (ADR 0044). */
  showConventional = signal(false);
  /** The plant being shown; a slower earlier load must not replace it. */
  private current = '';

  ngOnInit() {
    // A variety link opens another plant on this same page.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) void this.load(id);
      else this.loading.set(false);
    });
  }

  async load(id: string) {
    this.current = id;
    this.loading.set(true);
    this.pending.set(false);
    try {
      const detail = await this.api.detail(id);
      if (this.current === id) this.plant.set(detail);
    } finally {
      if (this.current === id) this.loading.set(false);
    }
  }

  /** What tells a variety apart at a glance: days to maturity and spacing. */
  varietyFacts(v: PlantVarietyDto): string {
    return [
      v.daysToMaturity != null ? `${v.daysToMaturity} days` : null,
      v.spacingInches != null ? `${formatSpacing(v.spacingInches, this.units())} apart` : null,
    ]
      .filter(Boolean)
      .join(' · ');
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

  kindLabel(kind: PestKind): string {
    return PEST_KIND_LABELS[kind];
  }

  stagesLabel(pest: PlantPestDto): string {
    return pest.scoutStages.map((s) => STAGE_LABELS[s]).join(', ');
  }

  controlGroups(controls: PestControlsDto) {
    return CONTROL_GROUPS.filter((g) => g.key !== 'conventional' || this.showConventional())
      .map((g) => ({ title: g.title, steps: controls[g.key] }))
      .filter((g) => g.steps.length > 0);
  }

  /** Where the guidance is from; said plainly when it is not from the member's country. */
  regionLabel(pest: PlantPestDto): string {
    const r = pest.region;
    if (!r) return '';
    const zones = r.zones
      ? ` (zone${r.zones.min === r.zones.max ? ` ${r.zones.min}` : `s ${r.zones.min}–${r.zones.max}`})`
      : '';
    return pest.regionMatch === 'nearest'
      ? `Guidance from ${r.where}${zones}, the nearest we have: add your property's address to get guidance for its country.`
      : `Guidance for ${r.where}${zones}.`;
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
