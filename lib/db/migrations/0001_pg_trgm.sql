CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "canonical_plants_common_name_trgm_idx" ON "canonical_plants" USING gin ("common_name" gin_trgm_ops);
