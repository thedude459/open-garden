import { describe, expect, it } from 'vitest';
import { createGardenMemory } from './test-memory';

describe('MembershipService', () => {
  it('invites an existing account and lists members for every role', async () => {
    const { service, membershipService, ownerId, friendId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard' });
    const invited = await membershipService.invite(ownerId, garden.id, {
      email: 'friend@example.com',
      role: 'collaborator',
    });
    expect(invited.userId).toBe(friendId);
    const { members } = await membershipService.list(friendId, garden.id);
    expect(members.map((m) => m.email).sort()).toEqual([
      'friend@example.com',
      'gardener@example.com',
    ]);
  });

  it('rejects unknown email, self-invite, and duplicate members', async () => {
    const { service, membershipService, ownerId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard' });
    await expect(
      membershipService.invite(ownerId, garden.id, {
        email: 'nobody@example.com',
        role: 'viewer',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      membershipService.invite(ownerId, garden.id, {
        email: 'gardener@example.com',
        role: 'collaborator',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await membershipService.invite(ownerId, garden.id, {
      email: 'friend@example.com',
      role: 'collaborator',
    });
    await expect(
      membershipService.invite(ownerId, garden.id, {
        email: 'friend@example.com',
        role: 'viewer',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('lets collaborators edit but not invite or delete', async () => {
    const { service, membershipService, ownerId, friendId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard' });
    await membershipService.invite(ownerId, garden.id, {
      email: 'friend@example.com',
      role: 'collaborator',
    });
    const patched = await service.patch(friendId, garden.id, { notes: 'ok' });
    expect(patched.notes).toBe('ok');
    await expect(
      membershipService.invite(friendId, garden.id, {
        email: 'stranger@example.com',
        role: 'viewer',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.remove(friendId, garden.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('prevents the last owner from leaving and transfers ownership', async () => {
    const { service, membershipService, ownerId, friendId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard' });
    await membershipService.invite(ownerId, garden.id, {
      email: 'friend@example.com',
      role: 'collaborator',
    });
    await expect(
      membershipService.removeMember(ownerId, garden.id, ownerId),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const transferred = await membershipService.patchMember(ownerId, garden.id, friendId, {
      role: 'owner',
    });
    expect(transferred.role).toBe('owner');
    const detail = await service.get(friendId, garden.id);
    expect(detail.ownerUserId).toBe(friendId);
    expect(detail.myRole).toBe('owner');
  });

  it('rejects transfer when the new owner already owns the same name', async () => {
    const { service, membershipService, ownerId, friendId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard' });
    await service.create(friendId, { name: 'Backyard' });
    await membershipService.invite(ownerId, garden.id, {
      email: 'friend@example.com',
      role: 'collaborator',
    });
    await expect(
      membershipService.patchMember(ownerId, garden.id, friendId, { role: 'owner' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('hides member lists from non-members', async () => {
    const { service, membershipService, ownerId, strangerId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard' });
    await expect(membershipService.list(strangerId, garden.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('lets a collaborator leave and the owner remove them', async () => {
    const { service, membershipService, ownerId, friendId, strangerId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard' });
    await membershipService.invite(ownerId, garden.id, {
      email: 'friend@example.com',
      role: 'collaborator',
    });
    await membershipService.invite(ownerId, garden.id, {
      email: 'stranger@example.com',
      role: 'viewer',
    });
    await expect(
      membershipService.removeMember(friendId, garden.id, strangerId),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await membershipService.removeMember(friendId, garden.id, friendId);
    await expect(service.get(friendId, garden.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await membershipService.removeMember(ownerId, garden.id, strangerId);
    await expect(service.get(strangerId, garden.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
