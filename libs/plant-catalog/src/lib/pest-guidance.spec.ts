import { describe, expect, it } from 'vitest';
import type { CatalogPestDto, PestRegionDto } from '@open-garden/shared-types';
import { pestsForPlaces } from './pest-guidance';

const none = { cultural: [], physical: [], biological: [], organic: [], conventional: [] };
const region = (where: string, country: string, min: number, max: number): PestRegionDto => ({
  where,
  country,
  zones: { min, max },
  when: `Look in ${where}`,
  threshold: null,
  controls: { ...none, organic: [`Spray in ${where}`] },
  reference: `Guide for ${where}`,
});
const pest = (
  id: string,
  regions: PestRegionDto[],
  occursIn: string[] | null = null,
): CatalogPestDto => ({
  id,
  name: id,
  aliases: [],
  scientificName: null,
  kind: 'insect',
  crops: ['potato'],
  signs: 'Holes',
  scoutStages: ['seedling'],
  controls: { ...none, physical: ['Hand-pick'] },
  occursIn,
  regions,
});

const minnesota = region('Minnesota, USA', 'US', 3, 5);
const california = region('California, USA', 'US', 5, 11);
const beetle = pest('colorado-potato-beetle', [minnesota], ['US', 'CA', 'DE']);

describe('pestsForPlaces', () => {
  it('leaves out a pest whose known countries include none of the member’s', () => {
    expect(pestsForPlaces([beetle], [{ country: 'IE', zone: 8 }])).toEqual([]);
  });

  it('keeps a pest whose countries are not known', () => {
    const aphids = pest('aphids', [minnesota]);
    expect(pestsForPlaces([aphids], [{ country: 'IE', zone: 8 }]).map((p) => p.id)).toEqual([
      'aphids',
    ]);
  });

  it('gives guidance from the member’s country, nearest their zones', () => {
    const both = pest('septoria', [minnesota, california]);
    const [shown] = pestsForPlaces([both], [{ country: 'US', zone: 9 }]);
    expect(shown?.regionMatch).toBe('country');
    expect(shown?.region?.where).toBe('California, USA');
    expect(pestsForPlaces([both], [{ country: 'US', zone: 4 }])[0]?.region?.where).toBe(
      'Minnesota, USA',
    );
  });

  it('shows no timing or products from another country', () => {
    const [shown] = pestsForPlaces([pest('aphids', [minnesota])], [{ country: 'GB', zone: 8 }]);
    expect(shown?.regionMatch).toBe('none');
    expect(shown?.region).toBeNull();
    expect(shown?.controls.physical).toEqual(['Hand-pick']);
  });

  it('falls back to the nearest region, labelled, when no property’s country is known', () => {
    const both = pest('septoria', [minnesota, california]);
    const [shown] = pestsForPlaces([both], [{ country: null, zone: 10 }]);
    expect(shown).toMatchObject({ regionMatch: 'nearest', region: { where: 'California, USA' } });
    // A member with no properties sees the first region and every pest.
    expect(pestsForPlaces([beetle], [])[0]).toMatchObject({ regionMatch: 'nearest' });
  });

  it('prefers a known country over a property whose country is unknown', () => {
    const [shown] = pestsForPlaces(
      [pest('aphids', [minnesota])],
      [
        { country: 'US', zone: 4 },
        { country: null, zone: 9 },
      ],
    );
    expect(shown?.regionMatch).toBe('country');
  });
});
