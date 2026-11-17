CREATE TABLE "garden_soil_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area_id" uuid,
	"bed_id" uuid,
	"tested_on" date NOT NULL,
	"lab" text,
	"ph" real,
	"organic_matter_pct" real,
	"nitrogen" text,
	"phosphorus" text,
	"potassium" text,
	"recommendations" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garden_soil_tests_one_owner" CHECK (num_nonnulls("garden_soil_tests"."area_id", "garden_soil_tests"."bed_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "garden_soil_tests" ADD CONSTRAINT "garden_soil_tests_area_id_garden_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."garden_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_soil_tests" ADD CONSTRAINT "garden_soil_tests_bed_id_garden_beds_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."garden_beds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garden_soil_tests_area_id_idx" ON "garden_soil_tests" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "garden_soil_tests_bed_id_idx" ON "garden_soil_tests" USING btree ("bed_id");