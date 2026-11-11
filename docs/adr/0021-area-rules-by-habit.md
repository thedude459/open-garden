# ADR 0021: Area rules by habit, and the bramble patch

## Status

Accepted

## Context

Principle VIII says each area type declares which plants it accepts, by
growth habit and use, and that a mismatch is blocked. Before this change the
rule was a handful of `if`s on the bed's station (`tree`, `berry`) and the
plant type, berry beds sat inside orchards, and the dataset's raspberries and
blackberries imported as plain `fruit`, so a vegetable bed accepted them. The
`garden_areas.kind` CHECK constraint meant a new area type needed a
migration, and `garden_beds.kind` (`bed`/`orchard`) predated areas.

## Decision

1. **Plant type carries the habit.** The importer sets the plant type habit
   first: `tree`, `shrub`, or the new `cane` whatever the crop's use, except
   that an herb of any habit (thyme is a subshrub) is `herb`. Other crops keep
   their use (`vegetable`, `herb`, `flower`, `fruit`). No new column: the
   type already reached every API and planner path that needs it.
2. **One list.** `AREA_TYPES` in `libs/shared-types` lists what each area
   type accepts. The API (`placementRefusal`, the calendar check) and the
   planner pickers (`allowsPlant`) read it. A new type is one entry plus a
   name; area kinds are validated against `AREA_KINDS` at the API, and the
   database constraint is dropped.

   | Area | Accepts |
   |---|---|
   | Vegetable garden | vegetable, herb, flower, fruit |
   | Orchard | one tree per bed, plus herbaceous underplanting |
   | Bramble patch | cane, shrub |
   | Greenhouse (trays) | vegetable, herb, flower, fruit |

3. **Bramble patch.** A new area type. "Add bramble patch" on the Overview
   adds a row of canes in it. Fruit bushes (blueberry) go here too until
   they have an area type of their own; that keeps them placeable without a
   second new type. Migration 0004 moves berry beds out of orchards into a
   bramble patch. The old "a berry bed holds one kind of shrub" rule is
   dropped: a bramble bed is a row.
4. **A bed's station follows its area.** `station` (`tree`, `berry`) tells
   the server which area a new bed goes in, and a bed created in a given area
   takes that area's station, so the planner (which sees stations) and the
   API (which reads areas) apply the same rule. Migration 0004 lines up
   existing beds.
5. **`garden_beds.kind` is removed**, with its API field.

## Consequences

+ Raspberries and blackberries can no longer be placed in a vegetable bed or
  tray; ones already there are flagged, not blocked (ADR 0020).
+ Adding an area type (containers, berry bushes) needs no migration.
- A blueberry sits in a "bramble patch" until a berry-bush type exists.
- Tree beds are still created at 8 × 8 ft; sizing them by rootstock is the
  rest of roadmap step 2.
