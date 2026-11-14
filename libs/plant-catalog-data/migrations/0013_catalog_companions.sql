CREATE TABLE "catalog_companions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crop_id" text NOT NULL,
	"other_crop_id" text NOT NULL,
	"kind" text NOT NULL,
	"benefits" text[] NOT NULL,
	"evidence" text NOT NULL,
	"reason" text NOT NULL,
	"reference" text,
	"shown_in" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "crop_id" text;--> statement-breakpoint
CREATE INDEX "catalog_companions_crop_id_idx" ON "catalog_companions" USING btree ("crop_id");--> statement-breakpoint
CREATE INDEX "catalog_companions_other_crop_id_idx" ON "catalog_companions" USING btree ("other_crop_id");