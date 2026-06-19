CREATE TYPE "public"."bed_sun_exposure" AS ENUM('full_sun', 'partial_shade', 'full_shade');--> statement-breakpoint
CREATE TYPE "public"."garden_area_type" AS ENUM('bed', 'path');--> statement-breakpoint
CREATE TYPE "public"."indoor_start_status" AS ENUM('active', 'transplanted', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."measurement_unit" AS ENUM('feet', 'meters');--> statement-breakpoint
CREATE TYPE "public"."placement_status" AS ENUM('direct_seeded', 'transplanted');--> statement-breakpoint
CREATE TYPE "public"."soil_type" AS ENUM('sand', 'loamy_sand', 'sandy_loam', 'loam', 'silt_loam', 'silt', 'sandy_clay_loam', 'clay_loam', 'silty_clay_loam', 'sandy_clay', 'silty_clay', 'clay');--> statement-breakpoint
CREATE TABLE "bed_planting_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"bed_area_id" uuid NOT NULL,
	"canonical_plant_id" uuid,
	"provisional_plant_id" uuid,
	"rotation_group" varchar(64),
	"botanical_family" varchar(128),
	"planted_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bed_history_plant_ref_check" CHECK ((canonical_plant_id IS NOT NULL AND provisional_plant_id IS NULL) OR (canonical_plant_id IS NULL AND provisional_plant_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "garden_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"area_type" "garden_area_type" NOT NULL,
	"name" varchar(128),
	"origin_x" numeric(10, 2) NOT NULL,
	"origin_y" numeric(10, 2) NOT NULL,
	"length" numeric(10, 2) NOT NULL,
	"width" numeric(10, 2) NOT NULL,
	"rotation_degrees" smallint DEFAULT 0 NOT NULL,
	"soil_type" "soil_type",
	"sun_exposure" "bed_sun_exposure",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gardens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"length" numeric(10, 2) NOT NULL,
	"width" numeric(10, 2) NOT NULL,
	"unit" "measurement_unit" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indoor_starts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"target_bed_area_id" uuid,
	"canonical_plant_id" uuid,
	"provisional_plant_id" uuid,
	"started_on" date NOT NULL,
	"status" "indoor_start_status" DEFAULT 'active' NOT NULL,
	"transplanted_placement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indoor_starts_plant_ref_check" CHECK ((canonical_plant_id IS NOT NULL AND provisional_plant_id IS NULL) OR (canonical_plant_id IS NULL AND provisional_plant_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "plant_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"bed_area_id" uuid NOT NULL,
	"canonical_plant_id" uuid,
	"provisional_plant_id" uuid,
	"position_x" numeric(10, 2) NOT NULL,
	"position_y" numeric(10, 2) NOT NULL,
	"status" "placement_status" NOT NULL,
	"planted_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plant_placements_plant_ref_check" CHECK ((canonical_plant_id IS NOT NULL AND provisional_plant_id IS NULL) OR (canonical_plant_id IS NULL AND provisional_plant_id IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "bed_planting_history" ADD CONSTRAINT "bed_planting_history_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bed_planting_history" ADD CONSTRAINT "bed_planting_history_bed_area_id_garden_areas_id_fk" FOREIGN KEY ("bed_area_id") REFERENCES "public"."garden_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bed_planting_history" ADD CONSTRAINT "bed_planting_history_canonical_plant_id_canonical_plants_id_fk" FOREIGN KEY ("canonical_plant_id") REFERENCES "public"."canonical_plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bed_planting_history" ADD CONSTRAINT "bed_planting_history_provisional_plant_id_user_provisional_plants_id_fk" FOREIGN KEY ("provisional_plant_id") REFERENCES "public"."user_provisional_plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_areas" ADD CONSTRAINT "garden_areas_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gardens" ADD CONSTRAINT "gardens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indoor_starts" ADD CONSTRAINT "indoor_starts_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indoor_starts" ADD CONSTRAINT "indoor_starts_target_bed_area_id_garden_areas_id_fk" FOREIGN KEY ("target_bed_area_id") REFERENCES "public"."garden_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indoor_starts" ADD CONSTRAINT "indoor_starts_canonical_plant_id_canonical_plants_id_fk" FOREIGN KEY ("canonical_plant_id") REFERENCES "public"."canonical_plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indoor_starts" ADD CONSTRAINT "indoor_starts_provisional_plant_id_user_provisional_plants_id_fk" FOREIGN KEY ("provisional_plant_id") REFERENCES "public"."user_provisional_plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indoor_starts" ADD CONSTRAINT "indoor_starts_transplanted_placement_id_plant_placements_id_fk" FOREIGN KEY ("transplanted_placement_id") REFERENCES "public"."plant_placements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_placements" ADD CONSTRAINT "plant_placements_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_placements" ADD CONSTRAINT "plant_placements_bed_area_id_garden_areas_id_fk" FOREIGN KEY ("bed_area_id") REFERENCES "public"."garden_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_placements" ADD CONSTRAINT "plant_placements_canonical_plant_id_canonical_plants_id_fk" FOREIGN KEY ("canonical_plant_id") REFERENCES "public"."canonical_plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_placements" ADD CONSTRAINT "plant_placements_provisional_plant_id_user_provisional_plants_id_fk" FOREIGN KEY ("provisional_plant_id") REFERENCES "public"."user_provisional_plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bed_history_bed_planted_idx" ON "bed_planting_history" USING btree ("bed_area_id","planted_on");--> statement-breakpoint
CREATE INDEX "bed_history_garden_id_idx" ON "bed_planting_history" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "garden_areas_garden_id_idx" ON "garden_areas" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "gardens_user_id_idx" ON "gardens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gardens_user_updated_idx" ON "gardens" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "indoor_starts_garden_status_idx" ON "indoor_starts" USING btree ("garden_id","status");--> statement-breakpoint
CREATE INDEX "indoor_starts_target_bed_idx" ON "indoor_starts" USING btree ("target_bed_area_id");--> statement-breakpoint
CREATE INDEX "plant_placements_garden_id_idx" ON "plant_placements" USING btree ("garden_id");--> statement-breakpoint
CREATE INDEX "plant_placements_bed_area_id_idx" ON "plant_placements" USING btree ("bed_area_id");