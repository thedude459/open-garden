ALTER TABLE garden_plantings
  ADD COLUMN IF NOT EXISTS start_method text NOT NULL DEFAULT 'direct_seed',
  ADD COLUMN IF NOT EXISTS indoor_started_on date;

ALTER TABLE garden_plantings
  DROP CONSTRAINT IF EXISTS garden_plantings_start_method_chk;

ALTER TABLE garden_plantings
  ADD CONSTRAINT garden_plantings_start_method_chk
  CHECK (start_method IN ('direct_seed', 'transplant'));

-- Leftover unsized beds: existing rows are direct_seed, so plantings on them are deleted.
DELETE FROM garden_plantings
WHERE bed_id IN (
  SELECT id FROM garden_beds
  WHERE origin_x_inches IS NULL
     OR origin_y_inches IS NULL
     OR length_inches IS NULL
     OR width_inches IS NULL
);

DELETE FROM garden_beds
WHERE origin_x_inches IS NULL
   OR origin_y_inches IS NULL
   OR length_inches IS NULL
   OR width_inches IS NULL;

CREATE TABLE IF NOT EXISTS garden_non_planting_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_normalized text NOT NULL,
  origin_x_inches integer NOT NULL,
  origin_y_inches integer NOT NULL,
  length_inches integer NOT NULL CHECK (length_inches >= 1),
  width_inches integer NOT NULL CHECK (width_inches >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT garden_non_planting_areas_garden_name_uidx UNIQUE (garden_id, name_normalized)
);

CREATE INDEX IF NOT EXISTS garden_non_planting_areas_garden_id_idx
  ON garden_non_planting_areas (garden_id);
