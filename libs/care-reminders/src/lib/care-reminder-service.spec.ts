import { describe, expect, it } from 'vitest';
import { createReminderMemory } from './test-memory';

import { CareReminderService } from './care-reminder-service';
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
    await expect(
      mem.service.list(mem.gardenId, mem.strangerId, '2026-08-17'),
    ).rejects.toMatchObject({
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
    const planting = mem.addPlanting({
      id: 'p1',
      plantId: 'plant-tomato',
      plantedOn: '2026-01-01',
    });
    await expect(
      mem.service.complete(mem.gardenId, mem.viewerId, planting.id, 'harvest', '2026-03-02'),
    ).rejects.toMatchObject({ message: 'Viewers cannot update reminders' });
  });

  it('non-member cannot mutate', async () => {
    const mem = createReminderMemory();
    const planting = mem.addPlanting({
      id: 'p1',
      plantId: 'plant-tomato',
      plantedOn: '2026-01-01',
    });
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
    const planting = mem.addPlanting({
      id: 'p1',
      plantId: 'plant-tomato',
      plantedOn: '2026-01-01',
    });
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
    const planting = mem.addPlanting({
      id: 'p1',
      plantId: 'plant-tomato',
      plantedOn: '2026-01-01',
    });
    let list = await mem.service.list(mem.gardenId, mem.ownerId, '2026-08-17');
    expect(list.items.some((i) => i.plantingId === planting.id)).toBe(true);
    mem.deletePlanting(mem.gardenId, planting.id);
    list = await mem.service.list(mem.gardenId, mem.ownerId, '2026-08-17');
    expect(list.items.some((i) => i.plantingId === planting.id)).toBe(false);
  });
});

describe('CareReminderService weather', () => {
  const row = {
    id: 'p1',
    plantId: 'tomato',
    commonName: 'Tomato',
    species: 'Solanum lycopersicum',
    cultivar: null,
    plantType: 'vegetable',
    status: 'active',
    plantedOn: '2026-06-01',
    harvestedOn: null,
    daysToMaturity: null,
    waterIntervalDays: 3,
    fertilizeIntervalDays: null,
    bedId: 'b1',
    bedName: 'North',
    life: 'annual',
    bedSun: 'full',
    bedMulch: 'none',
    kcInitial: 1,
    kcMid: 1,
    kcEnd: 1,
    stageDaysInitial: null,
    stageDaysDevelopment: null,
    stageDaysMid: null,
    stageDaysLate: null,
  };
  const days: Record<string, { et0Mm: number; rainMm: number }> = {};
  for (let d = 1; d <= 14; d++) {
    days[`2026-06-${String(d).padStart(2, '0')}`] = { et0Mm: 5, rainMm: d === 8 ? 4 : 0 };
  }
  const service = (weather: () => Promise<typeof days | null>) =>
    new CareReminderService(
      { getMembership: async () => ({ role: 'owner' }) },
      { listAllForReminders: async () => [row], getInGarden: async () => ({ id: 'p1' }) },
      { listForGarden: async () => [], upsert: async () => undefined },
      weather,
    );

  it('waters by the water balance and covers a rainy due day', async () => {
    const listed = await service(async () => days).list('g', 'u', '2026-06-03');
    expect(listed.outlookOn).toBe('2026-06-03');
    // 5 mm a day: 25 mm on 6 June.
    expect(listed.items).toEqual([
      expect.objectContaining({
        kind: 'water',
        dueOn: '2026-06-06',
        deficitMm: 25,
        required: true,
      }),
    ]);
  });

  it('falls back to the fixed interval when the weather cannot be read', async () => {
    for (const weather of [async () => null, async () => Promise.reject(new Error('down'))]) {
      const listed = await service(weather).list('g', 'u', '2026-06-03');
      expect(listed.outlookOn).toBeNull();
      expect(listed.items[0]).toMatchObject({ kind: 'water', intervalDays: 3 });
    }
  });
});
