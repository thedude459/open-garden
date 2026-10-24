CREATE TABLE IF NOT EXISTS garden_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_normalized text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT garden_areas_kind_chk CHECK (kind IN ('vegetable', 'orchard', 'greenhouse'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS garden_areas_garden_name_uidx ON garden_areas (garden_id, name_normalized);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS garden_areas_garden_id_idx ON garden_areas (garden_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS garden_trays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES garden_areas(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_normalized text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS garden_trays_area_name_uidx ON garden_trays (area_id, name_normalized);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS garden_trays_garden_id_idx ON garden_trays (garden_id);
--> statement-breakpoint
INSERT INTO garden_areas (garden_id, name, name_normalized, kind)
SELECT g.id, 'Vegetable garden', 'vegetable garden', 'vegetable'
FROM gardens g
WHERE NOT EXISTS (
  SELECT 1 FROM garden_areas a WHERE a.garden_id = g.id AND a.kind = 'vegetable'
);
--> statement-breakpoint
ALTER TABLE garden_beds ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES garden_areas(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE garden_beds ADD COLUMN IF NOT EXISTS site text NOT NULL DEFAULT 'in_ground';
--> statement-breakpoint
ALTER TABLE garden_beds ADD COLUMN IF NOT EXISTS station text;
--> statement-breakpoint
ALTER TABLE garden_beds ADD COLUMN IF NOT EXISTS mulch text NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE garden_beds DROP CONSTRAINT IF EXISTS garden_beds_site_chk;
--> statement-breakpoint
ALTER TABLE garden_beds
  ADD CONSTRAINT garden_beds_site_chk CHECK (site IN ('raised', 'in_ground'));
--> statement-breakpoint
ALTER TABLE garden_beds DROP CONSTRAINT IF EXISTS garden_beds_station_chk;
--> statement-breakpoint
ALTER TABLE garden_beds
  ADD CONSTRAINT garden_beds_station_chk CHECK (station IS NULL OR station IN ('tree', 'berry'));
--> statement-breakpoint
ALTER TABLE garden_beds DROP CONSTRAINT IF EXISTS garden_beds_mulch_chk;
--> statement-breakpoint
ALTER TABLE garden_beds
  ADD CONSTRAINT garden_beds_mulch_chk CHECK (mulch IN ('none', 'wood_chips', 'straw', 'leaves', 'compost', 'paper', 'plastic'));
--> statement-breakpoint
UPDATE garden_beds b
SET area_id = a.id
FROM garden_areas a
WHERE b.area_id IS NULL
  AND b.kind = 'bed'
  AND a.garden_id = b.garden_id
  AND a.kind = 'vegetable';
--> statement-breakpoint
INSERT INTO garden_areas (garden_id, name, name_normalized, kind)
SELECT DISTINCT b.garden_id, 'Orchard', 'orchard', 'orchard'
FROM garden_beds b
WHERE b.kind = 'orchard'
  AND NOT EXISTS (
    SELECT 1 FROM garden_areas a WHERE a.garden_id = b.garden_id AND a.kind = 'orchard'
  );
--> statement-breakpoint
INSERT INTO garden_beds (
  garden_id, name, name_normalized,
  origin_x_inches, origin_y_inches, length_inches, width_inches, orientation,
  kind, area_id, site, station, mulch
)
SELECT
  p.garden_id,
  CASE WHEN pl.plant_type = 'shrub' THEN 'Berry ' ELSE 'Tree ' END || left(p.id::text, 8),
  'station-' || p.id::text,
  COALESCE(b.origin_x_inches, 0),
  COALESCE(b.origin_y_inches, 0),
  COALESCE(b.length_inches, 96),
  COALESCE(b.width_inches, 96),
  COALESCE(b.orientation, 0),
  'bed',
  a.id,
  'in_ground',
  CASE WHEN pl.plant_type = 'shrub' THEN 'berry' ELSE 'tree' END,
  'none'
FROM garden_plantings p
JOIN garden_beds b ON b.id = p.bed_id AND b.kind = 'orchard'
JOIN plants pl ON pl.id = p.plant_id
JOIN garden_areas a ON a.garden_id = p.garden_id AND a.kind = 'orchard';
--> statement-breakpoint
UPDATE garden_plantings p
SET bed_id = nb.id
FROM garden_beds nb
WHERE nb.name_normalized = 'station-' || p.id::text;
--> statement-breakpoint
DELETE FROM garden_beds WHERE kind = 'orchard';
--> statement-breakpoint
ALTER TABLE garden_plantings
  ADD COLUMN IF NOT EXISTS tray_id uuid REFERENCES garden_trays(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS garden_plantings_tray_id_idx ON garden_plantings (tray_id);
