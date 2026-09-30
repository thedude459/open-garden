import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PlantSummaryDto, PlantType } from '@open-garden/shared-types';
import { PLANT_TYPES } from '@open-garden/shared-types';
import { PlantsApiService } from './plants-api.service';

@Component({
  selector: 'og-plant-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="filters" [class.plant-panel-filters]="filters()" (ngSubmit)="search()">
      <input
        #qInput
        [(ngModel)]="q"
        [name]="inputName()"
        [attr.name]="inputName()"
        [attr.aria-label]="searchLabel()"
        [placeholder]="placeholder()"
        (ngModelChange)="queue()"
      />
      @if (filters()) {
        <select
          [(ngModel)]="zoneFilter"
          name="plantZone"
          aria-label="Zone"
          (ngModelChange)="onZone($event)"
        >
          <option [ngValue]="undefined">Any zone</option>
          @for (z of zones; track z) {
            <option [ngValue]="z">Zone {{ z }}</option>
          }
        </select>
        <select
          [(ngModel)]="typeFilter"
          name="plantType"
          aria-label="Type"
          (ngModelChange)="queue()"
        >
          <option [ngValue]="undefined">Any type</option>
          @for (t of types; track t) {
            <option [ngValue]="t">{{ t }}</option>
          }
        </select>
      }
      <button type="submit" class="btn btn-primary" [attr.aria-busy]="searching() || null">
        {{ submitLabel() }}
      </button>
      <ng-content />
    </form>
  `,
})
export class PlantPicker implements OnInit {
  private readonly plants = inject(PlantsApiService);
  private readonly qInput = viewChild<ElementRef<HTMLInputElement>>('qInput');
  private timer: ReturnType<typeof setTimeout> | null = null;
  private gen = 0;
  private zoneTouched = false;

  readonly searchLabel = input('Search plants');
  readonly placeholder = input('Search name / species / variety');
  readonly inputName = input('plantSearch');
  readonly submitLabel = input('Apply');
  readonly filters = input(false);
  readonly live = input(false);
  readonly requireQuery = input(false);
  readonly zone = input<number | undefined>(undefined);
  readonly beforeSearch = input<() => boolean>(() => true);

  readonly results = output<PlantSummaryDto[]>();
  readonly searched = output<boolean>();
  readonly zoneChange = output<number | undefined>();
  readonly failed = output<unknown>();

  q = '';
  zoneFilter: number | undefined;
  typeFilter: PlantType | undefined;
  readonly searching = signal(false);
  readonly zones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  readonly types = PLANT_TYPES;

  constructor() {
    effect(() => {
      const zone = this.zone();
      if (!this.zoneTouched) this.zoneFilter = zone;
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  ngOnInit() {
    if (!this.zoneTouched) this.zoneFilter = this.zone();
  }

  focus() {
    this.qInput()?.nativeElement.focus();
  }

  onZone(value: number | undefined) {
    this.zoneTouched = true;
    this.zoneFilter = value;
    this.queue();
  }

  queue() {
    if (!this.live()) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.search(), 180);
  }

  async search() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.requireQuery() && !this.q.trim()) return;
    if (!this.beforeSearch()()) return;
    const gen = ++this.gen;
    this.searching.set(true);
    try {
      const page = await this.plants.list({
        q: this.q.trim() || undefined,
        zone: this.filters() ? this.zoneFilter : undefined,
        plantType: this.filters() ? this.typeFilter : undefined,
        page: 1,
        pageSize: 20,
      });
      if (gen !== this.gen) return;
      this.zoneChange.emit(this.zoneFilter);
      this.results.emit(page.items);
      this.searched.emit(true);
    } catch (err) {
      if (gen !== this.gen) return;
      this.failed.emit(err);
    } finally {
      if (gen === this.gen) this.searching.set(false);
    }
  }
}
