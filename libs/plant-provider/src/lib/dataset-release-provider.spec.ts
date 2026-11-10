import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DatasetReleaseProvider } from './dataset-release-provider';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const tomato = {
  id: 'tomato',
  names: { en: 'Tomato' },
  scientificName: 'Solanum lycopersicum',
  family: 'solanaceae',
  habit: 'herbaceous',
  use: 'vegetable',
  lifeCycle: 'annual',
  sun: 'full',
  water: 'moderate',
  feeding: 'heavy',
  spacingCm: { inRow: 50, betweenRows: 90 },
  windows: {
    indoorStart: { frost: 'last', weeksEarliest: -8, weeksLatest: -6 },
    transplant: { frost: 'last', weeksEarliest: 1, weeksLatest: 3 },
  },
  daysToMaturity: { min: 55, max: 85 },
  varieties: [
    {
      id: 'tomato-cherry',
      name: 'Cherry',
      daysToMaturity: { min: 55, max: 65 },
      spacingCm: { inRow: 45 },
    },
  ],
  sources: [{ source: 'hand-curation' }],
};

function catalog(crops: unknown[], extra: Record<string, unknown> = {}) {
  return {
    version: '0.1.0',
    license: 'CC0-1.0',
    units: { length: 'cm', temperature: 'C' },
    crops,
    ...extra,
  };
}

/** Writes the catalog and, unless told otherwise, a matching .sha256 beside it. */
function write(content: unknown, checksum: 'match' | 'wrong' | 'none' = 'match'): string {
  const dir = mkdtempSync(join(tmpdir(), 'og-catalog-'));
  dirs.push(dir);
  const file = join(dir, 'open-garden-catalog-0.1.0.json');
  const json = JSON.stringify(content);
  writeFileSync(file, json);
  const sha = createHash('sha256').update(json).digest('hex');
  if (checksum !== 'none') {
    writeFileSync(`${file}.sha256`, `${checksum === 'match' ? sha : '0'.repeat(64)}  x.json\n`);
  }
  return file;
}

describe('DatasetReleaseProvider', () => {
  it('maps a crop and each variety to catalog plants keyed by dataset id', async () => {
    const { items } = await new DatasetReleaseProvider(write(catalog([tomato]))).listPage();
    expect(items.map((p) => [p.varietyKey, p.commonName, p.cultivar])).toEqual([
      ['dataset:tomato', 'Tomato', null],
      ['dataset:tomato-cherry', 'Tomato', 'Cherry'],
    ]);
    const [crop, cherry] = items;
    expect(crop).toMatchObject({
      externalId: 'tomato',
      species: 'Solanum lycopersicum',
      plantType: 'vegetable',
      // An annual needs no winter hardiness.
      zoneMin: 1,
      zoneMax: 13,
      sunRequirements: 'Full sun',
      waterNeeds: 'Moderate',
      waterIntervalDays: 7,
      fertilizeIntervalDays: 14,
      daysToMaturity: 55,
      spacingInches: 20, // 50 cm
      growingGuidance: {
        indoorStart: { frostAnchor: 'last', weeksEarliest: -8, weeksLatest: -6 },
        outdoorSow: null,
        transplant: { frostAnchor: 'last', weeksEarliest: 1, weeksLatest: 3 },
      },
    });
    expect(cherry).toMatchObject({ daysToMaturity: 55, spacingInches: 18 }); // 45 cm
  });

  it('leaves the fertilize interval unset when a release has no feeding class', async () => {
    const noFeeding = { ...tomato, feeding: undefined }; // dropped when written as JSON
    const { items } = await new DatasetReleaseProvider(write(catalog([noFeeding]))).listPage();
    expect(items[0]?.fertilizeIntervalDays).toBeNull();
  });

  it('uses hardiness zones for perennials and leaves them unset when missing', async () => {
    const apple = {
      ...tomato,
      id: 'apple',
      names: { en: 'Apple' },
      use: 'fruit',
      habit: 'tree',
      lifeCycle: 'perennial',
      varieties: [],
      hardinessZones: { min: 3, max: 8 },
    };
    const rhubarb = {
      ...tomato,
      id: 'rhubarb',
      names: { en: 'Rhubarb' },
      lifeCycle: 'perennial',
      varieties: [],
    };
    const raspberry = {
      ...tomato,
      id: 'raspberry',
      names: { en: 'Raspberry' },
      use: 'fruit',
      habit: 'cane',
      varieties: [],
    };
    const { items } = await new DatasetReleaseProvider(
      write(catalog([apple, rhubarb, raspberry])),
    ).listPage();
    expect(items.map((p) => [p.externalId, p.plantType, p.zoneMin, p.zoneMax])).toEqual([
      ['apple', 'tree', 3, 8],
      ['rhubarb', 'vegetable', null, null],
      ['raspberry', 'fruit', 1, 13],
    ]);
  });

  it('searches by name and variety', async () => {
    const provider = new DatasetReleaseProvider(write(catalog([tomato])));
    expect((await provider.searchByName('cherry')).map((p) => p.externalId)).toEqual([
      'tomato-cherry',
    ]);
    expect(await provider.searchByName('tomato', { limit: 1 })).toHaveLength(1);
  });

  it('ignores fields it does not use, so newer minor releases still import', async () => {
    const file = write(catalog([{ ...tomato, newField: 1 }], { companions: [] }));
    await expect(new DatasetReleaseProvider(file).listPage()).resolves.toBeTruthy();
  });

  it('refuses a file whose checksum is missing or does not match', async () => {
    await expect(
      new DatasetReleaseProvider(write(catalog([tomato]), 'none')).listPage(),
    ).rejects.toThrow(/checksum file .* is missing/);
    await expect(
      new DatasetReleaseProvider(write(catalog([tomato]), 'wrong')).listPage(),
    ).rejects.toThrow(/does not match its SHA-256/);
  });

  it('refuses a file that is not a valid catalog', async () => {
    const inches = catalog([tomato], { units: { length: 'in', temperature: 'F' } });
    await expect(new DatasetReleaseProvider(write(inches)).listPage()).rejects.toThrow(
      /units.length/,
    );
    const noCrops = catalog([], { crops: 'none' });
    await expect(new DatasetReleaseProvider(write(noCrops)).listPage()).rejects.toThrow(/crops/);
  });

  it('skips and counts crops it cannot read, and imports the rest', async () => {
    // A newer minor release may add a habit this app does not know yet.
    const shrubby = { ...tomato, id: 'shrubby', habit: 'subshrub' };
    const page = await new DatasetReleaseProvider(write(catalog([shrubby, tomato]))).listPage();
    expect(page.skipped).toBe(1);
    expect(page.items.map((p) => p.externalId)).toEqual(['tomato', 'tomato-cherry']);
  });

  it('tries the file again after a failed read', async () => {
    const file = write(catalog([tomato]), 'none');
    const provider = new DatasetReleaseProvider(file);
    await expect(provider.listPage()).rejects.toThrow();
    const json = JSON.stringify(catalog([tomato]));
    writeFileSync(`${file}.sha256`, createHash('sha256').update(json).digest('hex'));
    expect((await provider.listPage()).items).toHaveLength(2);
  });
});
