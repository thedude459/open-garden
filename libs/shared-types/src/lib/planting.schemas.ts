import { z } from 'zod';
import { AREA_KINDS } from './placement';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    if (y === undefined || m === undefined || d === undefined) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, 'Date must be YYYY-MM-DD');

const optionalIsoDate = isoDate.nullable().optional();

const inch = z.number().int();

export const startMethodSchema = z.enum(['direct_seed', 'transplant']);

export const plantingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

export const plantingCreateSchema = z
  .object({
    id: z.uuid().optional(),
    plantId: z.uuid({ error: 'Plant is required' }),
    startMethod: startMethodSchema.default('direct_seed'),
    indoorStartedOn: optionalIsoDate,
    plantedOn: optionalIsoDate,
    harvestedOn: optionalIsoDate,
    bedId: z.uuid().nullable().optional(),
    trayId: z.uuid().nullable().optional(),
    clientMutationId: z.string().min(1).max(128).optional(),
    life: z.enum(['annual', 'perennial', 'tree']).optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    photo: z.string().max(400_000).nullable().optional(),
    plantedYear: z.number().int().min(1900).max(2500).nullable().optional(),
    rootstock: z.string().trim().max(120).nullable().optional(),
    yearsToFruit: z.number().int().min(0).max(100).nullable().optional(),
    spacingFeet: z.number().int().min(1).max(200).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startMethod === 'transplant') {
      if (!value.indoorStartedOn) {
        ctx.addIssue({
          code: 'custom',
          message: 'Indoor start date is required for transplants',
          path: ['indoorStartedOn'],
        });
      }
    } else if (value.indoorStartedOn) {
      ctx.addIssue({
        code: 'custom',
        message: 'Direct seed plantings cannot have an indoor start date',
        path: ['indoorStartedOn'],
      });
    }
  });

/** Log a harvest: the day, and optionally its weight in grams and a count (ADR 0038). */
export const harvestLogSchema = z
  .object({
    harvestedOn: isoDate,
    grams: z.number().int().min(0).max(10_000_000).nullable().optional(),
    count: z.number().int().min(0).max(100_000).nullable().optional(),
  })
  .strict();

/** The most sowings one series adds (half a year, sowing weekly). */
export const MAX_SUCCESSION_SOWINGS = 26;

/** Succession planting: repeat a planting's sowing every N weeks until a date. */
export const plantingRepeatSchema = z
  .object({
    everyWeeks: z
      .number()
      .int()
      .min(1, 'Repeat at least every week')
      .max(12, 'Repeat at most every 12 weeks'),
    until: isoDate,
  })
  .strict();

const photoField = z
  .string()
  .max(400_000)
  .nullable()
  .optional()
  .refine((value) => value == null || value === '' || value.startsWith('data:image/'), {
    message: 'Photo must be an image',
  });

export const plantingPatchSchema = z.object({
  plantedOn: optionalIsoDate,
  harvestedOn: optionalIsoDate,
  bedId: z.uuid().nullable().optional(),
  trayId: z.uuid().nullable().optional(),
  clientMutationId: z.string().min(1).max(128).optional(),
  life: z.enum(['annual', 'perennial', 'tree']).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  photo: photoField,
  plantedYear: z.number().int().min(1900).max(2500).nullable().optional(),
  rootstock: z.string().trim().max(120).nullable().optional(),
  yearsToFruit: z.number().int().min(0).max(100).nullable().optional(),
  spacingFeet: z.number().int().min(1).max(200).nullable().optional(),
});

export const bedCreateSchema = z.object({
  id: z.uuid().optional(),
  name: z.string(),
  lengthInches: inch.min(1, 'Bed length and width must be at least 1 inch'),
  widthInches: inch.min(1, 'Bed length and width must be at least 1 inch'),
  originXInches: inch.optional(),
  originYInches: inch.optional(),
  site: z.enum(['raised', 'in_ground']).optional(),
  station: z.enum(['tree', 'berry']).optional(),
  mulch: z
    .enum(['none', 'wood_chips', 'straw', 'leaves', 'compost', 'paper', 'plastic'])
    .optional(),
  areaId: z.uuid().optional(),
});

export const bedPatchSchema = z.object({
  name: z.string(),
  areaId: z.uuid().optional(),
  sun: z.enum(['full', 'part', 'shade']).nullable().optional(),
  site: z.enum(['raised', 'in_ground']).optional(),
  mulch: z
    .enum(['none', 'wood_chips', 'straw', 'leaves', 'compost', 'paper', 'plastic'])
    .optional(),
});

const nutrientLevel = z.enum(['low', 'medium', 'high']).nullable().default(null);

export const soilTestCreateSchema = z
  .object({
    testedOn: isoDate,
    lab: z.string().trim().max(120).nullable().default(null),
    ph: z.number().min(0).max(14).nullable().default(null),
    organicMatterPct: z.number().min(0).max(100).nullable().default(null),
    nitrogen: nutrientLevel,
    phosphorus: nutrientLevel,
    potassium: nutrientLevel,
    recommendations: z.string().trim().max(4000).nullable().default(null),
  })
  .refine(
    (test) =>
      test.ph !== null ||
      test.organicMatterPct !== null ||
      test.nitrogen !== null ||
      test.phosphorus !== null ||
      test.potassium !== null ||
      Boolean(test.recommendations),
    'Enter at least one result from the test',
  );

export const areaCreateSchema = z.object({
  kind: z.enum(AREA_KINDS),
});

export const areaPatchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Area name is required')
    .max(120, 'Area name must be at most 120 characters'),
});

export const trayCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const companionPairSchema = z.object({
  plantId: z.uuid(),
  otherPlantId: z.uuid(),
  kind: z.enum(['helps', 'hinders', 'pollinates']),
  reason: z.string().trim().min(1).max(280),
});

export type CompanionPairParsed = z.infer<typeof companionPairSchema>;

export type PlantingCreateParsed = z.infer<typeof plantingCreateSchema>;
export type PlantingPatchParsed = z.infer<typeof plantingPatchSchema>;
export type BedCreateParsed = z.infer<typeof bedCreateSchema>;
export type SoilTestCreateParsed = z.infer<typeof soilTestCreateSchema>;
export type BedPatchParsed = z.infer<typeof bedPatchSchema>;
export type PlantingListQueryParsed = z.infer<typeof plantingListQuerySchema>;
