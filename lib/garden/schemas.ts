import { z } from "zod";
import {
  BED_SUN_EXPOSURES,
  GARDEN_AREA_TYPES,
  MEASUREMENT_UNITS,
  PLACEMENT_STATUSES,
  PLANT_PROVENANCES,
  ROTATION_DEGREES,
  ROTATION_UI_ENABLED,
  SOIL_TYPES,
} from "./enums";

const positiveDimension = z.number().positive();

export const measurementUnitSchema = z.enum(MEASUREMENT_UNITS);
export const gardenAreaTypeSchema = z.enum(GARDEN_AREA_TYPES);
export const soilTypeSchema = z.enum(SOIL_TYPES);
export const bedSunExposureSchema = z.enum(BED_SUN_EXPOSURES);
export const plantProvenanceSchema = z.enum(PLANT_PROVENANCES);
export const placementStatusSchema = z.enum(PLACEMENT_STATUSES);

export const rotationDegreesSchema = ROTATION_UI_ENABLED
  ? z.union([
      z.literal(0),
      z.literal(90),
      z.literal(180),
      z.literal(270),
    ])
  : z.literal(0);

export const expectedVersionSchema = z.object({
  expected_version: z.number().int().positive().optional(),
});

export const createGardenSchema = z.object({
  name: z.string().trim().min(1).max(128),
  length: positiveDimension,
  width: positiveDimension,
  unit: measurementUnitSchema,
  description: z.string().trim().max(2000).optional().nullable(),
});

export const updateGardenSchema = expectedVersionSchema.extend({
  name: z.string().trim().min(1).max(128).optional(),
  length: positiveDimension.optional(),
  width: positiveDimension.optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  evict_affected_placements: z.boolean().optional(),
});

export const deleteGardenSchema = expectedVersionSchema;

export const createAreaSchema = expectedVersionSchema.extend({
  area_type: gardenAreaTypeSchema,
  name: z.string().trim().max(128).optional().nullable(),
  origin_x: z.number().min(0),
  origin_y: z.number().min(0),
  length: positiveDimension,
  width: positiveDimension,
  rotation_degrees: rotationDegreesSchema.default(0),
  soil_type: soilTypeSchema.nullable().optional(),
  sun_exposure: bedSunExposureSchema.nullable().optional(),
});

export const updateAreaSchema = expectedVersionSchema.extend({
  area_type: gardenAreaTypeSchema.optional(),
  name: z.string().trim().max(128).optional().nullable(),
  origin_x: z.number().min(0).optional(),
  origin_y: z.number().min(0).optional(),
  length: positiveDimension.optional(),
  width: positiveDimension.optional(),
  rotation_degrees: rotationDegreesSchema.optional(),
  soil_type: soilTypeSchema.nullable().optional(),
  sun_exposure: bedSunExposureSchema.nullable().optional(),
  evict_affected_placements: z.boolean().optional(),
});

export const deleteAreaSchema = expectedVersionSchema.extend({
  confirm: z.literal(true).optional(),
});

export const createPlacementSchema = expectedVersionSchema.extend({
  bed_area_id: z.string().uuid(),
  plant_id: z.string().uuid(),
  plant_provenance: plantProvenanceSchema,
  position_x: z.number(),
  position_y: z.number(),
  planted_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const validatePlacementSchema = z.object({
  bed_area_id: z.string().uuid(),
  plant_id: z.string().uuid(),
  plant_provenance: plantProvenanceSchema,
  position_x: z.number(),
  position_y: z.number(),
  planted_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planting_context: z.enum(["direct_seed", "transplant"]).optional(),
});

export const deletePlacementSchema = expectedVersionSchema;

export const createIndoorStartSchema = expectedVersionSchema.extend({
  target_bed_area_id: z.string().uuid(),
  plant_id: z.string().uuid(),
  plant_provenance: plantProvenanceSchema,
  started_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const updateIndoorStartSchema = expectedVersionSchema.extend({
  target_bed_area_id: z.string().uuid().nullable().optional(),
});

export const transplantIndoorStartSchema = expectedVersionSchema.extend({
  position_x: z.number(),
  position_y: z.number(),
  planted_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const deleteIndoorStartSchema = expectedVersionSchema;

export type CreateGardenInput = z.infer<typeof createGardenSchema>;
export type UpdateGardenInput = z.infer<typeof updateGardenSchema>;
export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type CreatePlacementInput = z.infer<typeof createPlacementSchema>;
export type ValidatePlacementInput = z.infer<typeof validatePlacementSchema>;
export type CreateIndoorStartInput = z.infer<typeof createIndoorStartSchema>;
export type UpdateIndoorStartInput = z.infer<typeof updateIndoorStartSchema>;
export type TransplantIndoorStartInput = z.infer<typeof transplantIndoorStartSchema>;

/** Reject non-zero rotation when US6 is not enabled. */
export function assertRotationAllowed(rotationDegrees: number | undefined): void {
  if (rotationDegrees == null) {
    return;
  }
  if (!ROTATION_UI_ENABLED && rotationDegrees !== 0) {
    throw new RotationNotAllowedError();
  }
  if (!ROTATION_DEGREES.includes(rotationDegrees as (typeof ROTATION_DEGREES)[number])) {
    throw new InvalidRotationError();
  }
}

export class RotationNotAllowedError extends Error {
  readonly name = "RotationNotAllowedError";
  constructor() {
    super("Geometric rotation is not enabled until User Story 6");
  }
}

export class InvalidRotationError extends Error {
  readonly name = "InvalidRotationError";
  constructor() {
    super("rotation_degrees must be 0, 90, 180, or 270");
  }
}
