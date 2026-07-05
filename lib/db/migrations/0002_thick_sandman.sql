CREATE TYPE "public"."garden_zone_type" AS ENUM('vegetable_garden', 'orchard', 'container_patio');--> statement-breakpoint
CREATE TYPE "public"."illustration_category" AS ENUM('vegetable', 'herb', 'fruit', 'tree', 'flower', 'default');--> statement-breakpoint
CREATE TYPE "public"."structure_category" AS ENUM('bed_frame', 'container', 'protection', 'vertical', 'access', 'amenity', 'other');--> statement-breakpoint
CREATE TABLE "garden_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"structure_type_id" uuid NOT NULL,
	"origin_x" numeric(10, 2) NOT NULL,
	"origin_y" numeric(10, 2) NOT NULL,
	"length" numeric(10, 2) NOT NULL,
	"width" numeric(10, 2) NOT NULL,
	"rotation_degrees" smallint DEFAULT 0 NOT NULL,
	"z_index" integer DEFAULT 0 NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "illustration_category_defaults" (
	"category" "illustration_category" PRIMARY KEY NOT NULL,
	"illustration_path" varchar(256) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text NOT NULL,
	"zone_type" "garden_zone_type" NOT NULL,
	"preview_image_path" varchar(256) NOT NULL,
	"layout_snapshot" jsonb NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "plan_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plant_illustrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_plant_id" uuid NOT NULL,
	"illustration_path" varchar(256) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plant_illustrations_canonical_plant_id_unique" UNIQUE("canonical_plant_id")
);
--> statement-breakpoint
CREATE TABLE "structure_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"category" "structure_category" NOT NULL,
	"default_length" numeric(10, 2) NOT NULL,
	"default_width" numeric(10, 2) NOT NULL,
	"illustration_path" varchar(256) NOT NULL,
	"environment_tag" varchar(32),
	"allowed_zone_types" "garden_zone_type"[] NOT NULL,
	CONSTRAINT "structure_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "gardens" ADD COLUMN "zone_type" "garden_zone_type" DEFAULT 'vegetable_garden' NOT NULL;--> statement-breakpoint
ALTER TABLE "gardens" ADD COLUMN "thumbnail_key" varchar(256);--> statement-breakpoint
ALTER TABLE "gardens" ADD COLUMN "visual_version" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plant_placements" ADD COLUMN "rootstock_id" uuid;--> statement-breakpoint
ALTER TABLE "plant_placements" ADD COLUMN "z_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "plant_placements" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "garden_structures" ADD CONSTRAINT "garden_structures_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garden_structures" ADD CONSTRAINT "garden_structures_structure_type_id_structure_types_id_fk" FOREIGN KEY ("structure_type_id") REFERENCES "public"."structure_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_illustrations" ADD CONSTRAINT "plant_illustrations_canonical_plant_id_canonical_plants_id_fk" FOREIGN KEY ("canonical_plant_id") REFERENCES "public"."canonical_plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garden_structures_garden_id_idx" ON "garden_structures" USING btree ("garden_id");--> statement-breakpoint
ALTER TABLE "plant_placements" ADD CONSTRAINT "plant_placements_rootstock_id_rootstock_options_id_fk" FOREIGN KEY ("rootstock_id") REFERENCES "public"."rootstock_options"("id") ON DELETE set null ON UPDATE no action;