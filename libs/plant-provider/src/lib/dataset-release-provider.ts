import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { FrostRelativeWeeksDto, PlantType } from '@open-garden/shared-types';
import { z } from 'zod';
import type { PlantDataProvider, ProviderPlant } from './plant-data-provider';

/**
 * Reads a release of the open-garden-data catalog
 * (open-garden-catalog-<version>.json) from disk. The file is outside input:
 * it is used only when the SHA-256 in the `.sha256` file beside it matches,
 * and only after it passes the schema below. See ADR 0019.
 */
export class DatasetReleaseProvider implements PlantDataProvider {
  readonly id = 'dataset';
  private plants: Promise<ProviderPlant[]> | null = null;

  /** `file` is the catalog JSON; `${file}.sha256` must sit beside it. */
  constructor(private readonly file: string) {}

  async searchByName(query: string, options?: { limit?: number }): Promise<ProviderPlant[]> {
    const q = query.trim().toLowerCase();
    const hits = (await this.load()).filter(
      (p) => p.commonName.toLowerCase().includes(q) || p.cultivar?.toLowerCase().includes(q),
    );
    return hits.slice(0, options?.limit ?? 20);
  }

  /** The whole catalog in one page: a release is a few hundred records at most. */
  async listPage(): Promise<{ items: ProviderPlant[]; nextCursor?: string }> {
    return { items: await this.load() };
  }

  private load(): Promise<ProviderPlant[]> {
    // Load on first use, not at boot, so a bad file fails one pipeline run
    // (recorded on the run) instead of stopping the API. Retry after a failure.
    this.plants ??= readCatalog(this.file).catch((err: unknown) => {
      this.plants = null;
      throw err;
    });
    return this.plants;
  }
}

export async function readCatalog(file: string): Promise<ProviderPlant[]> {
  const [json, checksum] = await Promise.all([
    readFile(file),
    readFile(`${file}.sha256`, 'utf8').catch(() => {
      throw new Error(`Catalog checksum file ${file}.sha256 is missing`);
    }),
  ]);
  const expected = checksum.trim().split(/\s+/)[0]?.toLowerCase();
  const actual = createHash('sha256').update(json).digest('hex');
  if (expected !== actual) throw new Error('Catalog file does not match its SHA-256 checksum');

  const parsed = catalogSchema.safeParse(JSON.parse(json.toString('utf8')));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Catalog file is not valid: ${issue?.path.join('.')} ${issue?.message}`);
  }
  return parsed.data.crops.flatMap(cropPlants);
}

// Only the fields the app uses. Unknown fields are ignored, so a newer minor
// release still imports.
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const window = z
  .object({
    frost: z.enum(['last', 'first']),
    weeksEarliest: z.number().int(),
    weeksLatest: z.number().int(),
  })
  .optional();
const dayRange = z.object({ min: z.number().int().positive(), max: z.number().int().positive() });
const spacing = z.object({ inRow: z.number().positive() });
const zones = z.object({
  min: z.number().int().min(1).max(13),
  max: z.number().int().min(1).max(13),
});

const cropSchema = z.object({
  id: slug,
  names: z.object({ en: z.string().min(1) }),
  scientificName: z.string().min(1),
  habit: z.enum(['herbaceous', 'vine', 'cane', 'shrub', 'tree']),
  use: z.enum(['vegetable', 'fruit', 'nut', 'herb', 'flower']),
  lifeCycle: z.enum(['annual', 'biennial', 'perennial']),
  sun: z.enum(['full', 'part', 'shade']),
  water: z.enum(['low', 'moderate', 'high']),
  // Required by the dataset; optional here so a release without it still imports.
  feeding: z.enum(['light', 'moderate', 'heavy']).optional(),
  spacingCm: spacing,
  windows: z.object({ indoorStart: window, directSow: window, transplant: window }),
  daysToMaturity: dayRange.optional(),
  hardinessZones: zones.optional(),
  varieties: z
    .array(
      z.object({
        id: slug,
        name: z.string().min(1),
        daysToMaturity: dayRange.optional(),
        spacingCm: spacing.optional(),
      }),
    )
    .optional(),
});

const catalogSchema = z.object({
  version: z.string(),
  units: z.object({ length: z.literal('cm'), temperature: z.literal('C') }),
  crops: z.array(cropSchema),
});

type Crop = z.infer<typeof cropSchema>;

const SUN: Record<Crop['sun'], string> = { full: 'Full sun', part: 'Part shade', shade: 'Shade' };
const WATER: Record<Crop['water'], string> = { low: 'Low', moderate: 'Moderate', high: 'High' };
// ponytail: care intervals from the water and feeding classes alone. Rain is
// handled by care reminders; per-crop intervals belong in the dataset if these
// prove too coarse.
const WATER_INTERVAL_DAYS: Record<Crop['water'], number> = { low: 14, moderate: 7, high: 3 };
const FEED_INTERVAL_DAYS: Record<NonNullable<Crop['feeding']>, number> = {
  light: 42,
  moderate: 28,
  heavy: 14,
};

/** One plant for the crop itself, then one per variety. */
function cropPlants(crop: Crop): ProviderPlant[] {
  const base: ProviderPlant = {
    externalId: crop.id,
    varietyKey: `dataset:${crop.id}`,
    commonName: crop.names.en,
    species: crop.scientificName,
    cultivar: null,
    plantType: plantType(crop),
    // A crop grown for one season does not need to survive winter, so any zone
    // will do. Perennials without zones are left unset and rejected by the merge.
    zoneMin: crop.hardinessZones?.min ?? (crop.lifeCycle === 'perennial' ? null : 1),
    zoneMax: crop.hardinessZones?.max ?? (crop.lifeCycle === 'perennial' ? null : 13),
    sunRequirements: SUN[crop.sun],
    waterNeeds: WATER[crop.water],
    daysToMaturity: crop.daysToMaturity?.min ?? null,
    spacingInches: inches(crop.spacingCm.inRow),
    waterIntervalDays: WATER_INTERVAL_DAYS[crop.water],
    fertilizeIntervalDays: crop.feeding ? FEED_INTERVAL_DAYS[crop.feeding] : null,
    growingGuidance: {
      indoorStart: guidance(crop.windows.indoorStart),
      outdoorSow: guidance(crop.windows.directSow),
      transplant: guidance(crop.windows.transplant),
    },
  };
  return [
    base,
    ...(crop.varieties ?? []).map((v) => ({
      ...base,
      externalId: v.id,
      varietyKey: `dataset:${v.id}`,
      cultivar: v.name,
      daysToMaturity: v.daysToMaturity?.min ?? base.daysToMaturity,
      spacingInches: v.spacingCm ? inches(v.spacingCm.inRow) : base.spacingInches,
    })),
  ];
}

function plantType(crop: Crop): PlantType {
  if (crop.use === 'fruit' || crop.use === 'nut') {
    if (crop.habit === 'tree') return 'tree';
    if (crop.habit === 'shrub') return 'shrub';
    return 'fruit';
  }
  return crop.use;
}

function guidance(w: Crop['windows']['indoorStart']): FrostRelativeWeeksDto | null {
  return w
    ? { frostAnchor: w.frost, weeksEarliest: w.weeksEarliest, weeksLatest: w.weeksLatest }
    : null;
}

function inches(cm: number): number {
  return Math.max(1, Math.round(cm / 2.54));
}
