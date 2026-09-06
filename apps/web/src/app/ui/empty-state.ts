import { Component, input } from '@angular/core';

@Component({
  selector: 'og-empty-state',
  standalone: true,
  template: `
    <div class="empty-state">
      <p class="empty-state-title">{{ title() }}</p>
      <p class="muted">{{ body() }}</p>
      <div class="empty-actions">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
}
