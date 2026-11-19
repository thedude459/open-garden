-- Planned or planted (ADR 0040): planned_on is the day a household means to
-- sow or plant out; planted_on is only the day it happened.
ALTER TABLE "garden_plantings" ADD COLUMN "planned_on" date;--> statement-breakpoint
-- A planting dated ahead (ADR 0037's rule: its date is more than a day after
-- it was recorded) and still in the future was planned, not planted.
UPDATE "garden_plantings"
SET "planned_on" = "planted_on", "planted_on" = NULL
WHERE "planted_on" > CURRENT_DATE
  AND "planted_on" > ("created_at"::date + 1);
