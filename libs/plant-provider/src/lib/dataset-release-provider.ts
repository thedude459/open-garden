import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type {
  FrostRelativeWeeksDto,
  PlantType,
  RootstockSpacingDto,
} from '@open-garden/shared-types';
import { z } from 'zod';
import { verifyCatalogAttestation } from './catalog-attestation';
import type { PlantDataProvider, ProviderCompanion, ProviderPlant } from './plant-data-provider';

/**
 * The open-garden-data release this app ships with and was tested against.
 * Its SHA-256 is pinned here, not read from beside the file: anyone who can
 * replace the file can replace a checksum next to it. The release's
 * provenance attestation was checked when it was added (`gh attestation
 * verify`); bump all three together.
 */
export const BUNDLED_CATALOG = {
  version: '0.2.2',
  /** Relative to the working directory: the repository root, or /app in the API image. */
  file: 'libs/plant-provider/catalog/open-garden-catalog-0.2.2.json',
  sha256: 'a585f9d9602357385957b5985b36257d9016be6267b936bf9b884ceca1b75adb',
} as const;

/**
 * Reads a release of the open-garden-data catalog
 * (open-garden-catalog-<version>.json) from disk. The file is outside input:
 * it is used only when its SHA-256 is pinned in this app or its provenance
 * attestation (`<file>.sigstore.json`) shows the data repository's release
 * workflow built it, and only after it passes the schema below. See ADR 0019
 * and ADR 0020.
 */
export class DatasetReleaseProvider implements PlantDataProvider {
  readonly id = 'dataset';
  /** `pinned`: SHA-256 hashes trusted without an attestation. */
  constructor(
    private readonly file: string = BUNDLED_CATALOG.file,
    private readonly pinned: readonly string[] = [BUNDLED_CATALOG.sha256],
  ) {}

  async searchByName(query: string, options?: { limit?: number }): Promise<ProviderPlant[]> {
    const q = query.trim().toLowerCase();
    const hits = (await this.load()).plants.filter(
      (p) => p.commonName.toLowerCase().includes(q) || p.cultivar?.toLowerCase().includes(q),
    );
    return hits.slice(0, options?.limit ?? 20);
  }

  /** The whole catalog in one page: a release is a few hundred records at most. */
  async listPage(): Promise<{ items: ProviderPlant[]; nextCursor?: string; skipped: number }> {
    const { plants, skipped } = await this.load();
    return { items: plants, skipped };
  }

  /** The release's companion pairs. Pairs this app cannot read are left out. */
  async companions(): Promise<ProviderCompanion[]> {
    return (await this.load()).companions;
  }

  /**
   * Read the file on every use, not at boot and not cached: a bad file fails
   * one pipeline run (recorded on the run) instead of stopping the API, and a
   * replaced file is picked up on the next run. A release is under 100 KB.
   */
  private load(): Promise<Catalog> {
    return readCatalog(this.file, this.pinned);
  }
}

export interface Catalog {
  plants: ProviderPlant[];
  companions: ProviderCompanion[];
  /** Crops this app cannot read (a newer release may add values it does not know). */
  skipped: number;
}

