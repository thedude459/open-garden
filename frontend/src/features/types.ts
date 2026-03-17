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
  is_shared: boolean;
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
  external_product_id: string;
  family: string;
  spacing_in: number;
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
