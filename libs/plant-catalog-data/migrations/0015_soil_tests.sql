CREATE TABLE "garden_bed_soil_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bed_id" uuid NOT NULL,
	"tested_on" date NOT NULL,
	"lab" text,
	"ph" real,
	"organic_matter_pct" real,
	"nitrogen" text,
	"phosphorus" text,
	"potassium" text,
	"recommendations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garden_bed_soil_tests" ADD CONSTRAINT "garden_bed_soil_tests_bed_id_garden_beds_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."garden_beds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garden_bed_soil_tests_bed_id_idx" ON "garden_bed_soil_tests" USING btree ("bed_id");