-- Every bed belongs to an area, and the area alone decides what it takes
-- (principle VIII). Beds from before areas have none: each goes to its
-- property's fruit garden if it has a station (a tree bed or a row),
-- otherwise to its vegetable garden, creating that area where the property
-- has none. A property with an area already using the default name gets
-- the area under a second name instead.
INSERT INTO "garden_areas" ("garden_id", "name", "name_normalized", "kind")
SELECT DISTINCT b."garden_id",
  CASE WHEN b."station" IS NULL THEN 'Vegetable garden' ELSE 'Fruit garden' END,
  CASE WHEN b."station" IS NULL THEN 'vegetable garden' ELSE 'fruit garden' END,
  CASE WHEN b."station" IS NULL THEN 'vegetable' ELSE 'fruit' END
FROM "garden_beds" b
WHERE b."area_id" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "garden_areas" a
    WHERE a."garden_id" = b."garden_id"
      AND a."kind" = CASE WHEN b."station" IS NULL THEN 'vegetable' ELSE 'fruit' END
  )
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "garden_areas" ("garden_id", "name", "name_normalized", "kind")
SELECT DISTINCT b."garden_id",
  CASE WHEN b."station" IS NULL THEN 'Vegetable garden (beds)' ELSE 'Fruit garden (beds)' END,
  CASE WHEN b."station" IS NULL THEN 'vegetable garden (beds)' ELSE 'fruit garden (beds)' END,
  CASE WHEN b."station" IS NULL THEN 'vegetable' ELSE 'fruit' END
FROM "garden_beds" b
WHERE b."area_id" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "garden_areas" a
    WHERE a."garden_id" = b."garden_id"
      AND a."kind" = CASE WHEN b."station" IS NULL THEN 'vegetable' ELSE 'fruit' END
  )
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "garden_beds" b
SET "area_id" = (
    SELECT a."id" FROM "garden_areas" a
    WHERE a."garden_id" = b."garden_id"
      AND a."kind" = CASE WHEN b."station" IS NULL THEN 'vegetable' ELSE 'fruit' END
    ORDER BY a."created_at", a."id"
    LIMIT 1
  ),
  "updated_at" = now()
WHERE b."area_id" IS NULL;--> statement-breakpoint
ALTER TABLE "garden_beds" ALTER COLUMN "area_id" SET NOT NULL;
