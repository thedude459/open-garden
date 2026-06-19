CREATE TYPE "public"."plant_category" AS ENUM('vegetable', 'herb', 'fruit', 'berry', 'fruit_tree', 'nut_tree', 'shrub', 'cover_crop', 'companion_flower', 'guild_plant');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('trefle', 'perenual');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('authoritative', 'stub', 'merged');--> statement-breakpoint
CREATE TYPE "public"."sun_exposure" AS ENUM('full', 'partial', 'shade');--> statement-breakpoint
CREATE TYPE "public"."relationship_source" AS ENUM('curated');--> statement-breakpoint
CREATE TYPE "public"."relationship_type" AS ENUM('companion', 'incompatible');--> statement-breakpoint
CREATE TYPE "public"."vigor" AS ENUM('dwarf', 'semi_dwarf', 'standard', 'vigorous');--> statement-breakpoint
CREATE TYPE "public"."link_status" AS ENUM('provisional', 'link_offered', 'linked');--> statement-breakpoint
CREATE TYPE "public"."sync_provider" AS ENUM('trefle', 'perenual', 'reference_seed');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "canonical_plants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_status" "record_status" DEFAULT 'authoritative' NOT NULL,
	"botanical_name" varchar(255),
	"common_name" varchar(255) NOT NULL,
	"variety" varchar(255),
	"plant_category" "plant_category" NOT NULL,
	"days_to_maturity" smallint,
	"seed_start_window" jsonb,
	"transplant_rules" jsonb,
	"direct_seed_rules" jsonb,
	"spacing_cm" jsonb,
	"sun_exposure" "sun_exposure",
	"watering_needs" jsonb,
	"fertilizer_needs" varchar(1024),
	"fertilizer_data_gap" boolean DEFAULT false,
	"pest_disease_notes" jsonb,
	"harvest_window" jsonb,
	"hardiness_min_zone" smallint,
	"hardiness_max_zone" smallint,
	"data_completeness" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_plant_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"provider" "provider" NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"raw_payload" jsonb,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plant_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_plant_id" uuid NOT NULL,
	"target_plant_id" uuid NOT NULL,
	"relationship_type" "relationship_type" NOT NULL,
	"source" "relationship_source" DEFAULT 'curated' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "rootstock_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"vigor" "vigor" NOT NULL,
	"mature_height_cm" smallint,
	"mature_spread_cm" smallint,
	"spacing_cm" smallint,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "user_garden_plant_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plant_id" uuid NOT NULL,
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"city_or_postal" varchar(64) NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"usda_zone" smallint,
	"last_frost_date" date,
	"first_frost_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_locations_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_provisional_plants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"common_name" varchar(255) NOT NULL,
	"plant_category" "plant_category" NOT NULL,
	"spacing_cm" jsonb NOT NULL,
	"days_to_maturity" smallint NOT NULL,
	"optional_fields" jsonb,
	"linked_canonical_id" uuid,
	"link_status" "link_status" DEFAULT 'provisional' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_recently_viewed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plant_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"provider" "sync_provider" NOT NULL,
	"records_upserted" integer DEFAULT 0,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "provider_plant_sources" ADD CONSTRAINT "provider_plant_sources_plant_id_canonical_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."canonical_plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_relationships" ADD CONSTRAINT "plant_relationships_source_plant_id_canonical_plants_id_fk" FOREIGN KEY ("source_plant_id") REFERENCES "public"."canonical_plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_relationships" ADD CONSTRAINT "plant_relationships_target_plant_id_canonical_plants_id_fk" FOREIGN KEY ("target_plant_id") REFERENCES "public"."canonical_plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rootstock_options" ADD CONSTRAINT "rootstock_options_plant_id_canonical_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."canonical_plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_garden_plant_refs" ADD CONSTRAINT "user_garden_plant_refs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_garden_plant_refs" ADD CONSTRAINT "user_garden_plant_refs_plant_id_canonical_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."canonical_plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_provisional_plants" ADD CONSTRAINT "user_provisional_plants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_provisional_plants" ADD CONSTRAINT "user_provisional_plants_linked_canonical_id_canonical_plants_id_fk" FOREIGN KEY ("linked_canonical_id") REFERENCES "public"."canonical_plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recently_viewed" ADD CONSTRAINT "user_recently_viewed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recently_viewed" ADD CONSTRAINT "user_recently_viewed_plant_id_canonical_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."canonical_plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_external_unique" ON "provider_plant_sources" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_unique" ON "plant_relationships" USING btree ("source_plant_id","target_plant_id","relationship_type");--> statement-breakpoint
CREATE UNIQUE INDEX "user_garden_plant_unique" ON "user_garden_plant_refs" USING btree ("user_id","plant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_plant_view_unique" ON "user_recently_viewed" USING btree ("user_id","plant_id");