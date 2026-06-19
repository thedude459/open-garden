import type {
  BedSunExposure,
  GardenAreaType,
  IndoorStartStatus,
  MeasurementUnit,
  PlacementStatus,
  PlantProvenance,
  RotationDegrees,
  SoilType,
  ValidationViolationCode,
  ValidationWarningCode,
} from "./enums";

export interface GardenPlantRef {
  id: string;
  common_name: string;
  provenance: PlantProvenance;
}

export interface GardenArea {
  id: string;
  area_type: GardenAreaType;
  name: string | null;
  origin_x: number;
  origin_y: number;
  length: number;
  width: number;
  rotation_degrees: RotationDegrees;
  soil_type: SoilType | null;
  sun_exposure: BedSunExposure | null;
}

export interface PlantPlacement {
  id: string;
  bed_area_id: string;
  plant: GardenPlantRef;
  position_x: number;
  position_y: number;
  status: PlacementStatus;
  planted_on: string;
  spacing_radius: number;
}

export interface IndoorStart {
  id: string;
  plant: GardenPlantRef;
  target_bed_area_id: string | null;
  started_on: string;
  status: IndoorStartStatus;
}

export interface GardenSummary {
  id: string;
  name: string;
  length: number;
  width: number;
  unit: MeasurementUnit;
  version: number;
  updated_at: string;
  bed_count: number;
  placement_count: number;
}

export interface GardenDetail {
  id: string;
  name: string;
  length: number;
  width: number;
  unit: MeasurementUnit;
  description: string | null;
  version: number;
  areas: GardenArea[];
  placements: PlantPlacement[];
  indoor_starts: IndoorStart[];
}

export interface ValidationViolation {
  code: ValidationViolationCode;
  message: string;
  other_placement_id?: string;
  other_plant_id?: string;
}

export interface ValidationWarning {
  code: ValidationWarningCode;
  message: string;
  conflict_planted_on?: string;
  rotation_group?: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
  warnings: ValidationWarning[];
}

export interface RectAreaInput {
  origin_x: number;
  origin_y: number;
  length: number;
  width: number;
  rotation_degrees: RotationDegrees;
}

export interface GardenBounds {
  length: number;
  width: number;
}
