import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  PipelineCadence,
  PipelineRunDetailDto,
  PipelineRunSourceDto,
  PipelineRunSummaryDto,
  PipelineSettingsDto,
} from '@open-garden/shared-types';
import { PipelineApiService } from './pipeline-api.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2>Catalog pipeline</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    <section class="stack">
      <h3>Settings</h3>
      <label>
        Cadence
        <select name="cadence" [(ngModel)]="cadence">
          <option value="daily">Daily</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>
      <label>
        Run at hour (UTC)
        <select name="runAtHourUtc" [(ngModel)]="runAtHourUtc">
          @for (hour of hours; track hour) {
            <option [value]="hour">{{ hour }}</option>
          }
        </select>
      </label>
      <label>
        Source order (comma-separated)
        <input name="sourceOrder" [(ngModel)]="sourceOrderText" />
      </label>
      <p class="muted">Registered sources: {{ registeredSources().join(', ') || 'none' }}</p>
      <button type="button" (click)="saveSettings()">Save settings</button>
    </section>
    <section class="stack">
      <h3>Run</h3>
      <button type="button" (click)="startRun()">Start run</button>
      @if (current(); as run) {
        <p>
          Status: <strong>{{ run.status }}</strong>
          · upserted {{ run.plantsUpserted }}
          · rejected {{ run.recordsRejected }}
        </p>
        @if (run.sources?.length) {
          <ul>
            @for (source of run.sources; track source.sourceId) {
              <li>
                {{ source.sourceId }}: {{ source.status }} (accepted {{ source.recordsAccepted }},
                rejected {{ source.recordsRejected }})
              </li>
            }
          </ul>
        }
      }
    </section>
    <section>
      <h3>Recent runs</h3>
      @if (runs().length === 0) {
        <p class="muted">No runs yet.</p>
      } @else {
        <div class="card-list">
          @for (run of runs(); track run.id) {
            <div class="row">
              <span>{{ run.status }} · {{ run.triggeredBy }} · {{ run.startedAt }}</span>
              <span class="muted">upserted {{ run.plantsUpserted }}</span>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class PipelinePage implements OnInit, OnDestroy {
  private readonly api = inject(PipelineApiService);
  cadence: PipelineCadence = 'daily';
  runAtHourUtc = '6';
  sourceOrderText = 'fixture';
  hours = Array.from({ length: 24 }, (_, i) => String(i));
  registeredSources = signal<string[]>([]);
  current = signal<(PipelineRunSummaryDto & { sources?: PipelineRunSourceDto[] }) | null>(null);
  runs = signal<PipelineRunSummaryDto[]>([]);
  error = signal('');
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  ngOnInit() {
    void this.loadSettings();
    void this.loadRuns();
  }

  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  async loadSettings() {
    const settings: PipelineSettingsDto = await this.api.getSettings();
    this.cadence = settings.cadence;
    this.runAtHourUtc = String(settings.runAtHourUtc);
    this.sourceOrderText = settings.sourceOrder.join(', ');
    this.registeredSources.set(settings.registeredSources);
  }

  async saveSettings() {
    this.error.set('');
    try {
      const settings = await this.api.patchSettings({
        cadence: this.cadence,
        runAtHourUtc: Number(this.runAtHourUtc),
        sourceOrder: this.sourceOrderText
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      });
      this.cadence = settings.cadence;
      this.runAtHourUtc = String(settings.runAtHourUtc);
      this.sourceOrderText = settings.sourceOrder.join(', ');
    } catch {
      this.error.set('Invalid pipeline settings');
    }
  }

  async startRun() {
    this.error.set('');
    try {
      const run = await this.api.start();
      this.current.set(run);
      this.poll(run.id);
      await this.loadRuns();
    } catch {
      this.error.set('Could not start pipeline run');
    }
  }

  private poll(id: string) {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      void this.refreshRun(id);
    }, 400);
    void this.refreshRun(id);
  }

  private async refreshRun(id: string) {
    const detail = await this.api.get(id);
    this.current.set(detail);
    if (detail.status !== 'running' && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
      await this.loadRuns();
    }
  }

  private async loadRuns() {
    const list = await this.api.list(1, 20);
    this.runs.set(list.items);
  }
}
