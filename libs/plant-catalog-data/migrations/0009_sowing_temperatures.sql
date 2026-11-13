ALTER TABLE "gardens" ADD COLUMN "monthly_mean_c" real[];--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "grow_min_c" real;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "grow_max_c" real;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "sow_soil_min_c" real;