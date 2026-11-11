import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import type { PipelineRunSourceDto, PipelineRunSummaryDto } from '@open-garden/shared-types';
import { PipelineApiService } from './pipeline-api.service';

@Component({
  standalone: true,
  template: `
    <h2>Catalog pipeline</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    <p class="muted">
      Imports the open-garden-data plant catalog bundled with this version of Open Garden, or the
      file set in <code>PLANT_CATALOG_FILE</code>. The API also imports it when it starts; an
      unchanged catalog writes nothing.
    </p>
    <section class="stack">
      <h3>Run</h3>
      <button type="button" class="btn btn-primary" (click)="startRun()">Start run</button>
      @if (current(); as run) {
        <p>
          Status: <strong>{{ run.status }}</strong> · upserted {{ run.plantsUpserted }} · rejected
          {{ run.recordsRejected }}
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
  current = signal<(PipelineRunSummaryDto & { sources?: PipelineRunSourceDto[] }) | null>(null);
  runs = signal<PipelineRunSummaryDto[]>([]);
  error = signal('');
  private pollTimer: ReturnType<typeof setInterval> | undefined;

  ngOnInit() {
    void this.loadRuns();
  }

  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
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
