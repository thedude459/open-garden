import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { PlannerDraftService } from './planner-draft.service';
import { staysOnPlanner } from './stays-on-planner';

/**
 * The plan saves itself. Leaving it sends any edit still waiting; only a save
 * that cannot go through (offline, refused, too close) asks before leaving.
 */
export const unsavedLayoutGuard: CanDeactivateFn<unknown> = async (
  _component,
  current,
  _state,
  next,
) => {
  const planner = inject(PlannerDraftService);
  if (!planner.unsaved()) return true;
  const gardenId = current.paramMap.get('id');
  if (gardenId && staysOnPlanner(gardenId, next.url)) return true;
  await planner.flush();
  if (planner.status() === 'saved') return true;
  return (
    typeof window === 'undefined' ||
    window.confirm(`Plan changes are not saved (${planner.statusMessage()}). Leave anyway?`)
  );
};
