import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { GardenSummaryDto } from '@open-garden/shared-types';
import { HttpErrorResponse } from '@angular/common/http';
import { GardensApiService, OnlineRequiredError } from './gardens-api.service';
import { NoticeService } from '../ui/notice.service';
import { EmptyState } from '../ui/empty-state';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, EmptyState, NgTemplateOutlet],
  template: `
    <h2>Gardens</h2>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    <ng-template #createGarden>
      <form class="filters" (ngSubmit)="create()">
        <input [(ngModel)]="name" name="gardenName" placeholder="Garden name" required />
        <input [(ngModel)]="notes" name="gardenNotes" placeholder="Notes (optional)" />
        <button
          type="submit"
          class="btn btn-primary"
          [attr.aria-busy]="notices.busyMap().has('create-garden') || null"
          [disabled]="notices.busyMap().has('create-garden')"
        >
          Create garden
        </button>
      </form>
    </ng-template>
    @if (loading()) {
      <ng-container [ngTemplateOutlet]="createGarden" />
      <p class="muted">Loading…</p>
    } @else if (items().length === 0) {
      <og-empty-state title="No gardens yet" [body]="emptyBody()">
        <ng-container [ngTemplateOutlet]="createGarden" />
      </og-empty-state>
    } @else {
      <ng-container [ngTemplateOutlet]="createGarden" />
      <div class="card-list">
        @for (g of items(); track g.id) {
          <a class="row" [routerLink]="['/gardens', g.id]">
            <span>
              <strong>{{ g.name }}</strong>
              <span class="muted"> · {{ g.myRole }}</span>
            </span>
            <span class="muted">
              {{ g.bedCount }} beds · {{ g.placementCount }} placements
              ·
              @if (g.hardinessZone != null) {
                zone {{ g.hardinessZone }}
              } @else {
                zone not set
              }
            </span>
          </a>
        }
      </div>
    }
  `,
})
export class GardenListPage implements OnInit {
  private readonly api = inject(GardensApiService);
  readonly notices = inject(NoticeService);
  name = '';
  notes = '';
  items = signal<GardenSummaryDto[]>([]);
  loading = signal(false);
  error = signal('');

  ngOnInit() {
    void this.load();
  }

  emptyBody() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return new OnlineRequiredError().message;
    }
    return 'Create one to start planning with your household.';
  }

  async load() {
    this.loading.set(true);
    const page = await this.api.listAll();
    this.items.set(page.items.map(withCounts));
    this.loading.set(false);
  }

  async create() {
    this.error.set('');
    await this.notices.run('create-garden', async () => {
      try {
        await this.api.create({
          name: this.name,
          notes: this.notes.trim() ? this.notes : null,
        });
        this.name = '';
        this.notes = '';
        await this.load();
        this.notices.success('Garden created');
      } catch (err) {
        this.notices.error(userMessage(err));
      }
    });
  }
}

function userMessage(err: unknown): string {
  if (err instanceof OnlineRequiredError) return err.message;
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: { message?: string } } | null)?.error?.message;
    if (msg) return msg;
  }
  return 'Could not save garden';
}

function withCounts(g: GardenSummaryDto): GardenSummaryDto {
  return {
    ...g,
    bedCount: g.bedCount ?? 0,
    placementCount: g.placementCount ?? 0,
  };
}
