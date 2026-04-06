from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    email_verified: bool
    is_admin: bool
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class MessageOut(BaseModel):
    message: str


class CropTemplateSyncStatusOut(BaseModel):
    status: str
    is_running: bool
    message: str
    last_started_at: str | None = None
    last_finished_at: str | None = None
    added: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    cleaned_legacy_count: int = 0
    error: str | None = None


class VerifyEmailPayload(BaseModel):
    token: str


class ForgotPasswordPayload(BaseModel):
    email: EmailStr


class ForgotUsernamePayload(BaseModel):
    email: EmailStr


class ResetPasswordPayload(BaseModel):
    token: str
    new_password: str


class GardenCreate(BaseModel):
    name: str
    description: str = ""
    zip_code: str
    yard_width_ft: int = 20
    yard_length_ft: int = 20
    orientation: Literal["north", "east", "south", "west"] = "south"
    sun_exposure: Literal["full_sun", "part_sun", "part_shade", "full_shade"] = "part_sun"
    wind_exposure: Literal["sheltered", "moderate", "exposed"] = "moderate"
    thermal_mass: Literal["low", "moderate", "high"] = "moderate"
    slope_position: Literal["low", "mid", "high"] = "mid"
    frost_pocket_risk: Literal["low", "moderate", "high"] = "low"
    address_private: str = ""
    is_shared: bool = False
    edge_buffer_in: int = 6


class GardenOut(BaseModel):
    id: int
    owner_id: int
    name: str
    description: str
    zip_code: str
    growing_zone: str
    yard_width_ft: int
    yard_length_ft: int
    latitude: float
    longitude: float
    orientation: str
    sun_exposure: str
    wind_exposure: str
    thermal_mass: str
    slope_position: str
    frost_pocket_risk: str
    address_private: str = ""
    is_shared: bool
    edge_buffer_in: int

    model_config = ConfigDict(from_attributes=True)


class GardenMicroclimateUpdate(BaseModel):
    orientation: Literal["north", "east", "south", "west"] | None = None
    sun_exposure: Literal["full_sun", "part_sun", "part_shade", "full_shade"] | None = None
    wind_exposure: Literal["sheltered", "moderate", "exposed"] | None = None
    thermal_mass: Literal["low", "moderate", "high"] | None = None
    slope_position: Literal["low", "mid", "high"] | None = None
    frost_pocket_risk: Literal["low", "moderate", "high"] | None = None
    address_private: str | None = None
    edge_buffer_in: int | None = None


class MicroclimateSignalNote(BaseModel):
    value: str | None = None  # the suggested value (None if cannot determine)
    note: str  # explanation of how it was derived


class MicroclimateSuggestionOut(BaseModel):
    sun_exposure: MicroclimateSignalNote
    wind_exposure: MicroclimateSignalNote
    slope_position: MicroclimateSignalNote
    frost_pocket_risk: MicroclimateSignalNote
    orientation: MicroclimateSignalNote
    thermal_mass: MicroclimateSignalNote


class ClimateForecastDayOut(BaseModel):
    date: date
    temperature_min_f: float
    temperature_max_f: float
    precipitation_in: float


class ClimateFactorOut(BaseModel):
    key: str
    label: str
    impact: str


class ClimateRecommendationOut(BaseModel):
    key: str
    title: str
    status: str
    detail: str


class GardenClimateOut(BaseModel):
    zone: str
    microclimate_band: str
    baseline_last_spring_frost: date
    adjusted_last_spring_frost: date
    baseline_first_fall_frost: date
    adjusted_first_fall_frost: date
    last_frost_shift_days: int
    first_fall_shift_days: int
    soil_temperature_estimate_f: float
    soil_temperature_status: str
    frost_risk_next_10_days: str
    next_frost_date: date | None = None
    growing_season_days: int
    factors: list[ClimateFactorOut]
    recommendations: list[ClimateRecommendationOut]
    forecast: list[ClimateForecastDayOut]


class ClimatePlantingWindowOut(BaseModel):
    crop_template_id: int
    crop_name: str
    variety: str
    method: str
    window_start: date
    window_end: date
    status: str
    reason: str
    soil_temperature_min_f: float
    indoor_seed_start: date | None = None
    indoor_seed_end: date | None = None
    legacy_window_label: str


class GardenClimatePlantingWindowsOut(BaseModel):
    generated_on: date
    zone: str
    microclimate_band: str
    adjusted_last_spring_frost: date
    adjusted_first_fall_frost: date
    soil_temperature_estimate_f: float
    frost_risk_next_10_days: str
    windows: list[ClimatePlantingWindowOut]


class SunPathPointOut(BaseModel):
    hour_local: int
    azimuth_deg: float
    altitude_deg: float
    intensity: float


