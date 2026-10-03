ALTER TABLE gardens
  ADD COLUMN IF NOT EXISTS formatted_address text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS place_id text;
--> statement-breakpoint
ALTER TABLE gardens DROP CONSTRAINT IF EXISTS gardens_place_chk;
--> statement-breakpoint
ALTER TABLE gardens
  ADD CONSTRAINT gardens_place_chk CHECK (
    (
      formatted_address IS NULL
      AND latitude IS NULL
      AND longitude IS NULL
      AND place_id IS NULL
    )
    OR (
      formatted_address IS NOT NULL
      AND char_length(formatted_address) BETWEEN 1 AND 300
      AND latitude IS NOT NULL
      AND latitude BETWEEN -90 AND 90
      AND longitude IS NOT NULL
      AND longitude BETWEEN -180 AND 180
      AND place_id IS NOT NULL
      AND char_length(place_id) BETWEEN 1 AND 300
    )
  );
