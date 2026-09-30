import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { PlannerDraftService } from './planner-draft.service';
import { staysOnPlanner } from './stays-on-planner';

export const unsavedLayoutGuard: CanDeactivateFn<unknown> = (_component, current, _state, next) => {
  const planner = inject(PlannerDraftService);
  if (!planner.dirty()) return true;
  const gardenId = current.paramMap.get('id');
  if (gardenId && staysOnPlanner(gardenId, next.url)) return true;
  return typeof window === 'undefined' || window.confirm('Leave without saving this layout?');
};
