import type { PlantDetailDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { withCompanionDefaults } from './cached-detail';

describe('withCompanionDefaults', () => {
  it('gives a detail cached before companion pairs empty lists', () => {
    const old = { id: 'basil', commonName: 'Basil' } as PlantDetailDto;
    expect(withCompanionDefaults(old)).toMatchObject({ companions: [], companionZones: [] });
  });

  it('keeps the pairs and zones of a current detail', () => {
    const current = {
      id: 'basil',
      companions: [{ plantId: 'tomato' }],
      companionZones: [6],
    } as unknown as PlantDetailDto;
    expect(withCompanionDefaults(current)).toMatchObject({
      companions: [{ plantId: 'tomato' }],
      companionZones: [6],
    });
  });
});
