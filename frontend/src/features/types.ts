export type Garden = {
  id: number;
  name: string;
  description: string;
  zip_code: string;
  growing_zone: string;
  yard_width_ft: number;
  yard_length_ft: number;
  latitude: number;
  longitude: number;
  orientation: "north" | "east" | "south" | "west";
  sun_exposure: "full_sun" | "part_sun" | "part_shade" | "full_shade";
  wind_exposure: "sheltered" | "moderate" | "exposed";
  thermal_mass: "low" | "moderate" | "high";
  slope_position: "low" | "mid" | "high";
  frost_pocket_risk: "low" | "moderate" | "high";
  address_private: string;
  is_shared: boolean;
  edge_buffer_in: number;
};

export type ClimateForecastDay = {
  date: string;
  temperature_min_f: number;
  temperature_max_f: number;
  precipitation_in: number;
};

export type ClimateFactor = {
  key: string;
  label: string;
  impact: string;
};

export type ClimateRecommendation = {
  key: string;
  title: string;
  status: string;
  detail: string;
};

export type GardenClimate = {
  zone: string;
  microclimate_band: string;
  baseline_last_spring_frost: string;
  adjusted_last_spring_frost: string;
  baseline_first_fall_frost: string;
  adjusted_first_fall_frost: string;
  last_frost_shift_days: number;
  first_fall_shift_days: number;
  soil_temperature_estimate_f: number;
  soil_temperature_status: string;
  frost_risk_next_10_days: string;
  next_frost_date: string | null;
  growing_season_days: number;
  factors: ClimateFactor[];
  recommendations: ClimateRecommendation[];
  forecast: ClimateForecastDay[];
};

export type ClimatePlantingWindow = {
  crop_template_id: number;
  crop_name: string;
  variety: string;
  method: string;
  window_start: string;
  window_end: string;
  status: string;
  reason: string;
  soil_temperature_min_f: number;
  indoor_seed_start: string | null;
  indoor_seed_end: string | null;
  legacy_window_label: string;
};

export type GardenClimatePlantingWindows = {
  generated_on: string;
  zone: string;
  microclimate_band: string;
  adjusted_last_spring_frost: string;
  adjusted_first_fall_frost: string;
  soil_temperature_estimate_f: number;
  frost_risk_next_10_days: string;
  windows: ClimatePlantingWindow[];
};

export type SunPathPoint = {
  hour_local: number;
  azimuth_deg: number;
  altitude_deg: number;
  intensity: number;
};

export type GardenSunPath = {
  generated_on: string;
  target_date: string;
  latitude: number;
  longitude: number;
  orientation: Garden["orientation"];
  sunrise_hour: number;
  sunset_hour: number;
  solar_noon_hour: number;
  day_length_hours: number;
  points: SunPathPoint[];
};

export type GrowthStage = {
  planting_id: number;
  crop_name: string;
  bed_id: number;
  days_since_planting: number;
  days_to_harvest: number;
  progress_pct: number;
  stage: string;
  expected_harvest_on: string;
  harvested_on: string | null;
};

export type RotationRecommendation = {
  bed_id: number;
  last_crop: string;
  avoid_family: string;
  recent_families: string[];
  recommended_families: string[];
  reason: string;
};

export type CompanionInsight = {
  bed_id: number;
  crop: string;
  good_matches: string[];
  risk_matches: string[];
  reason: string;
};

export type SuccessionRecommendation = {
  bed_id: number;
  after_planting_id: number;
  after_crop: string;
  target_harvest_date: string;
  recommended_crop: string;
  recommended_method: string;
  window_start: string;
  window_end: string;
  window_status: string;
  reason: string;
};

export type NextPlanting = {
  crop_name: string;
  variety: string;
  family: string;
  method: string;
  window_start: string;
  window_end: string;
  indoor_seed_start: string | null;
  indoor_seed_end: string | null;
  status: string;
  reason: string;
  priority: number;
};

export type GardenSeasonalPlan = {
  generated_on: string;
  garden_id: number;
  zone: string;
  microclimate_band: string;
  soil_temperature_estimate_f: number;
  frost_risk_next_10_days: string;
  stage_counts: Record<string, number>;
  growth_stages: GrowthStage[];
  rotation_recommendations: RotationRecommendation[];
  companion_insights: CompanionInsight[];
  succession_recommendations: SuccessionRecommendation[];
  recommended_next_plantings: NextPlanting[];
};

export type PlantingAction = {
  title: string;
  detail: string;
};

export type PlantingCompanionSummary = {
  good_matches: string[];
  risk_matches: string[];
  reason: string;
};

