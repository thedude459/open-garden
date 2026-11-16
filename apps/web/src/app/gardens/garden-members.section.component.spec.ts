import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { GardenDetailDto, GardenRole } from '@open-garden/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { NoticeService } from '../ui/notice.service';
import { GardenMembersSection } from './garden-members.section';
import { GardensApiService } from './gardens-api.service';

const garden = (myRole: GardenRole): GardenDetailDto =>
  ({
    id: 'g1',
    name: 'Home',
    myRole,
    ownerUserId: 'owner',
    members: [
      { userId: 'owner', email: 'owner@example.com', displayName: 'Olive', role: 'owner' },
      { userId: 'friend', email: 'friend@example.com', displayName: null, role: 'viewer' },
    ],
  }) as GardenDetailDto;

async function render(myRole: GardenRole, api: Partial<GardensApiService> = {}) {
  TestBed.configureTestingModule({ providers: [{ provide: GardensApiService, useValue: api }] });
  const fixture = TestBed.createComponent(GardenMembersSection);
  fixture.componentRef.setInput('garden', garden(myRole));
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const buttons = (name: string) =>
    [...el.querySelectorAll('button')].filter((b) => b.textContent.trim() === name);
  return { fixture, el, buttons, changed, notices: spyNotices() };
}

/** Records what the section told the member; notices dismiss themselves on a timer. */
function spyNotices() {
  const notices = TestBed.inject(NoticeService);
  const said: string[] = [];
  vi.spyOn(notices, 'success').mockImplementation((message) => (said.push(message), true));
  vi.spyOn(notices, 'error').mockImplementation((message) => (said.push(message), true));
  return { said };
}

describe('GardenMembersSection', () => {
  it('lists members; the owner manages everyone but themself', async () => {
    const api = { patchMember: vi.fn().mockResolvedValue({}) };
    const view = await render('owner', api);
    const rows = [...view.el.querySelectorAll('li')].map((li) =>
      li.querySelector('span')!.textContent.trim(),
    );
    expect(rows).toEqual([
      'Olive · owner@example.com · owner',
      'friend@example.com · friend@example.com · viewer',
    ]);
    // One set of actions: for the friend, not for the owner's own row.
    expect(view.buttons('Remove')).toHaveLength(1);

    view.buttons('Make collaborator')[0]!.click();
    await view.fixture.whenStable();
    expect(api.patchMember).toHaveBeenCalledWith('g1', 'friend', { role: 'collaborator' });
    expect(view.changed).toHaveBeenCalledTimes(1);
    expect(view.notices.said).toContain('Role updated');
  });

  it('invites by email and clears the field', async () => {
    const api = { invite: vi.fn().mockResolvedValue({}) };
    const view = await render('owner', api);
    const section = view.fixture.componentInstance;
    section.inviteEmail = 'new@example.com';
    section.inviteRole = 'viewer';
    await section.invite();
    expect(api.invite).toHaveBeenCalledWith('g1', { email: 'new@example.com', role: 'viewer' });
    expect(section.inviteEmail).toBe('');
    expect(view.changed).toHaveBeenCalledTimes(1);
    expect(view.notices.said).toContain('Member invited');
  });

  it('says what the server said when a change is refused', async () => {
    const refused = new HttpErrorResponse({
      status: 404,
      error: { error: { message: 'No account with that email' } },
    });
    const view = await render('owner', { invite: vi.fn().mockRejectedValue(refused) });
    view.fixture.componentInstance.inviteEmail = 'nobody@example.com';
    await view.fixture.componentInstance.invite();
    expect(view.notices.said).toContain('No account with that email');
    expect(view.changed).not.toHaveBeenCalled();
  });

  it('shows collaborators and viewers the list only', async () => {
    for (const role of ['collaborator', 'viewer'] as const) {
      const view = await render(role);
      expect(view.el.querySelectorAll('li')).toHaveLength(2);
      expect(view.el.querySelectorAll('button')).toHaveLength(0);
      expect(view.el.querySelector('form')).toBeNull();
      TestBed.resetTestingModule();
    }
  });
});
