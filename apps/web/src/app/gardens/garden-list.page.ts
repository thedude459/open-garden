import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { GardenSummaryDto } from '@open-garden/shared-types';
import { HttpErrorResponse } from '@angular/common/http';
import { GardensApiService, OnlineRequiredError } from './gardens-api.service';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <h2>Gardens</h2>
    <form class="filters" (ngSubmit)="create()">
      <input [(ngModel)]="name" name="gardenName" placeholder="Garden name" required />
      <input [(ngModel)]="notes" name="gardenNotes" placeholder="Notes (optional)" />
      <button type="submit">Create garden</button>
    </form>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (items().length === 0) {
      <p class="muted">No gardens yet. Create one to start planning with your household.</p>
    } @else {
      <div class="card-list">
        @for (g of items(); track g.id) {
          <a class="row" [routerLink]="['/gardens', g.id]">
            <span>
              <strong>{{ g.name }}</strong>
              <span class="muted"> · {{ g.myRole }}</span>
            </span>
            <span class="muted">
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
  name = '';
  notes = '';
  items = signal<GardenSummaryDto[]>([]);
  loading = signal(false);
  error = signal('');

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    const page = await this.api.list();
    this.items.set(page.items);
    this.loading.set(false);
  }

  async create() {
    this.error.set('');
    try {
      await this.api.create({
        name: this.name,
        notes: this.notes.trim() ? this.notes : null,
      });
      this.name = '';
      this.notes = '';
      await this.load();
    } catch (err) {
      this.error.set(err instanceof OnlineRequiredError ? err.message : userMessage(err));
    }
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
