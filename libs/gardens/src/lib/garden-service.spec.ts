import { describe, expect, it } from 'vitest';
import { createGardenMemory } from './test-memory';

describe('GardenService', () => {
  it('rejects blank or whitespace-only names', async () => {
    const { service, ownerId } = createGardenMemory();
    await expect(service.create(ownerId, { name: '   ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects names longer than 120 characters', async () => {
    const { service, ownerId } = createGardenMemory();
    await expect(service.create(ownerId, { name: 'x'.repeat(121) })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('creates an owned garden and lists it', async () => {
    const { service, ownerId } = createGardenMemory();
    const created = await service.create(ownerId, { name: 'Backyard', notes: 'South fence' });
    expect(created.myRole).toBe('owner');
    expect(created.members).toHaveLength(1);
    const page = await service.list(ownerId);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.name).toBe('Backyard');
  });

  it('enforces owner-scoped case-insensitive uniqueness', async () => {
    const { service, ownerId } = createGardenMemory();
    await service.create(ownerId, { name: 'Backyard' });
    await expect(service.create(ownerId, { name: ' backyard ' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('hides gardens from non-members', async () => {
    const { service, ownerId, strangerId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard' });
    const page = await service.list(strangerId);
    expect(page.totalCount).toBe(0);
    await expect(service.get(strangerId, garden.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps the last successful patch (last-write-wins)', async () => {
    const { service, ownerId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Backyard', notes: 'a' });
    await service.patch(ownerId, garden.id, { notes: 'first' });
    const second = await service.patch(ownerId, garden.id, { notes: 'second' });
    expect(second.notes).toBe('second');
    const loaded = await service.get(ownerId, garden.id);
    expect(loaded.notes).toBe('second');
  });

  it('hard-deletes a garden so the owner can reuse the name', async () => {
    const { service, ownerId } = createGardenMemory();
    const garden = await service.create(ownerId, { name: 'Front yard' });
    await service.remove(ownerId, garden.id);
    await expect(service.get(ownerId, garden.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const again = await service.create(ownerId, { name: 'Front yard' });
    expect(again.name).toBe('Front yard');
  });

  it('rejects collaborator rename that collides with the owner’s other garden', async () => {
    const { service, ownerId, friendId, memberships } = createGardenMemory();
    const backyard = await service.create(ownerId, { name: 'Backyard' });
    await service.create(ownerId, { name: 'Front yard' });
    await memberships.insert(backyard.id, friendId, 'collaborator');
    await expect(
      service.patch(friendId, backyard.id, { name: 'Front yard' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects reversed frost dates on create', async () => {
    const { service, ownerId } = createGardenMemory();
    await expect(
      service.create(ownerId, {
        name: 'Frosty',
        lastFrost: { month: 10, day: 20 },
        firstFrost: { month: 4, day: 15 },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
