# ADR 0024: Metric or imperial at the edge; lengths stay in inches

## Status

Accepted. Narrows the Phase 2 roadmap item "store metric internally".

## Context

Every length the app keeps is a whole number of inches: property and bed
sizes, bed and area positions, plant and rootstock spacing (from the
dataset), and a tree planting's spacing in whole feet. That is 15 columns
and about 650 places in the code, plus the plan's half-foot grid, which the
server also enforces on property sizes. Households outside the US read and
type metres.

## Decision

1. **A per-member setting.** `users.units` is `imperial` (the default) or
   `metric`. It comes back with the signed-in user, changes with
   `PUT /api/account/units`, and is picked from the sidebar.
2. **Convert at the edge, store inches.** The web app shows and reads
   lengths in the member's units through `libs/garden-layout`'s
   display-units helpers: plan lengths in metres to the centimetre, plant
   spacing in centimetres, tree spacing in metres to a tenth. The API, the
   database, layout checks, and the dataset keep inches. Storage did not
   move to metric: it would touch every length column, the API, and the
   dataset, and a member would see nothing that converting on screen does
   not already show.
3. **The grid stays half a foot.** In metric the plan still snaps to 15.24
   cm, so a typed 2.5 m bed is saved as 2.44 m. Feet apply as they are
   typed; a metric field applies when it is left, so the grid does not
   rewrite a number mid-entry. An open form converts what is typed when the
   member switches units.

## Consequences

+ One small migration; nothing else in the API or data changes.
+ Whole inches round-trip through centimetres exactly (tested up to 200 ft).
- Metric sizes land on a 15 cm grid, not 10 cm. A 10 cm grid would need
  finer storage than whole inches.
- The setting is per member, not per property, so two members of one
  property can see different units.
