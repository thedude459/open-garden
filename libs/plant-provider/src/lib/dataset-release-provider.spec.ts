import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUNDLED_CATALOG, DatasetReleaseProvider } from './dataset-release-provider';

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

const sha = (json: string | Buffer) => createHash('sha256').update(json).digest('hex');

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'og-catalog-'));
  dirs.push(dir);
  return dir;
}

/** Writes the catalog; its SHA-256 is returned so a test can pin it. */
function write(content: unknown): { file: string; sha256: string } {
  const file = join(tempDir(), 'open-garden-catalog-0.1.0.json');
  const json = JSON.stringify(content);
  writeFileSync(file, json);
  return { file, sha256: sha(json) };
}

/** A provider for a test catalog, trusted by pinning its hash. */
function pinned(content: unknown): DatasetReleaseProvider {
  const { file, sha256 } = write(content);
  return new DatasetReleaseProvider(file, [sha256]);
}

describe('DatasetReleaseProvider', () => {
  it('maps a crop and each variety to catalog plants keyed by dataset id', async () => {
    const { items } = await pinned(catalog([tomato])).listPage();
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
    const { items } = await pinned(catalog([noFeeding])).listPage();
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
    const blueberry = {
      ...tomato,
      id: 'blueberry',
      names: { en: 'Blueberry' },
      use: 'fruit',
      habit: 'shrub',
      lifeCycle: 'perennial',
      varieties: [],
      hardinessZones: { min: 4, max: 7 },
    };
    const { items } = await pinned(catalog([apple, rhubarb, raspberry, blueberry])).listPage();
    expect(items.map((p) => [p.externalId, p.plantType, p.zoneMin, p.zoneMax])).toEqual([
      ['apple', 'tree', 3, 8],
      ['rhubarb', 'vegetable', null, null],
      ['raspberry', 'fruit', 1, 13],
      ['blueberry', 'shrub', 4, 7],
    ]);
  });

  it('searches by name and variety', async () => {
    const provider = pinned(catalog([tomato]));
    expect((await provider.searchByName('cherry')).map((p) => p.externalId)).toEqual([
      'tomato-cherry',
    ]);
    expect(await provider.searchByName('tomato', { limit: 1 })).toHaveLength(1);
  });

  it('ignores fields it does not use, so newer minor releases still import', async () => {
    const provider = pinned(catalog([{ ...tomato, newField: 1 }], { companions: [] }));
    await expect(provider.listPage()).resolves.toBeTruthy();
  });

  it('refuses a file that is not pinned and has no attestation', async () => {
    const { file } = write(catalog([tomato]));
    await expect(new DatasetReleaseProvider(file).listPage()).rejects.toThrow(
      /not the bundled release and has no attestation/,
    );
  });

  it('refuses a file whose attestation is not a valid Sigstore bundle', async () => {
    const { file } = write(catalog([tomato]));
    writeFileSync(`${file}.sigstore.json`, JSON.stringify({ mediaType: 'nope' }));
    await expect(new DatasetReleaseProvider(file).listPage()).rejects.toThrow(
      /attestation does not verify/,
    );
  });

  it('refuses a file that is not a valid catalog', async () => {
    const inches = catalog([tomato], { units: { length: 'in', temperature: 'F' } });
    await expect(pinned(inches).listPage()).rejects.toThrow(/units.length/);
    const noCrops = catalog([], { crops: 'none' });
    await expect(pinned(noCrops).listPage()).rejects.toThrow(/crops/);
  });

  it('skips and counts crops it cannot read, and imports the rest', async () => {
    // A newer minor release may add a habit this app does not know yet.
    const shrubby = { ...tomato, id: 'shrubby', habit: 'subshrub' };
    const page = await pinned(catalog([shrubby, tomato])).listPage();
    expect(page.skipped).toBe(1);
    expect(page.items.map((p) => p.externalId)).toEqual(['tomato', 'tomato-cherry']);
  });

  it('picks up a replaced catalog file without a restart', async () => {
    const lettuce = { ...tomato, id: 'lettuce', names: { en: 'Lettuce' }, varieties: [] };
    const next = JSON.stringify(catalog([tomato, lettuce]));
    const { file, sha256 } = write(catalog([tomato]));
    const provider = new DatasetReleaseProvider(file, [sha256, sha(next)]);
    expect((await provider.listPage()).items).toHaveLength(2);
    writeFileSync(file, next);
    expect((await provider.listPage()).items.map((p) => p.externalId)).toContain('lettuce');
  });
});

describe('the bundled open-garden-data release', () => {
  const bundled = readFileSync(BUNDLED_CATALOG.file);
  const attestation = readFileSync(`${BUNDLED_CATALOG.file}.sigstore.json`);

  it('is the pinned file and imports every crop', async () => {
    expect(sha(bundled)).toBe(BUNDLED_CATALOG.sha256);
    const { items, skipped } = await new DatasetReleaseProvider().listPage();
    expect(skipped).toBe(0);
    expect(items.map((p) => p.varietyKey)).toEqual(
      expect.arrayContaining(['dataset:tomato', 'dataset:tomato-cherry', 'dataset:apple']),
    );
  });

  it('is accepted on its provenance attestation alone', async () => {
    const file = join(tempDir(), 'open-garden-catalog-0.1.0.json');
    writeFileSync(file, bundled);
    writeFileSync(`${file}.sigstore.json`, attestation);
    expect((await new DatasetReleaseProvider(file, []).listPage()).items.length).toBeGreaterThan(
      50,
    );
  });

  it('refuses a changed file that carries the real attestation', async () => {
    const file = join(tempDir(), 'open-garden-catalog-0.1.0.json');
    writeFileSync(file, bundled.toString('utf8').replace('"Tomato"', '"Tamato"'));
    writeFileSync(`${file}.sigstore.json`, attestation);
    await expect(new DatasetReleaseProvider(file, []).listPage()).rejects.toThrow(
      /attestation does not verify: Catalog attestation is for a different file/,
    );
  });
});
