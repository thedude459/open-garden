CREATE TABLE "garden_ignored_pests" (
	"garden_id" uuid NOT NULL,
	"pest_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garden_ignored_pests_garden_id_pest_id_pk" PRIMARY KEY("garden_id","pest_id")
);
--> statement-breakpoint
ALTER TABLE "garden_ignored_pests" ADD CONSTRAINT "garden_ignored_pests_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;