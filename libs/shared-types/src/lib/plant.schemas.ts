import { z } from 'zod';
import { AREA_KINDS } from './placement';

export const plantTypeSchema = z.enum([
  'vegetable',
  'herb',
  'flower',
  'fruit',
  'cane',
  'shrub',
  'vine',
  'tree',
]);

export const plantListQuerySchema = z.object({
  q: z.string().optional(),
  zone: z.coerce.number().int().min(1).max(13).optional(),
  plantType: plantTypeSchema.optional(),
  area: z.enum(AREA_KINDS).optional(),
  family: z.string().trim().min(1).max(80).optional(),
  sowNowFor: z.uuid().optional(),
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * A password to set. bcrypt reads only its first 72 bytes, so anything after
 * would not protect the account: refuse it rather than ignore it silently.
 */
const newPassword = z
  .string()
  .min(8, 'The new password needs at least 8 characters')
  .refine((p) => new TextEncoder().encode(p).length <= 72, {
    message: 'Use a password of at most 72 bytes (about 72 letters, fewer with accents or emoji)',
  });

export const authLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const authRegisterSchema = z.object({
  email: z.email(),
  password: newPassword,
  displayName: z.string().min(1).max(120).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword,
  })
  .strict();

export const deleteAccountSchema = z.object({ password: z.string().min(1) }).strict();

export const passwordResetRequestSchema = z.object({ email: z.email() }).strict();

export const passwordResetSchema = z
  .object({
    token: z.string().regex(/^[0-9a-f]{64}$/, 'This reset link is not complete'),
    password: newPassword,
  })
  .strict();

export const favoriteMutationSchema = z.object({
  clientMutationId: z.string().min(1).max(128).optional(),
});

export type PlantListQueryParsed = z.infer<typeof plantListQuerySchema>;
export type AuthRegisterParsed = z.infer<typeof authRegisterSchema>;
export type AuthLoginParsed = z.infer<typeof authLoginSchema>;
