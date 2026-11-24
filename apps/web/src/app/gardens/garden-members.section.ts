import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { GardenDetailDto, GardenRole } from '@open-garden/shared-types';
import { NoticeService } from '../ui/notice.service';
import { GardensApiService } from './gardens-api.service';
import { errorMessage } from '../ui/error-message';

/** Settings: who shares the property, their roles, and inviting someone. */
@Component({
  selector: 'og-garden-members',
  standalone: true,
  imports: [FormsModule],
  styles: ':host { display: block; }',
  template: `
    @let g = garden();
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
        <input
          [(ngModel)]="inviteEmail"
          name="inviteEmail"
          type="email"
          placeholder="Member email"
        />
        <select [(ngModel)]="inviteRole" name="inviteRole" aria-label="Role">
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
      <p class="muted">
        They need an account. If they don't have one yet, copy a join link for this email.
      </p>
      <button
        type="button"
        class="btn btn-secondary"
        [disabled]="!inviteEmail.trim()"
        (click)="copyJoinLink()"
      >
        Copy join link
      </button>
    }
  `,
})
export class GardenMembersSection {
  private readonly api = inject(GardensApiService);
  readonly notices = inject(NoticeService);
  readonly garden = input.required<GardenDetailDto>();
  /** Membership changed; the page reloads the property. */
  readonly changed = output<void>();
  inviteEmail = '';
  inviteRole: 'collaborator' | 'viewer' = 'collaborator';

  memberBusy(userId: string): boolean {
    return this.notices.busyMap().has(`member:${userId}`);
  }

  async invite() {
    await this.notices.run('invite', async () => {
      try {
        await this.api.invite(this.garden().id, { email: this.inviteEmail, role: this.inviteRole });
        this.inviteEmail = '';
        this.changed.emit();
        this.notices.success('Member invited');
      } catch (err) {
        this.notices.error(errorMessage(err, 'Could not update garden'));
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
    await this.notices.run(`member:${userId}`, async () => {
      try {
        await this.api.patchMember(this.garden().id, userId, { role });
        this.changed.emit();
        this.notices.success(role === 'owner' ? 'Ownership transferred' : 'Role updated');
      } catch (err) {
        this.notices.error(errorMessage(err, 'Could not update garden'));
      }
    });
  }

  async removeMember(userId: string) {
    await this.notices.run(`member:${userId}`, async () => {
      try {
        await this.api.removeMember(this.garden().id, userId);
        this.changed.emit();
        this.notices.success('Member removed');
      } catch (err) {
        this.notices.error(errorMessage(err, 'Could not update garden'));
      }
    });
  }
}
