ALTER TABLE garden_beds
  ADD COLUMN IF NOT EXISTS origin_x_inches INTEGER,
  ADD COLUMN IF NOT EXISTS origin_y_inches INTEGER,
  ADD COLUMN IF NOT EXISTS length_inches INTEGER,
  ADD COLUMN IF NOT EXISTS width_inches INTEGER,
  ADD COLUMN IF NOT EXISTS orientation SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE garden_plantings
  ADD COLUMN IF NOT EXISTS layout_x_inches INTEGER,
  ADD COLUMN IF NOT EXISTS layout_y_inches INTEGER;

ALTER TABLE garden_beds DROP CONSTRAINT IF EXISTS garden_beds_geometry_ck;
ALTER TABLE garden_beds ADD CONSTRAINT garden_beds_geometry_ck CHECK (
  (
    origin_x_inches IS NULL
    AND origin_y_inches IS NULL
    AND length_inches IS NULL
    AND width_inches IS NULL
  )
  OR (
    origin_x_inches IS NOT NULL
    AND origin_y_inches IS NOT NULL
    AND length_inches IS NOT NULL
    AND width_inches IS NOT NULL
    AND length_inches >= 1
    AND width_inches >= 1
    AND orientation IN (0, 90, 180, 270)
  )
);

ALTER TABLE garden_plantings DROP CONSTRAINT IF EXISTS garden_plantings_layout_ck;
ALTER TABLE garden_plantings ADD CONSTRAINT garden_plantings_layout_ck CHECK (
  (layout_x_inches IS NULL AND layout_y_inches IS NULL)
  OR (layout_x_inches IS NOT NULL AND layout_y_inches IS NOT NULL)
);
