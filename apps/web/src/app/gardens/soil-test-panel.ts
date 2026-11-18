import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { soilTestNotes } from '@open-garden/garden-layout';
import type { NutrientLevel, SoilTestCreateDto, SoilTestDto } from '@open-garden/shared-types';
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
 * The latest soil test of an area or a bed, the advice it gives, and a form
 * to record a new one (ADR 0033). A bed without its own test shows its
 * area's. Advice only: nothing here blocks a planting.
 */
@Component({
  selector: 'og-soil-test-panel',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="soil-test" [attr.aria-label]="'Soil test of ' + name()">
      <h4>Soil test</h4>
      @if (test(); as t) {
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
      } @else if (inherited(); as from) {
        <p class="muted">{{ inheritedText(from) }}</p>
      } @else {
        <p class="muted">{{ emptyText() }}</p>
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
            @if (test(); as t) {
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
export class SoilTestPanel {
  /** The area or bed; the form starts over when it changes. */
  ownerId = input.required<string>();
  name = input.required<string>();
  test = input<SoilTestDto | null>(null);
  /** A bed without its own test: its area's test, which applies to it. */
  inherited = input<{ name: string; test: SoilTestDto } | null>(null);
  emptyText = input(
    'No test yet. A lab test every 2–3 years shows the pH, organic matter, and nutrients.',
  );
  canEdit = input(false);
  /** Saves a test; resolves true when it was saved. Needed only with `canEdit`. */
  save = input<(test: SoilTestCreateDto) => Promise<boolean>>(async () => false);
  /** Deletes a test; resolves true when it was deleted. Needed only with `canEdit`. */
  remove = input<(test: SoilTestDto) => Promise<boolean>>(async () => false);

  readonly today = localToday();
  readonly nutrients = [
    { key: 'nitrogen', label: 'Nitrogen (N)' },
    { key: 'phosphorus', label: 'Phosphorus (P)' },
    { key: 'potassium', label: 'Potassium (K)' },
  ] as const;

  /** The form is open; it closes when another area or bed is shown. */
  recording = linkedSignal({ source: this.ownerId, computation: () => false });
  confirmDelete = linkedSignal({ source: this.ownerId, computation: () => false });
  busy = signal(false);
  formError = signal('');
  draft = this.emptyDraft();

  notes = computed(() => {
    const test = this.test();
    return test ? soilTestNotes(test, this.today) : [];
  });

  inheritedText(from: { name: string; test: SoilTestDto }): string {
    const results = this.results(from.test);
    return (
      `The ${from.name} test applies: ${this.tested(from.test)}${results ? `, ${results}` : ''}. ` +
      "Record one here if this bed's soil differs, such as a raised bed."
    );
  }

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
      if (await this.save()(test)) this.recording.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  async removeTest(test: SoilTestDto) {
    this.busy.set(true);
    try {
      if (await this.remove()(test)) this.confirmDelete.set(false);
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
