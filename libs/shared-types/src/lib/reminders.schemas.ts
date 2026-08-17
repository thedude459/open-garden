import { z } from 'zod';

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const careKindSchema = z.enum(['water', 'fertilize', 'harvest']);

export const reminderMutationSchema = z.object({
  plantingId: uuid,
  kind: careKindSchema,
  dueOn: isoDate,
});

export const asOfQuerySchema = z.object({
  asOf: isoDate,
});
