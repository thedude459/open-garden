import { Component, HostListener, inject } from '@angular/core';
import { PlannerDraftService } from './planner-draft.service';

/**
 * The plan saves itself; this says where that stands, offers Retry when a save
 * did not go through, and Undo (also Ctrl or Cmd+Z outside text fields).
 */
@Component({
  selector: 'og-plan-save-status',
  standalone: true,
  template: `
    <button
      type="button"
      class="btn btn-secondary"
      [disabled]="!planner.canUndo()"
      (click)="planner.undo()"
    >
      Undo
    </button>
    @switch (planner.status()) {
      @case ('saved') {
        <span class="muted" role="status">All changes saved</span>
      }
      @case ('failed') {
        <span class="needs-attention" role="status">Not saved: {{ planner.statusMessage() }}</span>
        <button type="button" class="btn btn-secondary" (click)="planner.retry()">Retry</button>
      }
      @case ('blocked') {
        <span class="needs-attention" role="status">Not saved: {{ planner.statusMessage() }}</span>
      }
      @default {
        <span class="muted" role="status">Saving…</span>
      }
    }
  `,
})
export class PlanSaveStatus {
  readonly planner = inject(PlannerDraftService);

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent) {
    if (ev.key.toLowerCase() !== 'z' || !(ev.ctrlKey || ev.metaKey) || ev.shiftKey) return;
    const target = ev.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    ev.preventDefault();
    this.planner.undo();
  }
}
