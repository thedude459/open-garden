ALTER TABLE gardens
  ADD COLUMN IF NOT EXISTS length_inches integer NOT NULL DEFAULT 240,
  ADD COLUMN IF NOT EXISTS width_inches integer NOT NULL DEFAULT 120;
--> statement-breakpoint
ALTER TABLE gardens DROP CONSTRAINT IF EXISTS gardens_size_chk;
--> statement-breakpoint
ALTER TABLE gardens
  ADD CONSTRAINT gardens_size_chk
  CHECK (length_inches BETWEEN 6 AND 2400 AND width_inches BETWEEN 6 AND 2400);
