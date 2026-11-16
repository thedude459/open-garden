import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatDay } from '@open-garden/web-ui';
import type { SeasonDto } from '@open-garden/shared-types';
import { NoticeService } from '../ui/notice.service';
import { CalendarApiService } from './calendar-api.service';
import { GardensApiService } from './gardens-api.service';

/** Settings: the open season, last year's review, and the household's companion pairs. */
@Component({
  selector: 'og-garden-season',
  standalone: true,
  imports: [FormsModule],
  styles: ':host { display: block; }',
  template: `
    @if (season(); as season) {
      <section>
        <h3>Season {{ season.openYear }}</h3>
        @if (canEdit()) {
          <button type="button" class="btn btn-secondary" (click)="closeSeason()">
            Close season
          </button>
        }
        @if (season.closedYear != null) {
          <h4>{{ season.closedYear }}</h4>
          @for (row of season.review; track row.id) {
            <p>
              {{ row.commonName }}
              @if (row.bedName) {
                · {{ row.bedName }}
              }
              @if (row.harvestedOn) {
                · harvested {{ formatDay(row.harvestedOn) }}
              }
              @if (row.note) {
                · {{ row.note }}
              }
            </p>
          }
          @for (again of season.plantAgain; track again.bedId + again.plantId) {
            <p>
              {{ again.bedName }} · {{ again.commonName }}
              @if (canEdit()) {
                <button type="button" class="btn btn-secondary" (click)="plantAgain(again.plantId)">
                  Plant again
                </button>
              }
            </p>
          }
        }
        <h4>Companions</h4>
        @for (pair of season.pairs; track pair.id) {
          <p>{{ pair.plantName }} {{ pair.kind }} {{ pair.otherName }} — {{ pair.reason }}</p>
        }
        @if (canEdit() && season.householdPlants.length > 1) {
          <form class="filters" (ngSubmit)="addPair()">
            <select name="pairLeft" [(ngModel)]="pairLeft">
              @for (plant of season.householdPlants; track plant.id) {
                <option [value]="plant.id">{{ plant.commonName }}</option>
              }
            </select>
            <select name="pairKind" [(ngModel)]="pairKind">
              <option value="helps">helps</option>
              <option value="hinders">hinders</option>
              <option value="pollinates">pollinates</option>
            </select>
            <select name="pairRight" [(ngModel)]="pairRight">
              @for (plant of season.householdPlants; track plant.id) {
                <option [value]="plant.id">{{ plant.commonName }}</option>
              }
            </select>
            <input name="pairReason" [(ngModel)]="pairReason" placeholder="Reason" />
            <button type="submit" class="btn btn-secondary">Add pair</button>
          </form>
        }
      </section>
    }
  `,
})
export class GardenSeasonSection implements OnInit {
  private readonly api = inject(GardensApiService);
  private readonly calendarApi = inject(CalendarApiService);
  private readonly notices = inject(NoticeService);
  readonly gardenId = input.required<string>();
  readonly canEdit = input(false);
  readonly formatDay = formatDay;
  readonly season = signal<SeasonDto | null>(null);
  pairLeft = '';
  pairRight = '';
  pairKind = 'helps';
  pairReason = '';

  ngOnInit() {
    void this.load();
  }

  /** The section is left out when the season cannot be read (offline, for one). */
  private async load() {
    try {
      this.season.set(await this.api.season(this.gardenId()));
    } catch {
      this.season.set(null);
    }
  }

  async closeSeason() {
    try {
      this.season.set(await this.api.closeSeason(this.gardenId()));
      this.notices.success('Season closed');
    } catch {
      this.notices.error('Could not close the season');
    }
  }

  async plantAgain(plantId: string) {
    try {
      await this.calendarApi.add(this.gardenId(), { plantId });
      this.notices.success('Added to this year’s calendar');
    } catch {
      this.notices.error('Could not add that plant');
    }
  }

  async addPair() {
    if (!this.pairLeft || !this.pairRight || !this.pairReason.trim()) return;
    try {
      this.season.set(
        await this.api.addCompanion(this.gardenId(), {
          plantId: this.pairLeft,
          otherPlantId: this.pairRight,
          kind: this.pairKind,
          reason: this.pairReason.trim(),
        }),
      );
      this.pairReason = '';
    } catch {
      this.notices.error('Could not save that pair');
    }
  }
}
