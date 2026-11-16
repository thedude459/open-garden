import { Component, inject, input, output, signal } from '@angular/core';
import { formatPlanSize } from '@open-garden/garden-layout';
import { MULCH_LABELS, type LayoutAreaDto, type LayoutBedDto } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';

/** The beds drawn on the plan, each with Open and, for an editor, Edit. */
@Component({
  selector: 'og-layout-beds-list',
  standalone: true,
  template: `
    @if (beds().length) {
      <h3>Beds</h3>
      <ul class="card-list">
        @for (bed of beds(); track bed.id) {
          <li class="row" [class.selected-row]="selectedId() === bed.id">
            <span>
              <strong>{{ bed.name }}</strong>
              @if (bed.mulch && bed.mulch !== 'none') {
                <span class="muted"> · {{ mulchLabels[bed.mulch] }}</span>
              }
              @if (bed.geometry; as geo) {
                <span class="muted">
                  ·
                  {{ formatPlanSize(geo.lengthInches, geo.widthInches, geo.orientation, units()) }}
                </span>
              }
            </span>
            <span class="member-actions">
              <button
                type="button"
                class="btn btn-secondary"
                [attr.aria-label]="'Open bed ' + bed.name"
                (click)="open.emit(bed.id)"
              >
                Open
              </button>
              @if (canEdit()) {
                <button
                  type="button"
                  class="btn btn-secondary"
                  [attr.aria-label]="'Edit bed ' + bed.name"
                  (click)="edit.emit(bed.id)"
                >
                  Edit
                </button>
              }
            </span>
          </li>
        }
      </ul>
    }
  `,
})
export class LayoutBedsList {
  readonly units = inject(AuthApiService).units;
  readonly formatPlanSize = formatPlanSize;
  readonly mulchLabels = MULCH_LABELS;

  beds = input<LayoutBedDto[]>([]);
  selectedId = input<string | null>(null);
  canEdit = input(false);
  open = output<string>();
  edit = output<string>();
}

/** Walkways and other non-planting areas, each deletable after a confirm. */
@Component({
  selector: 'og-layout-walkways-list',
  standalone: true,
  template: `
    @if (areas().length) {
      <h3>Walkways</h3>
      <ul class="card-list">
        @for (area of areas(); track area.id) {
          <li class="stack">
            <span
              >{{ area.name }} ·
              {{ formatPlanSize(area.lengthInches, area.widthInches, undefined, units()) }}</span
            >
            @if (canEdit()) {
              @if (confirmId() !== area.id) {
                <button
                  type="button"
                  class="btn btn-secondary"
                  [attr.aria-label]="'Delete area ' + area.name"
                  (click)="confirmId.set(area.id)"
                >
                  Delete
                </button>
              } @else {
                <p>Permanently delete {{ area.name }}?</p>
                <button
                  type="button"
                  class="btn btn-destructive"
                  [attr.aria-label]="'Confirm delete ' + area.name"
                  (click)="remove.emit(area)"
                  [attr.aria-busy]="deleting() || null"
                  [disabled]="deleting()"
                >
                  Confirm delete
                </button>
                <button type="button" class="btn btn-secondary" (click)="confirmId.set(null)">
                  Cancel
                </button>
              }
            }
          </li>
        }
      </ul>
    }
  `,
})
export class LayoutWalkwaysList {
  readonly units = inject(AuthApiService).units;
  readonly formatPlanSize = formatPlanSize;

  areas = input<LayoutAreaDto[]>([]);
  canEdit = input(false);
  deleting = input(false);
  remove = output<LayoutAreaDto>();
  confirmId = signal<string | null>(null);
}
