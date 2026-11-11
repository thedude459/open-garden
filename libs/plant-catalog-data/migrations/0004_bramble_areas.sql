-- Area kinds are checked in code against one list (AREA_KINDS in shared
-- types), so a new kind needs no migration.
ALTER TABLE "garden_areas" DROP CONSTRAINT IF EXISTS "garden_areas_kind_chk";--> statement-breakpoint

-- Berry beds move from orchards to a bramble patch of their own.
INSERT INTO "garden_areas" ("garden_id", "name", "name_normalized", "kind")
SELECT DISTINCT b."garden_id", 'Bramble patch', 'bramble patch', 'bramble'
FROM "garden_beds" b
WHERE b."station" = 'berry'
  AND NOT EXISTS (
    SELECT 1 FROM "garden_areas" a WHERE a."garden_id" = b."garden_id" AND a."kind" = 'bramble'
  )
ON CONFLICT DO NOTHING;--> statement-breakpoint

UPDATE "garden_beds" b
SET "area_id" = a."id", "updated_at" = now()
FROM "garden_areas" a
WHERE b."station" = 'berry'
  AND a."garden_id" = b."garden_id"
  AND a."kind" = 'bramble'
  AND a."id" = (
    SELECT min(x."id"::text)::uuid FROM "garden_areas" x
    WHERE x."garden_id" = b."garden_id" AND x."kind" = 'bramble'
  );--> statement-breakpoint

-- A bed's station follows its area, so the planner and the API apply the
-- same area rules.
UPDATE "garden_beds" b
SET "station" = CASE a."kind" WHEN 'orchard' THEN 'tree' WHEN 'bramble' THEN 'berry' END
FROM "garden_areas" a
WHERE a."id" = b."area_id"
  AND b."station" IS DISTINCT FROM
    (CASE a."kind" WHEN 'orchard' THEN 'tree' WHEN 'bramble' THEN 'berry' END);--> statement-breakpoint

-- garden_beds.kind predates areas; nothing reads it.
ALTER TABLE "garden_beds" DROP COLUMN "kind";
