import type { SoilTestCreateDto, SoilTestDto, SoilTestOwner } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { SoilTestService } from './soil-tests';

const test: SoilTestCreateDto = {
  testedOn: '2026-03-01',
  lab: 'State lab',
  ph: 7.2,
  organicMatterPct: 2,
  nitrogen: null,
  phosphorus: 'low',
  potassium: 'high',
  recommendations: null,
};

const owns = (t: SoilTestDto, owner: SoilTestOwner) =>
  'bedId' in owner ? t.bedId === owner.bedId : t.areaId === owner.areaId;

function setup() {
  const roles: Record<string, string> = { owner: 'owner', viewer: 'viewer' };
  const areas: Record<string, string> = { veg: 'vegetable', glass: 'greenhouse' };
  const stored: SoilTestDto[] = [];
  const service = new SoilTestService(
    {
      get: async (_gardenId, userId) => (roles[userId] ? ({ role: roles[userId] } as never) : null),
    },
    {
      getInGarden: async (gardenId, id) =>
        gardenId === 'g' && areas[id] ? ({ kind: areas[id] } as never) : null,
    },
    {
      getInGarden: async (gardenId, id) =>
        gardenId === 'g' && id === 'bed' ? ({} as never) : null,
    },
    {
      insert: async (owner, input) => {
        const row = {
          id: `t${stored.length}`,
          areaId: 'areaId' in owner ? owner.areaId : null,
          bedId: 'bedId' in owner ? owner.bedId : null,
          ...input,
        };
        stored.push(row);
        return row;
      },
      delete: async (owner, id) => {
        const at = stored.findIndex((t) => owns(t, owner) && t.id === id);
        if (at < 0) return false;
        stored.splice(at, 1);
        return true;
      },
      latestFor: async (owner) => stored.filter((t) => owns(t, owner)).at(-1) ?? null,
    },
    () => new Date('2026-06-01T12:00:00Z'),
  );
  return { service, stored };
}

describe('SoilTestService', () => {
  it('records tests on an area and on a bed, and deletes one, returning the latest left', async () => {
    const { service, stored } = setup();
    const area = await service.record('owner', 'g', { areaId: 'veg' }, test);
    expect(area).toMatchObject({ areaId: 'veg', bedId: null, ph: 7.2 });
    const earlier = await service.record(
      'owner',
      'g',
      { bedId: 'bed' },
      { ...test, testedOn: '2025-03-01' },
    );
    const saved = await service.record('owner', 'g', { bedId: 'bed' }, test);
    expect(await service.remove('owner', 'g', { bedId: 'bed' }, saved.id)).toEqual({
      latest: earlier,
    });
    expect(stored).toEqual([area, earlier]);
    await expect(service.remove('owner', 'g', { areaId: 'veg' }, earlier.id)).rejects.toMatchObject(
      {
        code: 'NOT_FOUND',
      },
    );
  });

  it('refuses viewers, non-members, another property’s bed or area, a greenhouse, and future dates', async () => {
    const { service } = setup();
    await expect(service.record('viewer', 'g', { bedId: 'bed' }, test)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(service.record('stranger', 'g', { bedId: 'bed' }, test)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.record('owner', 'other', { bedId: 'bed' }, test)).rejects.toMatchObject({
      message: 'Bed not found',
    });
    await expect(service.record('owner', 'other', { areaId: 'veg' }, test)).rejects.toMatchObject({
      message: 'Area not found',
    });
    await expect(service.record('owner', 'g', { areaId: 'glass' }, test)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(
      service.record('owner', 'g', { bedId: 'bed' }, { ...test, testedOn: '2026-06-03' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    // A day ahead is allowed: the lab may be in a time zone ahead of UTC.
    await expect(
      service.record('owner', 'g', { bedId: 'bed' }, { ...test, testedOn: '2026-06-02' }),
    ).resolves.toBeTruthy();
  });
});
