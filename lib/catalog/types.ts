import type { PlantCategory, SunExposure, Vigor } from "./enums";

export type Provenance =
  | "authoritative"
  | "stub"
  | "provisional"
  | "linked_provisional";

export interface PlantRef {
  id: string;
  common_name: string;
  relationship_type?: "companion" | "incompatible";
}

export interface RootstockOption {
  id: string;
  name: string;
  vigor: Vigor;
  mature_height_cm: number | null;
  mature_spread_cm: number | null;
  spacing_cm: number | null;
  notes?: string | null;
}

export interface LocationContext {
  recommended_seed_start: string | null;
  recommended_transplant: string | null;
}

export interface PlantSummary {
  id: string;
  common_name: string;
  botanical_name: string | null;
  variety: string | null;
  plant_category: PlantCategory;
  days_to_maturity: number | null;
  provenance: Provenance;
  field_gaps: string[];
}

export interface PlantDetail extends PlantSummary {
  seed_start_window: Record<string, unknown> | null;
  transplant_rules: Record<string, unknown> | null;
  direct_seed_rules: Record<string, unknown> | null;
  spacing_cm: { row?: number; plant?: number } | null;
  sun_exposure: SunExposure | null;
  watering_needs: Record<string, unknown> | null;
  fertilizer_needs: string | null;
  fertilizer_data_gap: boolean;
  pest_disease_notes: string[];
  harvest_window: Record<string, unknown> | null;
  hardiness_min_zone: number | null;
  hardiness_max_zone: number | null;
  companions: PlantRef[];
  incompatibles: PlantRef[];
  rootstocks: RootstockOption[];
  location_context?: LocationContext | null;
}

export interface SearchResult {
  results: PlantSummary[];
  total: number;
  climate_filter_active: boolean;
}
