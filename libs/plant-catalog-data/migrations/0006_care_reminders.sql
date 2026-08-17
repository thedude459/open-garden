ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS water_interval_days integer,
  ADD COLUMN IF NOT EXISTS fertilize_interval_days integer;

CREATE TABLE IF NOT EXISTS garden_care_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_id uuid NOT NULL REFERENCES garden_plantings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('water', 'fertilize', 'harvest')),
  occurrence_on date NOT NULL,
  action text NOT NULL CHECK (action IN ('completed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT garden_care_events_occurrence_uidx UNIQUE (planting_id, kind, occurrence_on)
);

CREATE INDEX IF NOT EXISTS garden_care_events_planting_id_idx ON garden_care_events (planting_id);
