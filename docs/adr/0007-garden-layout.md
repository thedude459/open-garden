# ADR 0007: Garden layout as bed-local geometry on planting rows

## Status

Accepted

## Context

Seasonal Plantings (004) give a garden named beds and planting records without
size or map position. Gardeners need a to-scale plan: rectangular beds, place
those plantings, and check catalog spacing. Clarify 2026-08-16: placements stay
attached when a bed moves or rotates 90°; bed delete needs in-page confirm;
save is refused while spacing or fit flags exist; too-close is center-to-center
using the larger catalog spacing.

A stored layout with flags would make “last successful save” lie. Incremental
PATCH of one bed cannot express “resize and unplace in one save.”

## Decision

1. Add nullable geometry on `garden_beds` and nullable bed-local `layout_x` /
   `layout_y` on `garden_plantings` (migration `0005_garden_layout.sql`). No
   separate layout document table.
2. Domain rules live in `libs/garden-layout`. AuthZ reuses garden membership
   (ADR 0004). Catalog spacing is `plants.spacing_inches` (no provider calls).
3. `PUT /api/gardens/:id/layout` applies a full geometry+placement snapshot in
   one transaction. `evaluateLayout` must report zero blocking flags or the PUT
   returns 422 and writes nothing.
4. Placement coordinates are **bed-local**. Orientation is `0|90|180|270` on
   the bed. Rotate does not rewrite placement rows.
5. Layout mutations are online-only. IndexedDB caches the last successful GET
   for offline read. Unplace clears x/y only; bed delete (004) unassigns and
   unplaces. Calendar plans and favorites are not layout objects.

## Consequences

+ The same named beds and planting ids as the list; no duplicate bed catalog
+ Save gate is a single server check tests can share with the PWA
+ 90° rotate is a one-field update
- Gardeners cannot persist an in-progress crowded arrangement; they must fix
  or unplace before save
- Layout PUT 404s if it references a bed that exists only in the planting
  offline queue
