CREATE TABLE "catalog_pests" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] NOT NULL,
	"scientific_name" text,
	"kind" text NOT NULL,
	"crops" text[] NOT NULL,
	"signs" text NOT NULL,
	"scout_stages" text[] NOT NULL,
	"controls" jsonb NOT NULL,
	"occurs_in" text[],
	"regions" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gardens" ADD COLUMN "country_code" text;--> statement-breakpoint
CREATE INDEX "catalog_pests_crops_idx" ON "catalog_pests" USING gin ("crops");