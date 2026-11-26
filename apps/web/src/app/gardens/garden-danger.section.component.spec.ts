import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { GardenRole } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { AuthApiService } from '../auth/auth-api.service';
import { GardenDangerSection } from './garden-danger.section';
import { GardensApiService } from './gardens-api.service';
import { settled } from '../settled';

async function render(myRole: GardenRole, api: Partial<GardensApiService>) {
  const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  TestBed.configureTestingModule({
    providers: [
      { provide: GardensApiService, useValue: api },
      { provide: AuthApiService, useValue: { currentUserId: () => 'me' } },
      { provide: Router, useValue: router },
    ],
  });
  const fixture = TestBed.createComponent(GardenDangerSection);
  fixture.componentRef.setInput('garden', { id: 'g1', myRole });
  fixture.autoDetectChanges();
  await settled(fixture);
  const el: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
  return { fixture, el, button, router };
}

describe('GardenDangerSection', () => {
  it('deletes only after the owner confirms', async () => {
    const api = { remove: vi.fn().mockResolvedValue(undefined) };
    const view = await render('owner', api);
    expect(view.button('Leave garden')).toBeUndefined();
    expect(view.button('Confirm delete')).toBeUndefined();

    view.button('Delete garden')!.click();
    await settled(view.fixture);
    expect(view.el.textContent).toContain('This cannot be undone.');
    view.button('Cancel')!.click();
    await settled(view.fixture);
    expect(api.remove).not.toHaveBeenCalled();

    view.button('Delete garden')!.click();
    await settled(view.fixture);
    view.button('Confirm delete')!.click();
    await settled(view.fixture);
    expect(api.remove).toHaveBeenCalledWith('g1');
    expect(view.router.navigateByUrl).toHaveBeenCalledWith('/gardens');
  });

  it('lets a member who is not the owner leave, and never delete', async () => {
    const api = { removeMember: vi.fn().mockResolvedValue(undefined) };
    const view = await render('viewer', api);
    expect(view.button('Delete garden')).toBeUndefined();
    view.button('Leave garden')!.click();
    await settled(view.fixture);
    expect(api.removeMember).toHaveBeenCalledWith('g1', 'me');
    expect(view.router.navigateByUrl).toHaveBeenCalledWith('/gardens');
  });
});
