import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { soilTestNotes } from '@open-garden/garden-layout';
import type {
  LayoutBedDto,
  NutrientLevel,
  SoilTestCreateDto,
  SoilTestDto,
} from '@open-garden/shared-types';
import { formatDay } from '@open-garden/web-ui';

function localToday(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

const LEVELS: Record<NutrientLevel, string> = { low: 'low', medium: 'medium', high: 'high' };

/** A number field's value, or null when left empty. */
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * A bed's latest soil test and the advice it gives, and a form to record a
 * new one (ADR 0033). Advice only: nothing here blocks a planting.
 */
@Component({
  selector: 'og-bed-soil-test',
  standalone: true,
  imports: [FormsModule],
  template: `
    @let b = bed();
    <section class="soil-test" [attr.aria-label]="'Soil test of ' + b.name">
      <h4>Soil test</h4>
      @if (b.soilTest; as t) {
        <p>{{ tested(t) }}</p>
        @if (results(t); as line) {
          <p>{{ line }}</p>
        }
        @if (t.recommendations) {
          <p class="soil-test-lab">The lab recommends: {{ t.recommendations }}</p>
        }
        @for (note of notes(); track note) {
          <p class="needs-attention">{{ note }}</p>
        }
      } @else {
        <p class="muted">
          No test yet. A lab test every 2–3 years shows the bed's pH, organic matter, and nutrients.
        </p>
      }
      @if (canEdit()) {
        @if (recording()) {
          <form class="soil-test-form" (ngSubmit)="submit()">
            <label>
              Date tested
              <input
                type="date"
                name="testedOn"
                required
                [max]="today"
                [(ngModel)]="draft.testedOn"
              />
            </label>
            <label>
              Lab
              <input name="lab" maxlength="120" [(ngModel)]="draft.lab" />
            </label>
            <label>
              pH
              <input type="number" name="ph" min="0" max="14" step="0.1" [(ngModel)]="draft.ph" />
            </label>
            <label>
              Organic matter (%)
              <input
                type="number"
                name="organicMatter"
                min="0"
                max="100"
                step="0.1"
                [(ngModel)]="draft.organicMatterPct"
              />
            </label>
            @for (n of nutrients; track n.key) {
              <label>
                {{ n.label }}
                <select [name]="n.key" [attr.name]="n.key" [(ngModel)]="draft[n.key]">
                  <option [ngValue]="null">Not reported</option>
                  <option ngValue="low">Low</option>
                  <option ngValue="medium">Medium</option>
                  <option ngValue="high">High</option>
                </select>
              </label>
            }
            <label class="soil-test-wide">
              The lab's recommendations
              <textarea
                name="recommendations"
                rows="3"
                maxlength="4000"
                [(ngModel)]="draft.recommendations"
              ></textarea>
            </label>
            @if (formError()) {
              <p class="error" role="alert">{{ formError() }}</p>
            }
            <div class="filters">
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="busy()"
                [attr.aria-busy]="busy() || null"
              >
                Save test
              </button>
              <button type="button" class="btn btn-secondary" (click)="recording.set(false)">
                Cancel
              </button>
            </div>
          </form>
        } @else {
          <div class="filters">
            <button type="button" class="btn btn-secondary" (click)="start()">
              Record a soil test
            </button>
            @if (b.soilTest; as t) {
              @if (confirmDelete()) {
                <button
                  type="button"
                  class="btn btn-destructive"
                  [disabled]="busy()"
                  [attr.aria-busy]="busy() || null"
                  (click)="removeTest(t)"
                >
                  Confirm delete test
                </button>
                <button type="button" class="btn btn-secondary" (click)="confirmDelete.set(false)">
                  Keep it
                </button>
              } @else {
                <button type="button" class="btn btn-secondary" (click)="confirmDelete.set(true)">
                  Delete this test
                </button>
              }
            }
          </div>
        }
      }
    </section>
  `,
})
export class BedSoilTest {
  bed = input.required<LayoutBedDto>();
  canEdit = input(false);
  /** Saves a test; resolves true when it was saved. */
  save = input.required<(bedId: string, test: SoilTestCreateDto) => Promise<boolean>>();
  /** Deletes a test; resolves true when it was deleted. */
  remove = input.required<(bedId: string, test: SoilTestDto) => Promise<boolean>>();

  readonly today = localToday();
  readonly nutrients = [
    { key: 'nitrogen', label: 'Nitrogen (N)' },
    { key: 'phosphorus', label: 'Phosphorus (P)' },
    { key: 'potassium', label: 'Potassium (K)' },
  ] as const;

  private readonly bedId = computed(() => this.bed().id);
  /** The form is open; it closes when another bed is selected. */
  recording = linkedSignal({ source: this.bedId, computation: () => false });
  confirmDelete = linkedSignal({ source: this.bedId, computation: () => false });
  busy = signal(false);
  formError = signal('');
  draft = this.emptyDraft();

  notes = computed(() => {
    const test = this.bed().soilTest;
    return test ? soilTestNotes(test, this.today) : [];
  });

  tested(t: SoilTestDto): string {
    return `Tested ${formatDay(t.testedOn)}${t.lab ? ` by ${t.lab}` : ''}`;
  }

  results(t: SoilTestDto): string {
    const parts: string[] = [];
    if (t.ph != null) parts.push(`pH ${t.ph}`);
    if (t.organicMatterPct != null) parts.push(`organic matter ${t.organicMatterPct}%`);
    for (const n of this.nutrients) {
      const level = t[n.key];
      if (level) parts.push(`${n.label.split(' (')[0]} ${LEVELS[level]}`);
    }
    return parts.join(' · ');
  }

  start() {
    this.draft = this.emptyDraft();
    this.formError.set('');
    this.recording.set(true);
  }

  async submit() {
    const test: SoilTestCreateDto = {
      testedOn: this.draft.testedOn,
      lab: this.draft.lab.trim() || null,
      ph: numberOrNull(this.draft.ph),
      organicMatterPct: numberOrNull(this.draft.organicMatterPct),
      nitrogen: this.draft.nitrogen,
      phosphorus: this.draft.phosphorus,
      potassium: this.draft.potassium,
      recommendations: this.draft.recommendations.trim() || null,
    };
    const error = checkTest(test, this.today);
    this.formError.set(error);
    if (error) return;
    this.busy.set(true);
    try {
      if (await this.save()(this.bed().id, test)) this.recording.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  async removeTest(test: SoilTestDto) {
    this.busy.set(true);
    try {
      if (await this.remove()(this.bed().id, test)) this.confirmDelete.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  private emptyDraft() {
    return {
      testedOn: localToday(),
      lab: '',
      ph: null as number | string | null,
      organicMatterPct: null as number | string | null,
      nitrogen: null as NutrientLevel | null,
      phosphorus: null as NutrientLevel | null,
      potassium: null as NutrientLevel | null,
      recommendations: '',
    };
  }
}

/** The same rules as the server's, so a mistake shows before the request. */
export function checkTest(test: SoilTestCreateDto, today: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(test.testedOn)) return 'Enter the date of the test';
  if (test.testedOn > today) return 'The test date cannot be in the future';
  if (test.ph != null && (test.ph < 0 || test.ph > 14)) return 'pH is between 0 and 14';
  if (test.organicMatterPct != null && (test.organicMatterPct < 0 || test.organicMatterPct > 100))
    return 'Organic matter is a percentage, 0 to 100';
  const any =
    test.ph != null ||
    test.organicMatterPct != null ||
    test.nitrogen ||
    test.phosphorus ||
    test.potassium ||
    test.recommendations;
  return any ? '' : 'Enter at least one result from the test';
}