class GardenSunPathOut(BaseModel):
    generated_on: date
    target_date: date
    latitude: float
    longitude: float
    orientation: str
    sunrise_hour: float
    sunset_hour: float
    solar_noon_hour: float
    day_length_hours: float
    points: list[SunPathPointOut]


class GrowthStageOut(BaseModel):
    planting_id: int
    crop_name: str
    bed_id: int
    days_since_planting: int
    days_to_harvest: int
    progress_pct: int
    stage: str
    expected_harvest_on: date
    harvested_on: date | None = None


class RotationRecommendationOut(BaseModel):
    bed_id: int
    last_crop: str
    avoid_family: str
    recent_families: list[str]
    recommended_families: list[str]
    reason: str


class CompanionInsightOut(BaseModel):
    bed_id: int
    crop: str
    good_matches: list[str]
    risk_matches: list[str]
    reason: str


class SuccessionRecommendationOut(BaseModel):
    bed_id: int
    after_planting_id: int
    after_crop: str
    target_harvest_date: date
    recommended_crop: str
    recommended_method: str
    window_start: date
    window_end: date
    window_status: str
    reason: str


class NextPlantingOut(BaseModel):
    crop_name: str
    variety: str
    family: str
    method: str
    window_start: date
    window_end: date
    indoor_seed_start: date | None = None
    indoor_seed_end: date | None = None
    status: str
    reason: str
    priority: int


class GardenSeasonalPlanOut(BaseModel):
    generated_on: date
    garden_id: int
    zone: str
    microclimate_band: str
    soil_temperature_estimate_f: float
    frost_risk_next_10_days: str
    stage_counts: dict[str, int]
    growth_stages: list[GrowthStageOut]
    rotation_recommendations: list[RotationRecommendationOut]
    companion_insights: list[CompanionInsightOut]
    succession_recommendations: list[SuccessionRecommendationOut]
    recommended_next_plantings: list[NextPlantingOut]


class PlantingActionOut(BaseModel):
    title: str
    detail: str


class PlantingCompanionSummaryOut(BaseModel):
    good_matches: list[str]
    risk_matches: list[str]
    reason: str


class PlantingSuccessionCandidateOut(BaseModel):
    crop_name: str
    variety: str
    method: str
    window_start: date
    window_end: date
    status: str
    reason: str


class PlantingRecommendationsOut(BaseModel):
    generated_on: date
    planting_id: int
    crop_name: str
    bed_id: int
    stage: str
    progress_pct: int
    days_since_planting: int
    days_to_harvest: int
    expected_harvest_on: date
    companion: PlantingCompanionSummaryOut
    next_actions: list[PlantingActionOut]
    succession_candidates: list[PlantingSuccessionCandidateOut]


class CropTemplateCreate(BaseModel):
    name: str
    variety: str = ""
    family: str = ""
    image_url: str = ""
    spacing_in: int = 12
    row_spacing_in: int = 18
    in_row_spacing_in: int = 12
    days_to_harvest: int = 60
    planting_window: str = "Spring"
    direct_sow: bool = True
    frost_hardy: bool = False
    weeks_to_transplant: int = 6
    notes: str = ""


class CropTemplateOut(BaseModel):
    id: int
    name: str
    variety: str
    source: str
    source_url: str
    image_url: str
    external_product_id: str
    family: str
    spacing_in: int
    row_spacing_in: int
    in_row_spacing_in: int
    days_to_harvest: int
    planting_window: str
    direct_sow: bool
    frost_hardy: bool
    weeks_to_transplant: int
    notes: str

    model_config = ConfigDict(from_attributes=True)


class CropSourceConfigOut(BaseModel):
    id: int
    source_key: str
    display_name: str
    is_primary: bool
    is_enabled: bool
    priority: int

    model_config = ConfigDict(from_attributes=True)


class CropSourceConfigUpdate(BaseModel):
    is_primary: bool | None = None
    is_enabled: bool | None = None
    priority: int | None = None


class BedCreate(BaseModel):
    name: str
    width_in: int
    height_in: int
    grid_x: int = 0
    grid_y: int = 0


class BedOut(BaseModel):
    id: int
    garden_id: int
    name: str
    width_in: int
    height_in: int
    grid_x: int
    grid_y: int

    model_config = ConfigDict(from_attributes=True)


class GardenYardUpdate(BaseModel):
    yard_width_ft: int
    yard_length_ft: int


class BedPositionUpdate(BaseModel):
    grid_x: int
    grid_y: int


class BedRenameUpdate(BaseModel):
    name: str


class PlantingCreate(BaseModel):
    garden_id: int
    bed_id: int
    crop_name: str
    planted_on: date
    source: str = ""


class PlantingOut(BaseModel):
    id: int
    garden_id: int
    bed_id: int
    crop_name: str
    planted_on: date
    expected_harvest_on: date
    source: str
    harvested_on: date | None = None
    yield_notes: str = ""

    model_config = ConfigDict(from_attributes=True)


