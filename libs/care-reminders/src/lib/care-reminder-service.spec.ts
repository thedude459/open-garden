import { describe, expect, it } from 'vitest';
import { createReminderMemory } from './test-memory';

describe('CareReminderService', () => {
  it('requires valid asOf', async () => {
    const mem = createReminderMemory();
    await expect(mem.service.list(mem.gardenId, mem.ownerId, 'bad')).rejects.toMatchObject({
      message: 'Date must be YYYY-MM-DD',
    });
  });

  it('allows viewer to list', async () => {
    const mem = createReminderMemory();
    const list = await mem.service.list(mem.gardenId, mem.viewerId, '2026-08-17');
    expect(list.myRole).toBe('viewer');
  });

  it('non-member gets garden not found', async () => {
    const mem = createReminderMemory();
    await expect(mem.service.list(mem.gardenId, mem.strangerId, '2026-08-17')).rejects.toMatchObject({
      message: 'Garden not found',
    });
  });

  it('empty plantings returns empty items', async () => {
    const mem = createReminderMemory();
    const list = await mem.service.list(mem.gardenId, mem.ownerId, '2026-08-17');
    expect(list.items).toEqual([]);
  });

  it('deprecated variety still labeled', async () => {
    const mem = createReminderMemory();
    mem.addPlanting({
      id: 'maple-1',
      plantId: 'plant-maple',
      plantedOn: '2026-01-01',
    });
    const list = await mem.service.list(mem.gardenId, mem.ownerId, '2026-06-01');
    expect(list.items[0]?.status).toBe('deprecated');
  });

  it('viewer cannot complete or dismiss', async () => {
    const mem = createReminderMemory();
    const planting = mem.addPlanting({ id: 'p1', plantId: 'plant-tomato', plantedOn: '2026-01-01' });
    await expect(
      mem.service.complete(mem.gardenId, mem.viewerId, planting.id, 'harvest', '2026-03-02'),
    ).rejects.toMatchObject({ message: 'Viewers cannot update reminders' });
  });

  it('non-member cannot mutate', async () => {
    const mem = createReminderMemory();
    const planting = mem.addPlanting({ id: 'p1', plantId: 'plant-tomato', plantedOn: '2026-01-01' });
    await expect(
      mem.service.complete(mem.gardenId, mem.strangerId, planting.id, 'harvest', '2026-03-02'),
    ).rejects.toMatchObject({ message: 'Garden not found' });
  });

  it('planting in other garden is not found', async () => {
    const mem = createReminderMemory();
    const other = mem.addPlanting({
      id: 'other-p',
      gardenId: mem.otherGardenId,
      plantId: 'plant-tomato',
      plantedOn: '2026-01-01',
    });
    await expect(
      mem.service.complete(mem.gardenId, mem.ownerId, other.id, 'harvest', '2026-03-02'),
    ).rejects.toMatchObject({ message: 'Planting not found' });
  });

  it('harvest complete does not change planting dates', async () => {
    const mem = createReminderMemory();
    const planting = mem.addPlanting({
      id: 'p1',
      plantId: 'plant-tomato',
      plantedOn: '2026-01-01',
      harvestedOn: null,
    });
    await mem.service.complete(mem.gardenId, mem.ownerId, planting.id, 'harvest', '2026-03-02');
    expect(mem.getPlanting(mem.gardenId, planting.id)?.harvestedOn).toBeNull();
  });

  it('last upsert wins on same occurrence key', async () => {
    const mem = createReminderMemory();
    const planting = mem.addPlanting({ id: 'p1', plantId: 'plant-tomato', plantedOn: '2026-01-01' });
    await mem.service.complete(mem.gardenId, mem.ownerId, planting.id, 'harvest', '2026-03-02');
    await mem.service.dismiss(mem.gardenId, mem.ownerId, planting.id, 'harvest', '2026-03-02');
    expect(mem.getEvent(planting.id, 'harvest', '2026-03-02')?.action).toBe('dismissed');
  });

  it('complete on deprecated variety succeeds', async () => {
    const mem = createReminderMemory();
    const planting = mem.addPlanting({
      id: 'maple-1',
      plantId: 'plant-maple',
      plantedOn: '2026-01-01',
    });
    await mem.service.complete(mem.gardenId, mem.ownerId, planting.id, 'harvest', '2027-01-01');
    const list = await mem.service.list(mem.gardenId, mem.ownerId, '2026-06-01');
    expect(list.items.some((i) => i.kind === 'harvest')).toBe(false);
  });

  it('list after planting delete omits reminders', async () => {
    const mem = createReminderMemory();
    const planting = mem.addPlanting({ id: 'p1', plantId: 'plant-tomato', plantedOn: '2026-01-01' });
    let list = await mem.service.list(mem.gardenId, mem.ownerId, '2026-08-17');
    expect(list.items.some((i) => i.plantingId === planting.id)).toBe(true);
    mem.deletePlanting(mem.gardenId, planting.id);
    list = await mem.service.list(mem.gardenId, mem.ownerId, '2026-08-17');
    expect(list.items.some((i) => i.plantingId === planting.id)).toBe(false);
  });
});
