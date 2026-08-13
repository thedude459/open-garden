import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { GardenDetailDto, GardenRole } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { GardensApiService, OnlineRequiredError } from './gardens-api.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (garden(); as g) {
      <h2>{{ g.name }}</h2>
      <p class="muted">You are {{ g.myRole }} of this garden.</p>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <form class="stack" (ngSubmit)="save()">
        <label>
          Name
          <input [(ngModel)]="name" name="name" [disabled]="!canEdit()" />
        </label>
        <label>
          Notes
          <textarea [(ngModel)]="notes" name="notes" rows="3" [disabled]="!canEdit()"></textarea>
        </label>
        <label>
          Hardiness zone
          <select
            name="zone"
            [ngModel]="emptyIfNull(zone)"
            (ngModelChange)="zone = toOptionalNumber($event)"
            [disabled]="!canEdit()"
          >
            <option value="">Not set</option>
            @for (z of zones; track z) {
              <option [value]="z">Zone {{ z }}</option>
            }
          </select>
        </label>
        <fieldset class="filters">
          <legend>Last frost (spring)</legend>
          @if (!g.lastFrost && !lastMonth) {
            <span class="muted">Not set</span>
          }
          <select
            name="lastMonth"
            [ngModel]="emptyIfNull(lastMonth)"
            (ngModelChange)="lastMonth = toOptionalNumber($event)"
            [disabled]="!canEdit()"
          >
            <option value="">Month</option>
            @for (m of months; track m) {
              <option [value]="m">{{ m }}</option>
            }
          </select>
          <input
            type="number"
            min="1"
            max="31"
            [(ngModel)]="lastDay"
            name="lastDay"
            placeholder="Day"
            [disabled]="!canEdit()"
          />
        </fieldset>
        <fieldset class="filters">
          <legend>First frost (fall)</legend>
          @if (!g.firstFrost && !firstMonth) {
            <span class="muted">Not set</span>
          }
          <select
            name="firstMonth"
            [ngModel]="emptyIfNull(firstMonth)"
            (ngModelChange)="firstMonth = toOptionalNumber($event)"
            [disabled]="!canEdit()"
          >
            <option value="">Month</option>
            @for (m of months; track m) {
              <option [value]="m">{{ m }}</option>
            }
          </select>
          <input
            type="number"
            min="1"
            max="31"
            [(ngModel)]="firstDay"
            name="firstDay"
            placeholder="Day"
            [disabled]="!canEdit()"
          />
        </fieldset>
        @if (canEdit()) {
          <button type="submit">Save garden</button>
        }
      </form>

      <h3>Members</h3>
      <ul class="card-list">
        @for (m of g.members; track m.userId) {
          <li class="row">
            <span>{{ m.displayName || m.email }} · {{ m.email }} · {{ m.role }}</span>
            @if (g.myRole === 'owner' && m.userId !== g.ownerUserId) {
              <span>
                <button type="button" (click)="setRole(m.userId, 'viewer')">Make viewer</button>
                <button type="button" (click)="setRole(m.userId, 'collaborator')">
                  Make collaborator
                </button>
                <button type="button" (click)="setRole(m.userId, 'owner')">Transfer ownership</button>
                <button type="button" (click)="removeMember(m.userId)">Remove</button>
              </span>
            }
          </li>
        }
      </ul>
      @if (g.myRole === 'owner') {
        <form class="filters" (ngSubmit)="invite()">
          <input [(ngModel)]="inviteEmail" name="inviteEmail" type="email" placeholder="Member email" />
          <select [(ngModel)]="inviteRole" name="inviteRole">
            <option value="collaborator">collaborator</option>
            <option value="viewer">viewer</option>
          </select>
          <button type="submit">Invite</button>
        </form>
      }
      @if (g.myRole !== 'owner') {
        <button type="button" (click)="leave()">Leave garden</button>
      }
      @if (g.myRole === 'owner') {
        @if (!confirmDelete()) {
          <button type="button" (click)="confirmDelete.set(true)">Delete garden</button>
        } @else {
          <p>Permanently delete this garden? This cannot be undone.</p>
          <button type="button" (click)="deleteGarden()">Confirm delete</button>
          <button type="button" (click)="confirmDelete.set(false)">Cancel</button>
        }
      }
    } @else if (!loading()) {
      <p class="muted">Garden unavailable offline or not found.</p>
    }
  `,
})
export class GardenDetailPage implements OnInit {
  private readonly api = inject(GardensApiService);
  private readonly auth = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  garden = signal<GardenDetailDto | null>(null);
  loading = signal(true);
  error = signal('');
  confirmDelete = signal(false);
  name = '';
  notes = '';
  zone: number | null = null;
  lastMonth: number | null = null;
  lastDay: number | null = null;
  firstMonth: number | null = null;
  firstDay: number | null = null;
  inviteEmail = '';
  inviteRole: 'collaborator' | 'viewer' = 'collaborator';
  zones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.load(id);
  }

  canEdit() {
    const role = this.garden()?.myRole;
    return role === 'owner' || role === 'collaborator';
  }

  async load(id: string) {
    this.loading.set(true);
    const detail = await this.api.detail(id);
    this.garden.set(detail);
    if (detail) this.applyForm(detail);
    this.loading.set(false);
  }

  async save() {
    const g = this.garden();
    if (!g) return;
    this.error.set('');
    try {
      const updated = await this.api.patch(g.id, {
        name: this.name,
        notes: this.notes.trim() ? this.notes : null,
        hardinessZone: this.zone,
        lastFrost: toFrost(this.lastMonth, this.lastDay),
        firstFrost: toFrost(this.firstMonth, this.firstDay),
      });
      this.garden.set(updated);
      this.applyForm(updated);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async invite() {
    const g = this.garden();
    if (!g) return;
    this.error.set('');
    try {
      await this.api.invite(g.id, { email: this.inviteEmail, role: this.inviteRole });
      this.inviteEmail = '';
      await this.load(g.id);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async setRole(userId: string, role: GardenRole) {
    const g = this.garden();
    if (!g) return;
    this.error.set('');
    try {
      await this.api.patchMember(g.id, userId, { role });
      await this.load(g.id);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async removeMember(userId: string) {
    const g = this.garden();
    if (!g) return;
    try {
      await this.api.removeMember(g.id, userId);
      await this.load(g.id);
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async leave() {
    const g = this.garden();
    const userId = this.auth.currentUserId();
    if (!g || !userId) return;
    try {
      await this.api.removeMember(g.id, userId);
      await this.router.navigateByUrl('/gardens');
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  async deleteGarden() {
    const g = this.garden();
    if (!g) return;
    this.error.set('');
    try {
      await this.api.remove(g.id);
      await this.router.navigateByUrl('/gardens');
    } catch (err) {
      this.error.set(messageFrom(err));
    }
  }

  emptyIfNull(value: number | null): string {
    return value == null ? '' : String(value);
  }

  toOptionalNumber(value: string): number | null {
    return value === '' ? null : Number(value);
  }

  private applyForm(g: GardenDetailDto) {
    this.name = g.name;
    this.notes = g.notes ?? '';
    this.zone = g.hardinessZone;
    this.lastMonth = g.lastFrost?.month ?? null;
    this.lastDay = g.lastFrost?.day ?? null;
    this.firstMonth = g.firstFrost?.month ?? null;
    this.firstDay = g.firstFrost?.day ?? null;
  }
}

function toFrost(month: number | null, day: number | null) {
  if (month == null && (day == null || Number.isNaN(Number(day)))) return null;
  if (month == null || day == null) return null;
  return { month: Number(month), day: Number(day) };
}

function messageFrom(err: unknown): string {
  if (err instanceof OnlineRequiredError) return err.message;
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: { message?: string } } | null)?.error?.message;
    if (msg) return msg;
  }
  return 'Could not update garden';
}
