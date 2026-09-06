import { Component, inject } from '@angular/core';
import { NoticeService } from './notice.service';

@Component({
  selector: 'og-notice-host',
  standalone: true,
  template: `
    @if (notices.current(); as notice) {
      <div
        class="notice-host"
        aria-label="Notification"
        [attr.data-kind]="notice.kind"
        [attr.role]="notice.kind === 'success' ? 'status' : 'alert'"
      >
        <p>{{ notice.message }}</p>
        @if (notice.dismissible) {
          <button type="button" class="btn btn-secondary" (click)="notices.dismiss()">
            Dismiss
          </button>
        }
      </div>
    }
  `,
})
export class NoticeHost {
  readonly notices = inject(NoticeService);
}
