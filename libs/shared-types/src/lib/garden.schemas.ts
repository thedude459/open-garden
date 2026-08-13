import { z } from 'zod';

export const gardenRoleSchema = z.enum(['owner', 'collaborator', 'viewer']);
export const inviteRoleSchema = z.enum(['collaborator', 'viewer']);

export const monthDaySchema = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

export const gardenListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const gardenCreateSchema = z.object({
  name: z.string().min(1).max(120),
  notes: z.string().max(4000).nullable().optional(),
  hardinessZone: z.number().int().min(1).max(13).nullable().optional(),
  lastFrost: monthDaySchema.nullable().optional(),
  firstFrost: monthDaySchema.nullable().optional(),
});

export const gardenPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  notes: z.string().max(4000).nullable().optional(),
  hardinessZone: z.number().int().min(1).max(13).nullable().optional(),
  lastFrost: monthDaySchema.nullable().optional(),
  firstFrost: monthDaySchema.nullable().optional(),
});

export const gardenInviteSchema = z.object({
  email: z.email(),
  role: inviteRoleSchema,
});

export const gardenMemberPatchSchema = z.object({
  role: gardenRoleSchema,
});

export type GardenCreateParsed = z.infer<typeof gardenCreateSchema>;
export type GardenPatchParsed = z.infer<typeof gardenPatchSchema>;
export type GardenInviteParsed = z.infer<typeof gardenInviteSchema>;
export type GardenMemberPatchParsed = z.infer<typeof gardenMemberPatchSchema>;