class PlantingHarvestUpdate(BaseModel):
    harvested_on: date
    yield_notes: str = ""


class TaskCreate(BaseModel):
    garden_id: int
    title: str
    due_on: date
    notes: str = ""


class TaskOut(BaseModel):
    id: int
    garden_id: int
    planting_id: int | None
    title: str
    due_on: date
    is_done: bool
    notes: str

    model_config = ConfigDict(from_attributes=True)


class TaskUpdate(BaseModel):
    is_done: bool | None = None
    title: str | None = None
    due_on: date | None = None
    notes: str | None = None


class SeedInventoryCreate(BaseModel):
    crop_name: str
    supplier: str = ""
    quantity_packets: int = 0


class SeedInventoryOut(BaseModel):
    id: int
    user_id: int
    crop_name: str
    supplier: str
    quantity_packets: int

    model_config = ConfigDict(from_attributes=True)


class PestLogCreate(BaseModel):
    garden_id: int
    title: str
    observed_on: date
    treatment: str = ""
    photo_path: str = ""


class PestLogOut(BaseModel):
    id: int
    garden_id: int
    title: str
    observed_on: date
    treatment: str
    photo_path: str

    model_config = ConfigDict(from_attributes=True)


class PlacementCreate(BaseModel):
    garden_id: int
    bed_id: int
    crop_name: str
    grid_x: int
    grid_y: int
    color: str = "#57a773"
    planted_on: date


class PlacementMove(BaseModel):
    bed_id: int
    grid_x: int
    grid_y: int


class PlacementOut(BaseModel):
    id: int
    garden_id: int
    bed_id: int
    crop_name: str
    grid_x: int
    grid_y: int
    color: str
    planted_on: date

    model_config = ConfigDict(from_attributes=True)


class SensorRegister(BaseModel):
    garden_id: int
    bed_id: int | None = None
    name: str
    sensor_kind: Literal["soil_moisture", "soil_temperature", "air_temperature", "humidity"]
    unit: str = ""
    location_label: str = ""
    hardware_id: str = ""


class SensorOut(BaseModel):
    id: int
    garden_id: int
    bed_id: int | None
    name: str
    sensor_kind: str
    unit: str
    location_label: str
    hardware_id: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SensorDataCreate(BaseModel):
    value: float
    captured_at: datetime | None = None


class SensorDataOut(BaseModel):
    id: int
    sensor_id: int
    value: float
    captured_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SensorDataBatchCreate(BaseModel):
    readings: list[SensorDataCreate]


class SensorDataBatchOut(BaseModel):
    inserted: int


class SensorSummarySensorOut(BaseModel):
    id: int
    garden_id: int
    bed_id: int | None
    name: str
    sensor_kind: str
    unit: str
    location_label: str
    hardware_id: str
    is_active: bool
    created_at: datetime
    latest_value: float | None = None
    latest_captured_at: datetime | None = None


class SensorSeriesPointOut(BaseModel):
    sensor_id: int
    sensor_name: str
    captured_at: datetime
    value: float
    unit: str


class IrrigationSuggestionOut(BaseModel):
    status: str
    title: str
    detail: str


class GardenSensorSummaryOut(BaseModel):
    generated_at: datetime
    garden_id: int
    horizon_hours: int
    sensors: list[SensorSummarySensorOut]
    soil_moisture_series: list[SensorSeriesPointOut]
    soil_temperature_series: list[SensorSeriesPointOut]
    irrigation_suggestions: list[IrrigationSuggestionOut]


class AiCoachScenarioIn(BaseModel):
    days_ahead: int = 7
    rain_outlook: Literal["dry", "normal", "wet"] = "normal"
    labor_hours: float = 2.0
    water_budget: Literal["low", "normal", "high"] = "normal"


class AiCoachRequest(BaseModel):
    garden_id: int
    message: str
    scenario: AiCoachScenarioIn | None = None


class AiCoachSuggestedActionOut(BaseModel):
    title: str
    detail: str
    priority: str
    category: str


class AiCoachScenarioOutcomeOut(BaseModel):
    title: str
    detail: str


class AiCoachResponseOut(BaseModel):
    reply: str
    context_highlights: list[str]
    suggested_actions: list[AiCoachSuggestedActionOut]
    scenario_outcomes: list[AiCoachScenarioOutcomeOut]


class TimelineEventOut(BaseModel):
    event_date: date
    title: str
    detail: str
    category: Literal["task", "weather", "planting_window", "sensor_alert", "ai_recommendation"]
    source: str
    severity: Literal["low", "medium", "high"]
    drilldown: dict[str, str | int | float | bool | None]


class GardenTimelineOut(BaseModel):
    generated_at: datetime
    events: list[TimelineEventOut]
    counts_by_category: dict[str, int]
