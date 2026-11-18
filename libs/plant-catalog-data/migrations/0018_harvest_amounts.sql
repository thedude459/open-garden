ALTER TABLE "garden_planting_harvests" ADD COLUMN "grams" integer;--> statement-breakpoint
ALTER TABLE "garden_planting_harvests" ADD COLUMN "count" integer;--> statement-breakpoint
ALTER TABLE "garden_planting_harvests" ADD CONSTRAINT "garden_planting_harvests_amounts" CHECK ("garden_planting_harvests"."grams" >= 0 AND "garden_planting_harvests"."count" >= 0);