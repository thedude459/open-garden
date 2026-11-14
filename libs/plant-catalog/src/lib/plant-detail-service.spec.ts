import { describe, expect, it, vi } from 'vitest';
import { PlantDetailService } from './plant-detail-service';

describe('PlantDetailService', () => {
  it('returns null when plant missing', async () => {
    const plants = { getById: vi.fn().mockResolvedValue(null) };
    const favorites = { isFavorite: vi.fn() };
    const svc = new PlantDetailService(plants as never, favorites as never);
    await expect(svc.getById('missing', 'user-1')).resolves.toBeNull();
    expect(favorites.isFavorite).not.toHaveBeenCalled();
  });

  it('maps row and favorite flag', async () => {
    const plants = {
      getById: vi.fn().mockResolvedValue({
        id: 'p1',
        commonName: 'Tomato',
        species: 'Solanum lycopersicum',
        cultivar: null,
        plantType: 'vegetable',
        zoneMin: 5,
        zoneMax: 10,
        sunRequirements: 'full',
        waterNeeds: 'medium',
        daysToMaturity: 70,
        spacingInches: 24,
        status: 'active',
        indoorFrostAnchor: 'last',
        indoorWeeksEarliest: -8,
        indoorWeeksLatest: -6,
        sowFrostAnchor: null,
        sowWeeksEarliest: null,
        sowWeeksLatest: null,
        transplantFrostAnchor: 'last',
        transplantWeeksEarliest: 1,
        transplantWeeksLatest: 2,
        growMinC: 10,
        growMaxC: 35,
        sowSoilMinC: 16,
        kcInitial: 0.6,
        kcMid: 1.15,
        kcEnd: 0.8,
        stageDaysInitial: 35,
        stageDaysDevelopment: 40,
        stageDaysMid: 50,
        stageDaysLate: 30,
      }),
    };
    const favorites = { isFavorite: vi.fn().mockResolvedValue(true) };
    const svc = new PlantDetailService(plants as never, favorites as never);
    const detail = await svc.getById('p1', 'user-1');
    expect(detail?.isFavorite).toBe(true);
    expect(detail?.commonName).toBe('Tomato');
    expect(detail?.growingGuidance.indoorStart).toEqual({
      frostAnchor: 'last',
      weeksEarliest: -8,
      weeksLatest: -6,
    });
    expect(detail?.growingGuidance.outdoorSow).toBeNull();
    expect(detail?.sowingTemperature).toEqual({ minC: 10, maxC: 35, minSoilC: 16 });
    expect(detail?.cropCoefficients).toEqual({
      initial: 0.6,
      mid: 1.15,
      end: 0.8,
      stageDays: { initial: 35, development: 40, mid: 50, late: 30 },
    });
  });

  it('gives crop coefficients without stages, and none without coefficients', async () => {
    const row = {
      id: 'm',
      commonName: 'Mint',
      status: 'active',
      kcInitial: 0.6,
      kcMid: 1.15,
      kcEnd: 1.1,
    };
    const favorites = { isFavorite: vi.fn().mockResolvedValue(false) };
    const mint = await new PlantDetailService(
      { getById: vi.fn().mockResolvedValue(row) } as never,
      favorites as never,
    ).getById('m', 'u');
    expect(mint?.cropCoefficients).toEqual({ initial: 0.6, mid: 1.15, end: 1.1, stageDays: null });
    const basil = await new PlantDetailService(
      { getById: vi.fn().mockResolvedValue({ ...row, kcMid: null }) } as never,
      favorites as never,
    ).getById('m', 'u');
    expect(basil?.cropCoefficients).toBeNull();
  });

  it('lists the crop’s companion pairs, nearest the member’s property zones first', async () => {
    const pairAt = (name: string, zone: number) => ({
      cropId: name.toLowerCase(),
      name,
      kind: 'helps' as const,
      benefits: ['deters-pests' as const],
      evidence: 'research' as const,
      reason: 'x',
      reference: null,
      shownIn: [{ where: 'Somewhere', zones: { min: zone, max: zone } }],
      fromCropId: 'tomato',
    });
    const listForCrops = vi.fn().mockResolvedValue([pairAt('Basil', 9), pairAt('Marigold', 5)]);
    const svc = new PlantDetailService(
      {
        getById: vi.fn().mockResolvedValue({ id: 't', status: 'active', cropId: 'tomato' }),
      } as never,
      { isFavorite: vi.fn().mockResolvedValue(false) } as never,
      { pairs: { listForCrops }, zonesForUser: vi.fn().mockResolvedValue([6, 4]) },
    );
    const detail = await svc.getById('t', 'u');
    expect(listForCrops).toHaveBeenCalledWith(['tomato']);
    expect(detail?.companions.map((c) => c.name)).toEqual(['Marigold', 'Basil']);
    expect(detail?.companions[0]).not.toHaveProperty('fromCropId');
    expect(detail?.companionZones).toEqual([4, 6]);

    // A plant outside the dataset has no crop, so no pairs.
    const custom = await new PlantDetailService(
      { getById: vi.fn().mockResolvedValue({ id: 'c', status: 'active', cropId: null }) } as never,
      { isFavorite: vi.fn().mockResolvedValue(false) } as never,
      { pairs: { listForCrops }, zonesForUser: vi.fn() },
    ).getById('c', 'u');
    expect(custom).toMatchObject({ companions: [], companionZones: [] });
  });

  it('returns leftover null spacing on getById', async () => {
    const plants = {
      getById: vi.fn().mockResolvedValue({
        id: 'old',
        commonName: 'Heirloom',
        species: 'Unknown',
        cultivar: null,
        plantType: 'vegetable',
        zoneMin: 5,
        zoneMax: 10,
        sunRequirements: null,
        waterNeeds: null,
        daysToMaturity: null,
        spacingInches: null,
        status: 'active',
        indoorFrostAnchor: null,
        indoorWeeksEarliest: null,
        indoorWeeksLatest: null,
        sowFrostAnchor: null,
        sowWeeksEarliest: null,
        sowWeeksLatest: null,
        transplantFrostAnchor: null,
        transplantWeeksEarliest: null,
        transplantWeeksLatest: null,
      }),
    };
    const favorites = { isFavorite: vi.fn().mockResolvedValue(false) };
    const svc = new PlantDetailService(plants as never, favorites as never);
    const detail = await svc.getById('old', 'user-1');
    expect(detail?.spacingInches).toBeNull();
    expect(detail?.commonName).toBe('Heirloom');
  });
});
