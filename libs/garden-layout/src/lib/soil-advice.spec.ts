import type { SoilTestDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { placementNotes } from './placement-notes';
import { phAdvice, soilTestNotes, testForBed } from './soil-advice';

const test = (over: Partial<SoilTestDto> = {}): SoilTestDto => ({
  id: 't',
  areaId: null,
  bedId: 'north',
  testedOn: '2026-04-01',
  lab: null,
  ph: null,
  organicMatterPct: null,
  nitrogen: null,
  phosphorus: null,
  potassium: null,
  recommendations: null,
  ...over,
});

describe('phAdvice', () => {
  const blueberry = { min: 4.5, max: 5.5 };
  it('says which way to move a pH outside the crop’s range', () => {
    expect(phAdvice('Blueberry', 7.2, blueberry)).toBe(
      'Blueberry needs pH 4.5–5.5; the soil here tested 7.2: lower it with sulfur over a season',
    );
    expect(phAdvice('Tomato', 5.4, { min: 6.2, max: 6.8 })).toBe(
      'Tomato needs pH 6.2–6.8; the soil here tested 5.4: raise it with lime',
    );
  });

  it('is quiet inside the range, on its edges, or without a test or range', () => {
    expect(phAdvice('Blueberry', 5.5, blueberry)).toBeNull();
    expect(phAdvice('Blueberry', 4.5, blueberry)).toBeNull();
    expect(phAdvice('Blueberry', null, blueberry)).toBeNull();
    expect(phAdvice('Blueberry', 7, null)).toBeNull();
  });
});

describe('soilTestNotes', () => {
  it('suggests compost for low organic matter and the lab for low nutrients', () => {
    expect(
      soilTestNotes(
        test({ organicMatterPct: 2.1, nitrogen: 'low', phosphorus: 'low', potassium: 'low' }),
        '2026-06-01',
      ),
    ).toEqual([
      'Organic matter is 2.1%: work in compost each year to raise it toward 3–5%.',
      'Nitrogen, Phosphorus and Potassium are low: ask the lab or your extension office how much to add.',
    ]);
    expect(
      soilTestNotes(test({ phosphorus: 'low', recommendations: 'Add bone meal' }), '2026-06-01'),
    ).toEqual(['Phosphorus is low: follow the lab’s recommendation.']);
  });

  it('asks for a new test after three years, and says nothing for a good recent test', () => {
    expect(soilTestNotes(test({ testedOn: '2023-03-01' }), '2026-06-01')).toEqual([
      'Tested 3 years ago: soil changes, so test again every 2–3 years.',
    ]);
    expect(
      soilTestNotes(
        test({ organicMatterPct: 4, phosphorus: 'medium', potassium: 'high' }),
        '2026-06-01',
      ),
    ).toEqual([]);
  });
});

describe('testForBed', () => {
  const area = test({ id: 'a', areaId: 'veg', bedId: null, ph: 6.5 });
  it('uses the bed’s own test, or else its area’s', () => {
    const own = test({ ph: 5 });
    expect(testForBed({ soilTest: own, areaId: 'veg' }, [area])).toBe(own);
    expect(testForBed({ soilTest: null, areaId: 'veg' }, [area])).toBe(area);
    expect(testForBed({ soilTest: null, areaId: 'orchard' }, [area])).toBeNull();
    expect(testForBed({ areaId: null }, [area])).toBeNull();
  });
});

describe('placementNotes soil', () => {
  it('notes a plant where the tested pH is outside its range, without blocking', () => {
    const flags = placementNotes({
      areaSoilTests: [test({ id: 'a', areaId: 'veg', bedId: null, ph: 7.2 })],
      beds: [
        { id: 'north', areaId: 'veg', soilTest: null },
        { id: 'south', areaId: 'veg', soilTest: test({ bedId: 'south', ph: 5 }) },
      ],
      plantings: [
        {
          id: 'p1',
          plantId: 'blueberry',
          commonName: 'Blueberry',
          spacingInches: 48,
          soilPh: { min: 4.5, max: 5.5 },
          placement: { bedId: 'north' },
        },
        {
          id: 'p2',
          plantId: 'blueberry',
          commonName: 'Blueberry',
          spacingInches: 48,
          soilPh: { min: 4.5, max: 5.5 },
          placement: { bedId: 'south' },
        },
      ],
    });
    expect(flags).toEqual([
      {
        kind: 'soil',
        plantingIds: ['p1'],
        blocking: false,
        message:
          'Blueberry needs pH 4.5–5.5; the soil here tested 7.2: lower it with sulfur over a season',
      },
    ]);
  });
});
