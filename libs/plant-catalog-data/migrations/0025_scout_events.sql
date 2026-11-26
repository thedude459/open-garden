CREATE TABLE "garden_scout_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bed_id" uuid NOT NULL,
	"occurrence_on" date NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garden_scout_events" ADD CONSTRAINT "garden_scout_events_bed_id_garden_beds_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."garden_beds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "garden_scout_events_occurrence_uidx" ON "garden_scout_events" USING btree ("bed_id","occurrence_on");