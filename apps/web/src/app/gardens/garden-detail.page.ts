import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { feetToInches, inchesToFeetInput, snapHalfFoot } from '@open-garden/garden-layout';
import { embedMapReachable, embedMapUrl } from '@open-garden/garden-place';
import type { GardenDetailDto, GardenRole, PlaceCandidateDto } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { NoticeService } from '../ui/notice.service';
import { GardensApiService, OnlineRequiredError } from './gardens-api.service';
import { PlannerDraftService } from './planner-draft.service';
@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (garden(); as g) {
      <header class="page-head">
        <div>
          <h2>{{ g.name }}</h2>
          <p class="muted">You are {{ g.myRole }} of this garden.</p>
        </div>
      </header>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <h3>Configuration</h3>
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
          Length (ft)
          <input
            type="number"
            min="0.5"
            step="0.5"
            name="gardenLength"
            [(ngModel)]="lengthFeet"
            [disabled]="!canEdit()"
            required
          />
        </label>
        <label>
          Width (ft)
          <input
            type="number"
            min="0.5"
            step="0.5"
            name="gardenWidth"
            [(ngModel)]="widthFeet"
            [disabled]="!canEdit()"
            required
          />
        </label>
        <section>
          <h4>Address</h4>
          <p>{{ g.place?.formattedAddress || 'No address is set' }}</p>
          @if (canEdit()) {
            <input [(ngModel)]="addressQuery" name="gardenAddress" placeholder="Garden address" />
            <button type="button" class="btn btn-secondary" (click)="lookup()" [disabled]="lookingUp()">
              Look up address
            </button>
          }
          @if (lookupError()) {
            <p class="error">{{ lookupError() }}</p>
          }
          @if (truncated()) {
            <p>Type a more specific address.</p>
          }
          @for (candidate of candidates(); track candidate.placeId) {
            @if (canEdit()) {
              <button type="button" class="btn btn-secondary" (click)="choose(candidate)">
                {{ candidate.formattedAddress }}
              </button>
            }
          }
          @if (mapSrc(); as src) {
            <iframe
              class="garden-map"
              style="width: 100%; height: 220px; border: 0"
              [src]="src"
              title="Garden map"
              (error)="onMapError()"
            ></iframe>
          }
          @if (mapUnavailable()) {
            <p>The map is unavailable.</p>
          }
          @if (seasonNotice()) {
            <p>{{ seasonNotice() }}</p>
          }
        </section>
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
          <button
            type="submit"
            class="btn btn-primary"
            [attr.aria-busy]="notices.busyMap().has('save-garden') || null"
            [disabled]="notices.busyMap().has('save-garden') || !canSave()"
          >
            Save garden
          </button>
        }
      </form>

      <h3>Members</h3>
      <ul class="card-list">
        @for (m of g.members; track m.userId) {
          <li class="row">
            <span>{{ m.displayName || m.email }} · {{ m.email }} · {{ m.role }}</span>
            @if (g.myRole === 'owner' && m.userId !== g.ownerUserId) {
              <span class="member-actions">
                <button
                  type="button"
                  class="btn btn-secondary"
                  [attr.aria-busy]="memberBusy(m.userId) || null"
                  [disabled]="memberBusy(m.userId)"
                  (click)="setRole(m.userId, 'viewer')"
                >
                  Make viewer
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  [attr.aria-busy]="memberBusy(m.userId) || null"
                  [disabled]="memberBusy(m.userId)"
                  (click)="setRole(m.userId, 'collaborator')"
                >
                  Make collaborator
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  [attr.aria-busy]="memberBusy(m.userId) || null"
                  [disabled]="memberBusy(m.userId)"
                  (click)="setRole(m.userId, 'owner')"
                >
                  Transfer ownership
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  [attr.aria-busy]="memberBusy(m.userId) || null"
                  [disabled]="memberBusy(m.userId)"
                  (click)="removeMember(m.userId)"
                >
                  Remove
                </button>
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
          <button
            type="submit"
            class="btn btn-primary"
            [attr.aria-busy]="notices.busyMap().has('invite') || null"
            [disabled]="notices.busyMap().has('invite')"
          >
            Invite
          </button>
        </form>
        <p class="muted">They need an account. If they don't have one yet, copy a join link for this email.</p>
        <button
          type="button"
          class="btn btn-secondary"
          [disabled]="!inviteEmail.trim()"
          (click)="copyJoinLink()"
        >
          Copy join link
        </button>
      }
      @if (g.myRole !== 'owner') {
        <button
          type="button"
          class="btn btn-secondary"
          [attr.aria-busy]="notices.busyMap().has('leave-garden') || null"
          [disabled]="notices.busyMap().has('leave-garden')"
          (click)="leave()"
        >
          Leave garden
        </button>
      }
      @if (g.myRole === 'owner') {
        @if (!confirmDelete()) {
          <button type="button" class="btn btn-secondary" (click)="confirmDelete.set(true)">
            Delete garden
          </button>
        } @else {
          <p>Permanently delete this garden? This cannot be undone.</p>
          <button
            type="button"
            class="btn btn-destructive"
            [attr.aria-busy]="notices.busyMap().has('delete-garden') || null"
            [disabled]="notices.busyMap().has('delete-garden')"
            (click)="deleteGarden()"
          >
            Confirm delete
          </button>
          <button type="button" class="btn btn-secondary" (click)="confirmDelete.set(false)">
            Cancel
          </button>
        }
      }
    } @else if (loading()) {
      <p class="muted">Loading…</p>
    } @else {
      <p class="muted">Garden unavailable offline or not found.</p>
    }
  `,
})
export class GardenDetailPage implements OnInit, OnDestroy {
  private readonly api = inject(GardensApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly auth = inject(AuthApiService);
  private readonly planner = inject(PlannerDraftService);
  readonly notices = inject(NoticeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  garden = signal<GardenDetailDto | null>(null);
  loading = signal(true);
  error = signal('');
  confirmDelete = signal(false);
  name = '';
  notes = '';
  lengthFeet = 20;
  widthFeet = 10;
  zone: number | null = null;
  lastMonth: number | null = null;
  lastDay: number | null = null;
  firstMonth: number | null = null;
  firstDay: number | null = null;
  addressQuery = '';
  readonly candidates = signal<PlaceCandidateDto[]>([]);
  readonly truncated = signal(false);
  readonly pending = signal<PlaceCandidateDto | null>(null);
  readonly mapSrc = signal<SafeResourceUrl | null>(null);
  readonly mapReady = signal(false);
  readonly mapFailed = signal(false);
  readonly lookingUp = signal(false);
  readonly lookupError = signal('');
  readonly seasonNotice = signal<string | null>(null);
  inviteEmail = '';
  inviteRole: 'collaborator' | 'viewer' = 'collaborator';
  zones = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  private mapGen = 0;
  private mapWatch: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.planner.discard();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.load(id);
  }

  ngOnDestroy() {
    this.clearMapWatch();
  }

  canSave(): boolean {
    if (!this.pending()) return true;
    return this.mapReady() && !this.mapFailed() && !this.truncated();
  }

  mapUnavailable(): boolean {
    const hasPlace = this.pending() != null || this.garden()?.place != null;
    if (!hasPlace) return false;
    return this.mapFailed();
  }

  async lookup() {
    this.lookupError.set('');
    this.seasonNotice.set(null);
    this.candidates.set([]);
    this.pending.set(null);
    this.truncated.set(false);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.lookupError.set(new OnlineRequiredError().message);
      this.refreshMap();
      return;
    }
    this.lookingUp.set(true);
    try {
      const result = await this.api.lookupPlace(this.addressQuery);
      this.candidates.set(result.candidates);
      this.truncated.set(result.truncated);
      if (result.candidates.length === 1 && !result.truncated) this.choose(result.candidates[0]!);
      else this.refreshMap();
    } catch (err) {
      this.lookupError.set(messageFrom(err));
      this.refreshMap();
    } finally {
      this.lookingUp.set(false);
    }
  }

  choose(candidate: PlaceCandidateDto) {
    this.pending.set(candidate);
    this.refreshMap();
  }

  onMapError() {
    this.clearMapWatch();
    this.mapFailed.set(true);
    this.mapReady.set(false);
  }

  private refreshMap() {
    this.clearMapWatch();
    const pending = this.pending();
    const point = pending ?? this.garden()?.place ?? null;
    this.mapReady.set(false);
    this.mapFailed.set(false);
    if (!point || (pending != null && this.truncated())) {
      this.mapSrc.set(null);
      return;
    }
    const url = embedMapUrl(point.latitude, point.longitude);
    this.mapSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    this.watchMap(url);
  }

  /** ponytail: iframe load also fires when the embed is aborted, and the parent cannot read that document. A no-cors fetch is the failure signal. Upgrade path is a load event that only fires for a finished document. */
  private watchMap(url: string) {
    this.clearMapWatch();
    const gen = this.mapGen;
    this.mapWatch = setTimeout(() => {
      if (gen === this.mapGen) this.onMapError();
    }, 3000);
    void embedMapReachable(url).then((ok) => {
      if (gen !== this.mapGen) return;
      if (!ok) {
        this.onMapError();
        return;
      }
      this.clearMapWatch();
      this.mapFailed.set(false);
      this.mapReady.set(true);
    });
  }

  private clearMapWatch() {
    this.mapGen++;
    if (this.mapWatch == null) return;
    clearTimeout(this.mapWatch);
    this.mapWatch = null;
  }

  canEdit() {
    const role = this.garden()?.myRole;
    return role === 'owner' || role === 'collaborator';
  }

  memberBusy(userId: string): boolean {
    return this.notices.busyMap().has(`member:${userId}`);
  }

  async load(id: string) {
    this.loading.set(true);
    const detail = await this.api.detail(id);
    this.garden.set(detail);
    if (detail) this.applyForm(detail);
    this.pending.set(null);
    this.candidates.set([]);
    this.truncated.set(false);
    this.refreshMap();
    this.loading.set(false);
  }

  async save() {
    const g = this.garden();
    const pending = this.pending();
    if (!g || (pending && !this.canSave())) return;
    this.error.set('');
    await this.notices.run('save-garden', async () => {
      try {
        const updated = await this.api.patch(g.id, {
          name: this.name,
          notes: this.notes.trim() ? this.notes : null,
          hardinessZone: pending ? undefined : this.zone,
          lastFrost: pending ? undefined : toFrost(this.lastMonth, this.lastDay),
          firstFrost: pending ? undefined : toFrost(this.firstMonth, this.firstDay),
          lengthInches: Math.max(6, snapHalfFoot(feetToInches(this.lengthFeet))),
          widthInches: Math.max(6, snapHalfFoot(feetToInches(this.widthFeet))),
          ...(pending ? { place: pending } : {}),
        });
        this.garden.set(updated);
        this.applyForm(updated);
        this.pending.set(null);
        this.candidates.set([]);
        this.addressQuery = '';
        this.seasonNotice.set(updated.seasonNotice);
        this.refreshMap();
        this.notices.success(updated.seasonNotice ?? 'Garden saved');
      } catch (err) {
        this.notices.error(messageFrom(err));
      }
    });
  }

  async invite() {
    const g = this.garden();
    if (!g) return;
    this.error.set('');
    await this.notices.run('invite', async () => {
      try {
        await this.api.invite(g.id, { email: this.inviteEmail, role: this.inviteRole });
        this.inviteEmail = '';
        await this.load(g.id);
        this.notices.success('Member invited');
      } catch (err) {
        this.notices.error(messageFrom(err));
      }
    });
  }

  async copyJoinLink() {
    const email = this.inviteEmail.trim();
    if (!email || typeof location === 'undefined') return;
    const url = `${location.origin}/login?email=${encodeURIComponent(email)}&register=1`;
    try {
      await navigator.clipboard.writeText(url);
      this.notices.success('Join link copied');
    } catch {
      this.notices.error(url);
    }
  }

  async setRole(userId: string, role: GardenRole) {
    const g = this.garden();
    if (!g) return;
    this.error.set('');
    await this.notices.run(`member:${userId}`, async () => {
      try {
        await this.api.patchMember(g.id, userId, { role });
        await this.load(g.id);
        this.notices.success(role === 'owner' ? 'Ownership transferred' : 'Role updated');
      } catch (err) {
        this.notices.error(messageFrom(err));
      }
    });
  }

  async removeMember(userId: string) {
    const g = this.garden();
    if (!g) return;
    await this.notices.run(`member:${userId}`, async () => {
      try {
        await this.api.removeMember(g.id, userId);
        await this.load(g.id);
        this.notices.success('Member removed');
      } catch (err) {
        this.notices.error(messageFrom(err));
      }
    });
  }

  async leave() {
    const g = this.garden();
    const userId = this.auth.currentUserId();
    if (!g || !userId) return;
    await this.notices.run('leave-garden', async () => {
      try {
        await this.api.removeMember(g.id, userId);
        await this.router.navigateByUrl('/gardens');
      } catch (err) {
        this.notices.error(messageFrom(err));
      }
    });
  }

  async deleteGarden() {
    const g = this.garden();
    if (!g) return;
    this.error.set('');
    await this.notices.run('delete-garden', async () => {
      try {
        await this.api.remove(g.id);
        await this.router.navigateByUrl('/gardens');
      } catch (err) {
        this.notices.error(messageFrom(err));
      }
    });
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
    this.lengthFeet = inchesToFeetInput(g.lengthInches ?? 240);
    this.widthFeet = inchesToFeetInput(g.widthInches ?? 120);
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

