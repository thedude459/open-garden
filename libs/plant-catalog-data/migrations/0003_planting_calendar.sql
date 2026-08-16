ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS indoor_frost_anchor TEXT,
  ADD COLUMN IF NOT EXISTS indoor_weeks_earliest INTEGER,
  ADD COLUMN IF NOT EXISTS indoor_weeks_latest INTEGER,
  ADD COLUMN IF NOT EXISTS sow_frost_anchor TEXT,
  ADD COLUMN IF NOT EXISTS sow_weeks_earliest INTEGER,
  ADD COLUMN IF NOT EXISTS sow_weeks_latest INTEGER,
  ADD COLUMN IF NOT EXISTS transplant_frost_anchor TEXT,
  ADD COLUMN IF NOT EXISTS transplant_weeks_earliest INTEGER,
  ADD COLUMN IF NOT EXISTS transplant_weeks_latest INTEGER;

CREATE TABLE IF NOT EXISTS garden_calendar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id UUID NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS garden_calendar_entries_garden_plant_uidx
  ON garden_calendar_entries (garden_id, plant_id);
CREATE INDEX IF NOT EXISTS garden_calendar_entries_garden_id_idx
  ON garden_calendar_entries (garden_id);
