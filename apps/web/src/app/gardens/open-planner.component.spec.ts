import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutApiService } from './layout-api.service';
import { OpenPlanner } from './open-planner';
import { PlannerDraftService } from './planner-draft.service';
import { PlantingsApiService } from './plantings-api.service';
import { unsavedLayoutGuard } from './unsaved-layout';

const leave = (to: string) =>
  TestBed.runInInjectionContext(() =>
    unsavedLayoutGuard(
      null,
      { paramMap: convertToParamMap({ id: 'g1' }) } as ActivatedRouteSnapshot,
      { url: '/gardens/g1/layout' } as RouterStateSnapshot,
      { url: to } as RouterStateSnapshot,
    ),
  );

function startPlanner() {
  TestBed.configureTestingModule({
    providers: [
      { provide: LayoutApiService, useValue: {} },
      { provide: PlantingsApiService, useValue: {} },
    ],
  });
  return TestBed.inject(PlannerDraftService);
}

describe('the open planner', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('is none until a planner page starts it, and leaving then just goes', async () => {
    expect(TestBed.inject(OpenPlanner).service()).toBeNull();
    await expect(leave('/plants')).resolves.toBe(true);
  });

  it('is the planner once started, and leaving it sends the edit still waiting', async () => {
    const planner = startPlanner();
    expect(TestBed.inject(OpenPlanner).service()).toBe(planner);
    planner.status.set('pending');
    const flush = vi.spyOn(planner, 'flush').mockImplementation(async () => {
      planner.status.set('saved');
    });
    await expect(leave('/gardens/g1/layout/beds/b1')).resolves.toBe(true);
    expect(flush).not.toHaveBeenCalled();
    await expect(leave('/plants')).resolves.toBe(true);
    expect(flush).toHaveBeenCalledOnce();
  });
});
