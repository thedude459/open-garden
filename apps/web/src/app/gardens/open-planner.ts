import { Injectable, signal } from '@angular/core';
import type { PlannerDraftService } from './planner-draft.service';

/**
 * The planner, once a page has started it; null before. The app shell and the
 * leave guard read it here, so the planner's code loads with the planner's
 * pages instead of with the first page anyone opens.
 */
@Injectable({ providedIn: 'root' })
export class OpenPlanner {
  readonly service = signal<PlannerDraftService | null>(null);
}
