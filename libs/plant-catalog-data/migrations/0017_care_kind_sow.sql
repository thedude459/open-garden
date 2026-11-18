-- A "sow" reminder for a planting planned ahead (ADR 0037).
ALTER TABLE "garden_care_events" DROP CONSTRAINT "garden_care_events_kind_check";--> statement-breakpoint
ALTER TABLE "garden_care_events" ADD CONSTRAINT "garden_care_events_kind_check" CHECK ("kind" IN ('water', 'fertilize', 'harvest', 'sow'));
