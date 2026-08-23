import { z } from 'zod';

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
    clientMutationId: z.string().min(1).max(128).optional(),
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

export const plantingPatchSchema = z.object({
  plantedOn: optionalIsoDate,
  harvestedOn: optionalIsoDate,
  bedId: z.uuid().nullable().optional(),
  clientMutationId: z.string().min(1).max(128).optional(),
});

export const bedCreateSchema = z.object({
  id: z.uuid().optional(),
  name: z.string(),
  lengthInches: inch.min(1, 'Bed length and width must be at least 1 inch'),
  widthInches: inch.min(1, 'Bed length and width must be at least 1 inch'),
  originXInches: inch.optional(),
  originYInches: inch.optional(),
});

export const bedPatchSchema = z.object({
  name: z.string(),
});

export type PlantingCreateParsed = z.infer<typeof plantingCreateSchema>;
export type PlantingPatchParsed = z.infer<typeof plantingPatchSchema>;
export type BedCreateParsed = z.infer<typeof bedCreateSchema>;
export type BedPatchParsed = z.infer<typeof bedPatchSchema>;
export type PlantingListQueryParsed = z.infer<typeof plantingListQuerySchema>;
