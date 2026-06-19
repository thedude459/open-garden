export const MEASUREMENT_UNITS = ["feet", "meters"] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const GARDEN_AREA_TYPES = ["bed", "path"] as const;
export type GardenAreaType = (typeof GARDEN_AREA_TYPES)[number];

export const SOIL_TYPES = [
  "sand",
  "loamy_sand",
  "sandy_loam",
  "loam",
  "silt_loam",
  "silt",
  "sandy_clay_loam",
  "clay_loam",
  "silty_clay_loam",
  "sandy_clay",
  "silty_clay",
  "clay",
] as const;
export type SoilType = (typeof SOIL_TYPES)[number];

export const SOIL_TYPE_GROUPS = {
  "sand-dominant": ["sand", "loamy_sand", "sandy_loam", "sandy_clay_loam", "sandy_clay"],
  loam: ["loam"],
  "silt-dominant": ["silt_loam", "silt", "silty_clay_loam", "silty_clay"],
  "clay-dominant": ["clay_loam", "clay"],
} as const satisfies Record<string, readonly SoilType[]>;

export const SOIL_CANVAS_ABBREV: Record<SoilType, string> = {
  sand: "Sand",
  loamy_sand: "L. sand",
  sandy_loam: "S. loam",
  loam: "Loam",
  silt_loam: "Si. loam",
  silt: "Silt",
  sandy_clay_loam: "Sa. cl loam",
  clay_loam: "C. loam",
  silty_clay_loam: "Si. cl loam",
  sandy_clay: "Sa. clay",
  silty_clay: "Si. clay",
  clay: "Clay",
};

export const BED_SUN_EXPOSURES = ["full_sun", "partial_shade", "full_shade"] as const;
export type BedSunExposure = (typeof BED_SUN_EXPOSURES)[number];

export const SUN_CANVAS_ABBREV: Record<BedSunExposure, string> = {
  full_sun: "Sun",
  partial_shade: "Part sh",
  full_shade: "Shade",
};

export const PLACEMENT_STATUSES = ["direct_seeded", "transplanted"] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

export const INDOOR_START_STATUSES = ["active", "transplanted", "cancelled"] as const;
export type IndoorStartStatus = (typeof INDOOR_START_STATUSES)[number];

export const ROTATION_DEGREES = [0, 90, 180, 270] as const;
export type RotationDegrees = (typeof ROTATION_DEGREES)[number];

/** US6 enables non-zero rotation in API and UI. */
export const ROTATION_UI_ENABLED = false;

export const PLANT_PROVENANCES = ["authoritative", "provisional"] as const;
export type PlantProvenance = (typeof PLANT_PROVENANCES)[number];

export const VALIDATION_VIOLATION_CODES = ["SPACING", "INCOMPATIBLE", "BOUNDARY", "OVERLAP"] as const;
export type ValidationViolationCode = (typeof VALIDATION_VIOLATION_CODES)[number];

export const VALIDATION_WARNING_CODES = ["CLIMATE_DATE", "CROP_ROTATION"] as const;
export type ValidationWarningCode = (typeof VALIDATION_WARNING_CODES)[number];
