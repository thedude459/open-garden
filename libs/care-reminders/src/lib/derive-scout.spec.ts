import type { CatalogPestDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { deriveScoutTasks, stagesOn, type ScoutPlantingInput } from './derive-scout';

const none = { cultural: [], physical: [], biological: [], organic: [], conventional: [] };
const pest = (over: Partial<CatalogPestDto>): CatalogPestDto => ({
  id: 'aphids',
  name: 'Aphids',
  aliases: [],
  scientificName: null,
  kind: 'insect',
  crops: ['tomato'],
  signs: 'Curled leaves.',
  scoutStages: ['seedling', 'vegetative', 'flowering', 'fruiting'],
  controls: none,
  occursIn: null,
  regions: [],
  ...over,
});
const stageDays = { initial: 30, development: 40, mid: 45, late: 30 };
const tomato = (over: Partial<ScoutPlantingInput> = {}): ScoutPlantingInput => ({
  bedId: 'bed-1',
  bedName: 'North',
  cropId: 'tomato',
  plantedOn: '2026-05-01',
  harvestedOn: null,
  annual: true,
  stageDays,
  ...over,
});

const aphids = pest({});
const hornworm = pest({ id: 'hornworm', name: 'Tomato hornworm', scoutStages: ['fruiting'] });
const beetle = pest({
  id: 'cpb',
  name: 'Colorado potato beetle',
  crops: ['tomato', 'potato'],
  scoutStages: ['seedling', 'vegetative'],
  occursIn: ['US', 'CA'],
});

describe('stagesOn', () => {
  it('follows the FAO stage lengths from the planting date', () => {
    expect(stagesOn(tomato(), '2026-05-10')).toEqual(['seedling']);
    expect(stagesOn(tomato(), '2026-06-15')).toEqual(['vegetative']);
    expect(stagesOn(tomato(), '2026-07-20')).toEqual(['flowering', 'fruiting']);
    expect(stagesOn(tomato(), '2026-10-01')).toEqual(['fruiting']);
  });

  it('counts every stage without stage lengths, and for a perennial', () => {
    expect(stagesOn(tomato({ stageDays: null }), '2026-05-10')).toHaveLength(4);
    expect(stagesOn(tomato({ annual: false }), '2026-05-10')).toHaveLength(4);
  });
});

describe('deriveScoutTasks', () => {
  it('gives a bed one weekly task naming the pests for its crops at their stage', () => {
    const [task, ...rest] = deriveScoutTasks(
      [tomato(), tomato({ cropId: 'potato' })],
      [aphids, hornworm, beetle],
      'US',
      [],
      '2026-05-10',
    );
    expect(rest).toEqual([]);
    expect(task).toMatchObject({
      kind: 'scout',
      plantingId: 'bed-1',
      bedId: 'bed-1',
      bedName: 'North',
      // Seedlings: no hornworm yet.
      pests: [
        { id: 'aphids', name: 'Aphids' },
        { id: 'cpb', name: 'Colorado potato beetle' },
      ],
      commonName: 'Aphids, Colorado potato beetle',
      intervalDays: 7,
      dueOn: '2026-05-08',
      urgency: 'overdue',
    });
  });

  it('leaves out pests not known in the property’s country', () => {
    const [task] = deriveScoutTasks([tomato()], [aphids, beetle], 'GB', [], '2026-05-10');
    expect(task?.pests).toEqual([{ id: 'aphids', name: 'Aphids' }]);
    // Country unknown: every pest stays.
    expect(deriveScoutTasks([tomato()], [beetle], null, [], '2026-05-10')).toHaveLength(1);
  });

  it('comes a week after the bed was last scouted', () => {
    const [task] = deriveScoutTasks(
      [tomato()],
      [aphids],
      'US',
      [
        { bedId: 'bed-1', occurrenceOn: '2026-05-08' },
        { bedId: 'bed-2', occurrenceOn: '2026-05-09' },
      ],
      '2026-05-10',
    );
    expect(task).toMatchObject({ dueOn: '2026-05-15', urgency: 'upcoming' });
  });

  it('has no task for a bed with nothing growing or no pests to look for', () => {
    const tasks = (plantings: ScoutPlantingInput[]) =>
      deriveScoutTasks(plantings, [hornworm], 'US', [], '2026-05-10');
    expect(tasks([tomato()])).toEqual([]);
    expect(tasks([tomato({ plantedOn: null }), tomato({ plantedOn: '2026-06-01' })])).toEqual([]);
    expect(
      deriveScoutTasks([tomato({ harvestedOn: '2026-05-09' })], [aphids], 'US', [], '2026-05-10'),
    ).toEqual([]);
    expect(deriveScoutTasks([tomato({ cropId: null })], [aphids], 'US', [], '2026-05-10')).toEqual(
      [],
    );
  });

  it('starts a bed’s week from its earliest planting', () => {
    const [task] = deriveScoutTasks(
      [tomato({ plantedOn: '2026-05-05' }), tomato({ plantedOn: '2026-05-03' })],
      [aphids],
      'US',
      [],
      '2026-05-04',
    );
    expect(task?.dueOn).toBe('2026-05-03');
  });
});
