import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import type { HarvestTotalsDto } from '@open-garden/shared-types';
import { formatDay } from '@open-garden/web-ui';
import { AuthApiService } from '../auth/auth-api.service';
import { EmptyState } from '../ui/empty-state';
import { gardenErrorMessage } from './garden-error-message';
import { harvestAmount } from './harvest-amount';
import { PlantingsApiService } from './plantings-api.service';

/** What a property's crops yielded in a season, by crop (ADR 0038). */
@Component({
  standalone: true,
  imports: [FormsModule, EmptyState],
  template: `
    <h2>Harvests</h2>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (totals(); as t) {
      @if (t.seasons.length > 1) {
        <label>
          Season
          <select name="season" [ngModel]="t.seasonYear" (ngModelChange)="load($event)">
            @for (year of t.seasons; track year) {
              <option [ngValue]="year">{{ year }}</option>
            }
          </select>
        </label>
      }
      @if (t.crops.length === 0) {
        <og-empty-state
          title="No harvests yet"
          body="Log a harvest from a planting's editor on Plantings, or complete a Harvest task."
        />
      } @else {
        <p class="muted">Season {{ t.seasonYear }}</p>
        @for (crop of t.crops; track crop.name) {
          <details class="card">
            <summary>
              <strong>{{ crop.name }}</strong>
              <span>{{ harvestAmount(crop, units()) }}</span>
            </summary>
            <ul class="card-list">
              @for (h of crop.harvests; track h.plantingId + h.harvestedOn) {
                <li class="row">
                  <span>{{ formatDay(h.harvestedOn) }} · {{ h.plantName }}</span>
                  <span>{{ harvestAmount(h, units()) }}</span>
                </li>
              }
            </ul>
          </details>
        }
      }
    } @else if (!error()) {
      <p class="muted">Loading…</p>
    }
  `,
  styles: `
    summary {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      cursor: pointer;
    }
    details + details {
      margin-top: 0.5rem;
    }
  `,
})
export class GardenHarvestsPage implements OnInit {
  private readonly api = inject(PlantingsApiService);
  private readonly gardenId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  readonly units = inject(AuthApiService).units;
  readonly formatDay = formatDay;
  readonly harvestAmount = harvestAmount;
  readonly totals = signal<HarvestTotalsDto | null>(null);
  readonly error = signal('');

  ngOnInit() {
    void this.load();
  }

  async load(season?: number) {
    this.error.set('');
    try {
      this.totals.set(await this.api.harvestTotals(this.gardenId, season));
    } catch (err) {
      this.error.set(gardenErrorMessage(err, 'Could not load harvests'));
    }
  }
}
