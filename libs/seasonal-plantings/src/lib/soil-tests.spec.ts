import type { SoilTestCreateDto, SoilTestDto } from '@open-garden/shared-types';
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

function setup() {
  const roles: Record<string, string> = { owner: 'owner', viewer: 'viewer' };
  const stored: SoilTestDto[] = [];
  const service = new SoilTestService(
    {
      get: async (_gardenId, userId) => (roles[userId] ? ({ role: roles[userId] } as never) : null),
    },
    {
      getInGarden: async (gardenId, id) =>
        gardenId === 'g' && id === 'bed' ? ({} as never) : null,
    },
    {
      insert: async (bedId, input) => {
        const row = { id: `t${stored.length}`, bedId, ...input };
        stored.push(row);
        return row;
      },
      delete: async (bedId, id) => {
        const at = stored.findIndex((t) => t.bedId === bedId && t.id === id);
        if (at < 0) return false;
        stored.splice(at, 1);
        return true;
      },
      latestForBed: async (bedId) => stored.filter((t) => t.bedId === bedId).at(-1) ?? null,
    },
    () => new Date('2026-06-01T12:00:00Z'),
  );
  return { service, stored };
}

describe('SoilTestService', () => {
  it('records a test on a bed and deletes it', async () => {
    const { service, stored } = setup();
    const earlier = await service.record('owner', 'g', 'bed', { ...test, testedOn: '2025-03-01' });
    const saved = await service.record('owner', 'g', 'bed', test);
    expect(saved).toMatchObject({ bedId: 'bed', ph: 7.2 });
    expect(await service.remove('owner', 'g', 'bed', saved.id)).toEqual({ latest: earlier });
    expect(stored).toEqual([earlier]);
    await expect(service.remove('owner', 'g', 'bed', saved.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses viewers, non-members, beds of another property, and future dates', async () => {
    const { service } = setup();
    await expect(service.record('viewer', 'g', 'bed', test)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(service.record('stranger', 'g', 'bed', test)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(service.record('owner', 'other', 'bed', test)).rejects.toMatchObject({
      message: 'Bed not found',
    });
    await expect(
      service.record('owner', 'g', 'bed', { ...test, testedOn: '2026-06-03' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    // A day ahead is allowed: the lab may be in a time zone ahead of UTC.
    await expect(
      service.record('owner', 'g', 'bed', { ...test, testedOn: '2026-06-02' }),
    ).resolves.toBeTruthy();
  });
});