export type PlantingSuccessionCandidate = {
  crop_name: string;
  variety: string;
  method: string;
  window_start: string;
  window_end: string;
  status: string;
  reason: string;
};

export type PlantingRecommendations = {
  generated_on: string;
  planting_id: number;
  crop_name: string;
  bed_id: number;
  stage: string;
  progress_pct: number;
  days_since_planting: number;
  days_to_harvest: number;
  expected_harvest_on: string;
  companion: PlantingCompanionSummary;
  next_actions: PlantingAction[];
  succession_candidates: PlantingSuccessionCandidate[];
};

export type Bed = {
  id: number;
  garden_id: number;
  name: string;
  width_in: number;
  height_in: number;
  grid_x: number;
  grid_y: number;
};

export type Task = {
  id: number;
  garden_id: number;
  planting_id: number | null;
  title: string;
  due_on: string;
  is_done: boolean;
  notes: string;
};

export type Planting = {
  id: number;
  garden_id: number;
  bed_id: number;
  crop_name: string;
  planted_on: string;
  expected_harvest_on: string;
  source: string;
  harvested_on: string | null;
  yield_notes: string;
};

export type CropTemplate = {
  id: number;
  name: string;
  variety: string;
  source: string;
  source_url: string;
  image_url: string;
  external_product_id: string;
  family: string;
  spacing_in: number;
  row_spacing_in: number;
  in_row_spacing_in: number;
  days_to_harvest: number;
  planting_window: string;
  direct_sow: boolean;
  frost_hardy: boolean;
  weeks_to_transplant: number;
  notes: string;
};

export type CropTemplateSyncStatus = {
  status: string;
  is_running: boolean;
  message: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  cleaned_legacy_count: number;
  error: string | null;
};

export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  kind: "task" | "planting" | "harvest";
  taskId?: number;
  is_done?: boolean;
  notes?: string;
  plantingId?: number;
  harvested_on?: string | null;
  yield_notes?: string;
};

export type Placement = {
  id: number;
  garden_id: number;
  bed_id: number;
  crop_name: string;
  grid_x: number;
  grid_y: number;
  color: string;
  planted_on: string;
};

export type DragPayload = { placementId: number };

export type PestLog = {
  id: number;
  garden_id: number;
  title: string;
  observed_on: string;
  treatment: string;
};

export type SensorKind = "soil_moisture" | "soil_temperature" | "air_temperature" | "humidity";

export type Sensor = {
  id: number;
  garden_id: number;
  bed_id: number | null;
  name: string;
  sensor_kind: SensorKind;
  unit: string;
  location_label: string;
  hardware_id: string;
  is_active: boolean;
  created_at: string;
};

export type SensorSummarySensor = Sensor & {
  latest_value: number | null;
  latest_captured_at: string | null;
};

export type SensorSeriesPoint = {
  sensor_id: number;
  sensor_name: string;
  captured_at: string;
  value: number;
  unit: string;
};

export type IrrigationSuggestion = {
  status: string;
  title: string;
  detail: string;
};

export type GardenSensorsSummary = {
  generated_at: string;
  garden_id: number;
  horizon_hours: number;
  sensors: SensorSummarySensor[];
  soil_moisture_series: SensorSeriesPoint[];
  soil_temperature_series: SensorSeriesPoint[];
  irrigation_suggestions: IrrigationSuggestion[];
};

export type AiCoachScenario = {
  days_ahead: number;
  rain_outlook: "dry" | "normal" | "wet";
  labor_hours: number;
  water_budget: "low" | "normal" | "high";
};

export type AiCoachSuggestedAction = {
  title: string;
  detail: string;
  priority: string;
  category: string;
};

export type AiCoachScenarioOutcome = {
  title: string;
  detail: string;
};

export type AiCoachResponse = {
  reply: string;
  context_highlights: string[];
  suggested_actions: AiCoachSuggestedAction[];
  scenario_outcomes: AiCoachScenarioOutcome[];
};

export type CoachMessage = {
  id: number;
  role: "user" | "coach";
  content: string;
};

export type TimelineCategory = "task" | "weather" | "planting_window" | "sensor_alert" | "ai_recommendation";

export type GardenTimelineEvent = {
  event_date: string;
  title: string;
  detail: string;
  category: TimelineCategory;
  source: string;
  severity: "low" | "medium" | "high";
  drilldown: Record<string, string | number | boolean | null>;
};

export type GardenTimeline = {
  generated_at: string;
  events: GardenTimelineEvent[];
  counts_by_category: Record<string, number>;
};
