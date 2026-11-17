import { z } from 'zod';

export const plantTypeSchema = z.enum([
  'vegetable',
  'herb',
  'flower',
  'fruit',
  'cane',
  'shrub',
  'tree',
]);

export const plantListQuerySchema = z.object({
  q: z.string().optional(),
  zone: z.coerce.number().int().min(1).max(13).optional(),
  plantType: plantTypeSchema.optional(),
  family: z.string().trim().min(1).max(80).optional(),
  sowNowFor: z.uuid().optional(),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'The new password needs at least 8 characters'),
  })
  .strict();

export const deleteAccountSchema = z.object({ password: z.string().min(1) }).strict();

export const favoriteMutationSchema = z.object({
  clientMutationId: z.string().min(1).max(128).optional(),
});

export type PlantListQueryParsed = z.infer<typeof plantListQuerySchema>;
export type AuthRegisterParsed = z.infer<typeof authRegisterSchema>;
export type AuthLoginParsed = z.infer<typeof authLoginSchema>;
