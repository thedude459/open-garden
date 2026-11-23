-- Calendar picks become planned plantings (ADR 0040): each crop on a
-- property's calendar with no planting in its current season gets one, with
-- no bed and no date, and the separate list goes.
WITH current_season AS (
  SELECT g.id AS garden_id,
    COALESCE(
      (SELECT s.year FROM garden_seasons s
        WHERE s.garden_id = g.id AND s.status = 'open'
        ORDER BY s.year DESC LIMIT 1),
      EXTRACT(YEAR FROM CURRENT_DATE)::int
    ) AS year,
    NOT EXISTS (
      SELECT 1 FROM garden_seasons s WHERE s.garden_id = g.id AND s.status = 'open'
    ) AS never_closed
  FROM gardens g
)
INSERT INTO "garden_plantings" ("garden_id", "plant_id", "season_year", "life")
SELECT e.garden_id, e.plant_id, c.year,
  CASE p.plant_type
    WHEN 'tree' THEN 'tree'
    WHEN 'cane' THEN 'perennial'
    WHEN 'shrub' THEN 'perennial'
    ELSE 'annual'
  END
FROM "garden_calendar_entries" e
JOIN current_season c ON c.garden_id = e.garden_id
JOIN "plants" p ON p.id = e.plant_id
WHERE NOT EXISTS (
  SELECT 1 FROM "garden_plantings" gp
  WHERE gp.garden_id = e.garden_id AND gp.plant_id = e.plant_id
    AND (
      gp.life <> 'annual'
      OR gp.season_year = c.year
      OR (c.never_closed AND gp.season_year < c.year)
    )
);--> statement-breakpoint
DROP TABLE "garden_calendar_entries" CASCADE;
