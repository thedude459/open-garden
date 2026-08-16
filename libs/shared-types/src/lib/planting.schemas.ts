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

export const plantingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

export const plantingCreateSchema = z.object({
  id: z.uuid().optional(),
  plantId: z.uuid({ error: 'Plant is required' }),
  plantedOn: optionalIsoDate,
  harvestedOn: optionalIsoDate,
  bedId: z.uuid().nullable().optional(),
  clientMutationId: z.string().min(1).max(128).optional(),
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
});

export const bedPatchSchema = z.object({
  name: z.string(),
});

export type PlantingCreateParsed = z.infer<typeof plantingCreateSchema>;
export type PlantingPatchParsed = z.infer<typeof plantingPatchSchema>;
export type BedCreateParsed = z.infer<typeof bedCreateSchema>;
export type BedPatchParsed = z.infer<typeof bedPatchSchema>;
export type PlantingListQueryParsed = z.infer<typeof plantingListQuerySchema>;
