import { describe, expect, it } from 'vitest';
import { buildVarietyKey } from '@open-garden/plant-catalog';
import type { ProviderPlant } from '@open-garden/plant-provider';
import { mergeCatalogRecords } from './merge';
import { samplePlant } from './test-memory';

function plant(overrides: Partial<ProviderPlant>): ProviderPlant {
  return samplePlant(overrides);
}

describe('mergeCatalogRecords', () => {
  it('merges a controlled pair into exactly 30 keys (10 overlap + 10 unique each)', () => {
    const aOverlap = Array.from({ length: 10 }, (_, i) =>
      plant({
        externalId: `a-o-${i}`,
        commonName: `Overlap ${i}`,
        species: `Overlap species ${i}`,
        waterNeeds: 'Low',
        daysToMaturity: 10,
        sunRequirements: null,
      }),
    );
    const aUnique = Array.from({ length: 10 }, (_, i) =>
      plant({
        externalId: `a-u-${i}`,
        commonName: `Alpha ${i}`,
        species: `Alpha species ${i}`,
      }),
    );
    const bOverlap = Array.from({ length: 10 }, (_, i) =>
      plant({
        externalId: `b-o-${i}`,
        commonName: `Overlap ${i}`,
        species: `Overlap species ${i}`,
        waterNeeds: 'High',
        daysToMaturity: 99,
        sunRequirements: 'Part shade',
      }),
    );
    const bUnique = Array.from({ length: 10 }, (_, i) =>
      plant({
        externalId: `b-u-${i}`,
        commonName: `Bravo ${i}`,
        species: `Bravo species ${i}`,
      }),
    );

    const result = mergeCatalogRecords(
      [
        { sourceId: 'a', plants: [...aOverlap, ...aUnique] },
        { sourceId: 'b', plants: [...bOverlap, ...bUnique] },
      ],
      ['a', 'b'],
    );

    expect(result.merged).toHaveLength(30);
    const overlap = result.merged.filter((row) => row.commonName.startsWith('Overlap'));
    expect(overlap).toHaveLength(10);
    for (const row of overlap) {
      expect(row.waterNeeds).toBe('High');
      expect(row.daysToMaturity).toBe(99);
      expect(row.sunRequirements).toBe('Part shade');
      expect(row.fieldWinners['waterNeeds']).toBe('b');
      expect(row.fieldWinners['sunRequirements']).toBe('b');
      expect(row.contributingSources).toEqual(['a', 'b']);
    }
    expect(result.merged.filter((row) => row.commonName.startsWith('Alpha'))).toHaveLength(10);
    expect(result.merged.filter((row) => row.commonName.startsWith('Bravo'))).toHaveLength(10);
  });

  it('fills blanks from earlier sources when the last value is null', () => {
    const result = mergeCatalogRecords(
      [
        {
          sourceId: 'a',
          plants: [plant({ waterNeeds: 'Moderate', sunRequirements: 'Full sun' })],
        },
        {
          sourceId: 'b',
          plants: [
            plant({
              waterNeeds: null,
              sunRequirements: 'Part shade',
              externalId: 'b1',
            }),
          ],
        },
      ],
      ['a', 'b'],
    );
    expect(result.merged).toHaveLength(1);
    expect(result.merged[0]?.waterNeeds).toBe('Moderate');
    expect(result.merged[0]?.sunRequirements).toBe('Part shade');
    expect(result.merged[0]?.fieldWinners['waterNeeds']).toBe('a');
    expect(result.merged[0]?.fieldWinners['sunRequirements']).toBe('b');
  });

  it('skips invalid identity and never invents missing attributes', () => {
    const result = mergeCatalogRecords(
      [
        {
          sourceId: 'a',
          plants: [
            plant({ commonName: '', species: 'Nope' }),
            plant({ commonName: 'Ok', species: 'Ok species', sunRequirements: null, waterNeeds: null }),
          ],
        },
      ],
      ['a'],
    );
    expect(result.rejected).toBe(1);
    expect(result.merged).toHaveLength(1);
    const row = result.merged[0]!;
    expect(row.sunRequirements).toBeNull();
    expect(row.waterNeeds).toBeNull();
    expect(row.zoneMin).toBe(4);
    expect(Object.values(row).every((value) => value !== undefined)).toBe(true);
  });

  it('SC-003: at least 95% of valid records have required attributes populated or explicitly null', () => {
    const plants = Array.from({ length: 20 }, (_, i) =>
      plant({
        externalId: `n-${i}`,
        commonName: `Named ${i}`,
        species: `Named species ${i}`,
        sunRequirements: i % 2 === 0 ? 'Full sun' : null,
        waterNeeds: i % 3 === 0 ? null : 'Low',
      }),
    );
    const result = mergeCatalogRecords([{ sourceId: 'a', plants }], ['a']);
    const valid = plants.filter((p) => p.commonName.trim() && p.species.trim());
    expect(result.merged.length / valid.length).toBeGreaterThanOrEqual(0.95);
    for (const row of result.merged) {
      expect(row.commonName.length).toBeGreaterThan(0);
      expect(row.species.length).toBeGreaterThan(0);
      expect(row.plantType).toBeTruthy();
      expect(row.zoneMin).toEqual(expect.any(Number));
      expect(row.zoneMax).toEqual(expect.any(Number));
      expect(row.sunRequirements === null || typeof row.sunRequirements === 'string').toBe(true);
      expect(row.waterNeeds === null || typeof row.waterNeeds === 'string').toBe(true);
    }
    expect(result.merged[0]?.varietyKey).toBe(
      buildVarietyKey(plants[0]!.species, plants[0]!.cultivar),
    );
  });
});
