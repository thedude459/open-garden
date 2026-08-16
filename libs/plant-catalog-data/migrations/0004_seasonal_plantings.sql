CREATE TABLE IF NOT EXISTS garden_beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id UUID NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS garden_beds_garden_name_uidx
  ON garden_beds (garden_id, name_normalized);
CREATE INDEX IF NOT EXISTS garden_beds_garden_id_idx
  ON garden_beds (garden_id);

CREATE TABLE IF NOT EXISTS garden_plantings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id UUID NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
  bed_id UUID REFERENCES garden_beds(id) ON DELETE SET NULL,
  planted_on DATE,
  harvested_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_mutation_id TEXT
);

CREATE INDEX IF NOT EXISTS garden_plantings_garden_created_idx
  ON garden_plantings (garden_id, created_at DESC);
CREATE INDEX IF NOT EXISTS garden_plantings_bed_id_idx
  ON garden_plantings (bed_id);
CREATE INDEX IF NOT EXISTS garden_plantings_plant_id_idx
  ON garden_plantings (plant_id);
