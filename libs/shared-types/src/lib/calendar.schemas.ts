import { z } from 'zod';

export const calendarAddSchema = z.object({
  plantId: z.uuid({ error: 'Plant is required' }),
});

export const calendarListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
});

export type CalendarAddParsed = z.infer<typeof calendarAddSchema>;
export type CalendarListQueryParsed = z.infer<typeof calendarListQuerySchema>;
