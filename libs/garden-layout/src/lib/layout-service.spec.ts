import { describe, expect, it } from 'vitest';
import { createLayoutMemory } from './test-memory';

describe('LayoutService beds', () => {
  it('lists unsized beds with null geometry and persists a beds-only PUT', async () => {
    const mem = createLayoutMemory();
    const a = mem.addBed('Raised bed 1');
    mem.addBed('Patio pots');
    const empty = await mem.service.get(mem.ownerId, mem.gardenId);
    expect(empty.beds).toHaveLength(2);
    expect(empty.beds.every((b) => b.geometry === null)).toBe(true);

    const saved = await mem.service.put(mem.ownerId, mem.gardenId, {
      beds: [
        {
          id: a.id,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 48,
          orientation: 0,
        },
      ],
      placements: [],
    });
    expect(saved.beds.find((b) => b.id === a.id)?.geometry?.lengthInches).toBe(96);
    expect(saved.beds.find((b) => b.name === 'Patio pots')?.geometry).toBeNull();
  });

  it('omitting a bed from PUT clears geometry but keeps the name', async () => {
    const mem = createLayoutMemory();
    const a = mem.addBed('East');
    await mem.service.put(mem.ownerId, mem.gardenId, {
      beds: [
        {
          id: a.id,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 48,
          widthInches: 24,
          orientation: 90,
        },
      ],
      placements: [],
    });
    const cleared = await mem.service.put(mem.ownerId, mem.gardenId, { beds: [], placements: [] });
    expect(cleared.beds[0]?.name).toBe('East');
    expect(cleared.beds[0]?.geometry).toBeNull();
  });

  it('last PUT wins and refuses viewers and non-members', async () => {
    const mem = createLayoutMemory();
    const a = mem.addBed('East');
    const body = {
      beds: [
        {
          id: a.id,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 40,
          widthInches: 20,
          orientation: 0 as const,
        },
      ],
      placements: [],
    };
    await mem.service.put(mem.ownerId, mem.gardenId, body);
    const later = await mem.service.put(mem.ownerId, mem.gardenId, {
      beds: [{ ...body.beds[0]!, lengthInches: 80 }],
      placements: [],
    });
    expect(later.beds[0]?.geometry?.lengthInches).toBe(80);
    await expect(mem.service.put(mem.viewerId, mem.gardenId, body)).rejects.toMatchObject({
      message: 'Viewers cannot update layout',
    });
    await expect(mem.service.get(mem.strangerId, mem.gardenId)).rejects.toMatchObject({
      message: 'Garden not found',
    });
  });
});

describe('LayoutService placements', () => {
  it('refuses a blocking spacing PUT and leaves the last valid snapshot', async () => {
    const mem = createLayoutMemory();
    const bed = mem.addBed('East');
    const a = mem.addPlanting(mem.tomato.id);
    const b = mem.addPlanting(mem.tomato.id);
    const valid = {
      beds: [
        {
          id: bed.id,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 48,
          orientation: 0 as const,
        },
      ],
      placements: [
        { plantingId: a.id, bedId: bed.id, xInches: 24, yInches: 24 },
        { plantingId: b.id, bedId: bed.id, xInches: 60, yInches: 24 },
      ],
    };
    await mem.service.put(mem.ownerId, mem.gardenId, valid);
    await expect(
      mem.service.put(mem.ownerId, mem.gardenId, {
        ...valid,
        placements: [
          { plantingId: a.id, bedId: bed.id, xInches: 20, yInches: 20 },
          { plantingId: b.id, bedId: bed.id, xInches: 30, yInches: 20 },
        ],
      }),
    ).rejects.toMatchObject({ message: 'Layout has spacing or fit problems', httpStatus: 422 });
    const after = await mem.service.get(mem.ownerId, mem.gardenId);
    expect(after.plantings.find((p) => p.id === a.id)?.placement?.xInches).toBe(24);
    expect(after.plantings.find((p) => p.id === b.id)?.placement?.xInches).toBe(60);
  });

  it('sets bedId on place, keeps bedId when omitted (unplace coords only), and treats same variety as two placements', async () => {
    const mem = createLayoutMemory();
    const bed = mem.addBed('East');
    const a = mem.addPlanting(mem.tomato.id);
    const b = mem.addPlanting(mem.tomato.id);
    const body = {
      beds: [
        {
          id: bed.id,
          originXInches: 0,
          originYInches: 0,
          lengthInches: 96,
          widthInches: 48,
          orientation: 0 as const,
        },
      ],
      placements: [
        { plantingId: a.id, bedId: bed.id, xInches: 24, yInches: 24 },
        { plantingId: b.id, bedId: bed.id, xInches: 60, yInches: 24 },
      ],
    };
    const placed = await mem.service.put(mem.ownerId, mem.gardenId, body);
    expect(placed.plantings.filter((p) => p.plantId === mem.tomato.id)).toHaveLength(2);
    expect(placed.plantings.every((p) => p.bedId === bed.id)).toBe(true);

    const unplaced = await mem.service.put(mem.ownerId, mem.gardenId, {
      beds: body.beds,
      placements: [body.placements[0]!],
    });
    const stillA = unplaced.plantings.find((p) => p.id === a.id);
    const stillB = unplaced.plantings.find((p) => p.id === b.id);
    expect(stillA?.bedId).toBe(bed.id);
    expect(stillA?.placement?.xInches).toBe(24);
    expect(stillB?.bedId).toBe(bed.id);
    expect(stillB?.placement).toBeNull();
  });
});
