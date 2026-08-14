import { z } from 'zod';

export const plantTypeSchema = z.enum([
  'vegetable',
  'herb',
  'flower',
  'fruit',
  'shrub',
  'tree',
]);

export const plantListQuerySchema = z.object({
  q: z.string().optional(),
  zone: z.coerce.number().int().min(1).max(13).optional(),
  plantType: plantTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const authLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const authRegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(120).optional(),
});

export const favoriteMutationSchema = z.object({
  clientMutationId: z.string().min(1).max(128).optional(),
});

export type PlantListQueryParsed = z.infer<typeof plantListQuerySchema>;
export type AuthRegisterParsed = z.infer<typeof authRegisterSchema>;
export type AuthLoginParsed = z.infer<typeof authLoginSchema>;
