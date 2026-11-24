import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { GardenDetailDto } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { NoticeService } from '../ui/notice.service';
import { GardensApiService } from './gardens-api.service';
import { errorMessage } from '../ui/error-message';

/** Settings: leave a property you were invited to, or delete one you own. */
@Component({
  selector: 'og-garden-danger',
  standalone: true,
  styles: ':host { display: block; }',
  template: `
    @let g = garden();
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
  `,
})
export class GardenDangerSection {
  private readonly api = inject(GardensApiService);
  private readonly auth = inject(AuthApiService);
  private readonly router = inject(Router);
  readonly notices = inject(NoticeService);
  readonly garden = input.required<GardenDetailDto>();
  readonly confirmDelete = signal(false);

  async leave() {
    const userId = this.auth.currentUserId();
    if (!userId) return;
    await this.notices.run('leave-garden', async () => {
      try {
        await this.api.removeMember(this.garden().id, userId);
        await this.router.navigateByUrl('/gardens');
      } catch (err) {
        this.notices.error(errorMessage(err, 'Could not update garden'));
      }
    });
  }

  async deleteGarden() {
    await this.notices.run('delete-garden', async () => {
      try {
        await this.api.remove(this.garden().id);
        await this.router.navigateByUrl('/gardens');
      } catch (err) {
        this.notices.error(errorMessage(err, 'Could not update garden'));
      }
    });
  }
}
