ALTER TABLE garden_beds
  ADD COLUMN IF NOT EXISTS sun text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'bed';
--> statement-breakpoint
ALTER TABLE garden_beds DROP CONSTRAINT IF EXISTS garden_beds_sun_chk;
--> statement-breakpoint
ALTER TABLE garden_beds
  ADD CONSTRAINT garden_beds_sun_chk CHECK (sun IS NULL OR sun IN ('full', 'part', 'shade'));
--> statement-breakpoint
ALTER TABLE garden_beds DROP CONSTRAINT IF EXISTS garden_beds_kind_chk;
--> statement-breakpoint
ALTER TABLE garden_beds
  ADD CONSTRAINT garden_beds_kind_chk CHECK (kind IN ('bed', 'orchard'));
--> statement-breakpoint
ALTER TABLE garden_plantings
  ADD COLUMN IF NOT EXISTS season_year integer NOT NULL DEFAULT (EXTRACT(YEAR FROM CURRENT_DATE))::int,
  ADD COLUMN IF NOT EXISTS life text NOT NULL DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS photo text,
  ADD COLUMN IF NOT EXISTS planted_year integer,
  ADD COLUMN IF NOT EXISTS rootstock text,
  ADD COLUMN IF NOT EXISTS years_to_fruit integer,
  ADD COLUMN IF NOT EXISTS spacing_feet integer;
--> statement-breakpoint
ALTER TABLE garden_plantings DROP CONSTRAINT IF EXISTS garden_plantings_life_chk;
--> statement-breakpoint
ALTER TABLE garden_plantings
  ADD CONSTRAINT garden_plantings_life_chk CHECK (life IN ('annual', 'perennial', 'tree'));
--> statement-breakpoint
ALTER TABLE garden_plantings DROP CONSTRAINT IF EXISTS garden_plantings_note_chk;
--> statement-breakpoint
ALTER TABLE garden_plantings
  ADD CONSTRAINT garden_plantings_note_chk CHECK (note IS NULL OR char_length(note) <= 2000);
--> statement-breakpoint
ALTER TABLE garden_plantings DROP CONSTRAINT IF EXISTS garden_plantings_photo_chk;
--> statement-breakpoint
ALTER TABLE garden_plantings
  ADD CONSTRAINT garden_plantings_photo_chk CHECK (photo IS NULL OR char_length(photo) <= 400000);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS garden_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  year integer NOT NULL,
  status text NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  CONSTRAINT garden_seasons_status_chk CHECK (status IN ('open', 'closed')),
  CONSTRAINT garden_seasons_year_chk CHECK (year BETWEEN 1900 AND 2500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS garden_seasons_garden_year_uidx ON garden_seasons (garden_id, year);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS garden_planting_harvests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_id uuid NOT NULL REFERENCES garden_plantings(id) ON DELETE CASCADE,
  harvested_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS garden_planting_harvests_uidx ON garden_planting_harvests (planting_id, harvested_on);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS garden_planting_harvests_planting_id_idx ON garden_planting_harvests (planting_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS companion_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garden_id uuid NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  other_plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companion_pairs_kind_chk CHECK (kind IN ('helps', 'hinders', 'pollinates')),
  CONSTRAINT companion_pairs_distinct_chk CHECK (plant_id <> other_plant_id),
  CONSTRAINT companion_pairs_reason_chk CHECK (char_length(reason) BETWEEN 1 AND 280)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS companion_pairs_uidx ON companion_pairs (garden_id, plant_id, other_plant_id, kind);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS companion_pairs_garden_id_idx ON companion_pairs (garden_id);