export async function readCatalog(
  file: string,
  pinned: readonly string[] = [BUNDLED_CATALOG.sha256],
): Promise<Catalog> {
  const json = await readFile(file);
  const sha256 = createHash('sha256').update(json).digest('hex');
  if (!pinned.includes(sha256)) {
    const bundle = await readFile(`${file}.sigstore.json`, 'utf8').catch(() => {
      throw new Error(
        `Catalog file is not the bundled release and has no attestation (${file}.sigstore.json)`,
      );
    });
    try {
      verifyCatalogAttestation(JSON.parse(bundle), sha256);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'verification failed';
      throw new Error(`Catalog attestation does not verify: ${reason}`);
    }
  }

  const parsed = catalogSchema.safeParse(JSON.parse(json.toString('utf8')));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Catalog file is not valid: ${issue?.path.join('.')} ${issue?.message}`);
  }
  // Each crop is checked on its own: a crop using a value from a newer minor
  // release is skipped and counted, and the rest still import.
  // "Cabbage family (cabbage, kale, broccoli)" is named "Cabbage family".
  const families = new Map(
    (parsed.data.families ?? []).map((f) => [
      f.id,
      f.commonName?.replace(/\s*\(.*\)\s*$/, '') || f.name,
    ]),
  );
  const plants: ProviderPlant[] = [];
  let skipped = 0;
  for (const raw of parsed.data.crops) {
    const crop = cropSchema.safeParse(raw);
    if (crop.success) {
      plants.push(...cropPlants(crop.data, families.get(crop.data.family ?? '') ?? null));
    } else skipped += 1;
  }
  const companions: ProviderCompanion[] = [];
  for (const raw of parsed.data.companions ?? []) {
    const pair = companionSchema.safeParse(raw);
    if (!pair.success) continue;
    const { crops, kind, benefits, evidence, reason, reference, shownIn } = pair.data;
    companions.push({
      crops,
      kind,
      benefits,
      evidence,
      reason,
      reference: reference ?? null,
      shownIn: shownIn.map((place) => ({ where: place.where, zones: place.zones ?? null })),
    });
  }
  return { plants, skipped, companions };
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
const zoneNumber = z.number().int().min(1).max(13);
const zones = z.object({ min: zoneNumber, max: zoneNumber });

const cropSchema = z.object({
  id: slug,
  names: z.object({ en: z.string().min(1) }),
  scientificName: z.string().min(1),
  habit: z.enum(['herbaceous', 'vine', 'cane', 'shrub', 'tree']),
  use: z.enum(['vegetable', 'fruit', 'nut', 'herb', 'flower']),
  family: slug.optional(),
  lifeCycle: z.enum(['annual', 'biennial', 'perennial']),
  sun: z.enum(['full', 'part', 'shade']),
  water: z.enum(['low', 'moderate', 'high']),
  // Required by the dataset; optional here so a release without it still imports.
  feeding: z.enum(['light', 'moderate', 'heavy']).optional(),
  spacingCm: spacing,
  windows: z.object({
    indoorStart: window,
    directSow: window,
    transplant: window,
    fallSow: window,
  }),
  daysToMaturity: dayRange.optional(),
  hardinessZones: zones.optional(),
  temperatureC: z.object({ min: z.number(), max: z.number() }).optional(),
  minSoilTemperatureC: z.number().optional(),
  soilPh: z.object({ min: z.number(), max: z.number() }).optional(),
  cropCoefficients: z
    .object({
      initial: z.number(),
      mid: z.number(),
      end: z.number(),
      stageDays: z
        .object({
          initial: z.number().int(),
          development: z.number().int(),
          mid: z.number().int(),
          late: z.number().int(),
        })
        .optional(),
    })
    .optional(),
  rootstocks: z
    .object({
      dwarf: z.object({ spacingCm: spacing }).optional(),
      semiDwarf: z.object({ spacingCm: spacing }).optional(),
      standard: z.object({ spacingCm: spacing }).optional(),
    })
    .optional(),
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
  families: z
    .array(z.object({ id: z.string(), name: z.string(), commonName: z.string().optional() }))
    .optional(),
  // Crops and companion pairs are checked one by one in readCatalog.
  crops: z.array(z.unknown()),
  companions: z.array(z.unknown()).optional(),
});

const companionSchema = z.object({
  crops: z.tuple([slug, slug]),
  kind: z.enum(['helps', 'hinders']),
  benefits: z
    .array(
      z.enum([
        'deters-pests',
        'trap-crop',
        'attracts-beneficials',
        'attracts-pollinators',
        'fixes-nitrogen',
        'support',
        'shade',
        'ground-cover',
        'competes',
        'suppresses-growth',
        'shares-pests',
      ]),
    )
    .min(1),
  evidence: z.enum(['research', 'extension', 'traditional']),
  reason: z.string().min(1),
  reference: z.string().optional(),
  shownIn: z
    .array(
      z.object({
        where: z.string().min(1),
        zones: z.object({ min: zoneNumber, max: zoneNumber }).optional(),
      }),
    )
    .min(1),
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
function cropPlants(crop: Crop, family: string | null): ProviderPlant[] {
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
    rootstockSpacingInches: rootstocks(crop.rootstocks),
    sowingTemperature: crop.temperatureC
      ? {
          minC: crop.temperatureC.min,
          maxC: crop.temperatureC.max,
          minSoilC: crop.minSoilTemperatureC ?? null,
        }
      : null,
    soilPh: crop.soilPh ? { min: crop.soilPh.min, max: crop.soilPh.max } : null,
    cropCoefficients: crop.cropCoefficients
      ? {
          initial: crop.cropCoefficients.initial,
          mid: crop.cropCoefficients.mid,
          end: crop.cropCoefficients.end,
          stageDays: crop.cropCoefficients.stageDays ?? null,
        }
      : null,
    family,
    cropId: crop.id,
    growingGuidance: {
      indoorStart: guidance(crop.windows.indoorStart),
      outdoorSow: guidance(crop.windows.directSow),
      transplant: guidance(crop.windows.transplant),
      fallSow: guidance(crop.windows.fallSow),
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

/** Habit first, except that an herb of any habit (thyme is a subshrub) is an herb. */
function plantType(crop: Crop): PlantType {
  if (crop.use === 'herb') return 'herb';
  if (crop.habit === 'tree' || crop.habit === 'shrub' || crop.habit === 'cane') return crop.habit;
  return crop.use === 'nut' ? 'fruit' : crop.use;
}

function rootstocks(r: Crop['rootstocks']): RootstockSpacingDto | null {
  if (!r) return null;
  const size = (stock: { spacingCm: { inRow: number } } | undefined) =>
    stock ? inches(stock.spacingCm.inRow) : null;
  return { dwarf: size(r.dwarf), semiDwarf: size(r.semiDwarf), standard: size(r.standard) };
}

function guidance(w: Crop['windows']['indoorStart']): FrostRelativeWeeksDto | null {
  return w
    ? { frostAnchor: w.frost, weeksEarliest: w.weeksEarliest, weeksLatest: w.weeksLatest }
    : null;
}

function inches(cm: number): number {
  return Math.max(1, Math.round(cm / 2.54));
}
