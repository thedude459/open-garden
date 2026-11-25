-- A planting of a perennial (asparagus, rhubarb) outlives a season by
-- default. The catalog sync fills this on the next start.
ALTER TABLE "plants" ADD COLUMN "perennial" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Orchards and bramble patches become fruit gardens (ADR 0042). Each area
-- keeps its name and its beds; tree beds and berry rows keep their stations.
UPDATE "garden_areas" SET "kind" = 'fruit', "updated_at" = now()
WHERE "kind" IN ('orchard', 'bramble');
