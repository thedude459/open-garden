# ADR 0046: A weekly Scout task per bed

## Status

Accepted. Roadmap step 13c. Builds on [ADR 0045](0045-pest-advice.md) (pests
from the dataset, by the property's country).

## Context

Integrated pest management starts with looking: extension guides ask
gardeners to check their plants about once a week, for the pests of what is
growing, at the stages those pests attack. Plant pages now list a crop's pests
(ADR 0045). Nothing reminds a household to look.

Care tasks so far belong to one planting (Water Tomato, Harvest Basil). One
scouting task per planting would add a task a week for every plant in a busy
bed, though a gardener scouts a bed in one walk.

## Decision

1. **One Scout task per bed, weekly.** It names the pests to look for in the
   bed this week, and is done or dismissed like any task. It is due a week
   after the bed was last scouted, or weekly from the bed's earliest planting
   date. A bed with no pest to look for has no task.
2. **Which pests:** those of the bed's growing plantings (planted, not yet
   harvested, with a dataset crop), at the stage each planting is at, and
   known in the property's country or of unknown range (`occursIn`, as on
   plant pages). A property with no country yet gets every pest.
3. **Crop stage** comes from the crop's FAO stage lengths (`stageDays`,
   already read for watering, ADR 0035), counted from the planting date:
   initial is `seedling`, development `vegetative`, mid-season `flowering`
   and `fruiting` (fruit sets there), late and after `fruiting`. A crop
   without stage lengths, or a perennial (its stages follow the season, not
   its planting date), counts as every stage. That names more pests than
   needed rather than missing one; a start-of-season date for perennials
   would narrow it.
4. **Stored per bed:** `garden_scout_events` (bed, day, done or dismissed),
   beside the per-planting `garden_care_events`. A bed's scouting goes with
   the bed when it is deleted.
5. **One task shape.** A Scout task is a care task of kind `scout` whose
   subject is its bed: the bed's id stands in `plantingId`, so Today, the
   Tasks page, the offline queue, and the daily reminder handle it with no
   new paths. Its title on Today is "Scout for" and the pests; the Tasks page
   lists it under its bed. The API checks that the bed belongs to the
   property and that the member may edit, as for any task.

## Consequences

- Reminders gain at most one task per bed a week, and only while a bed holds
  a crop with pests to look for.
- Not in this step: "not a problem here" (stop naming a pest for a property),
  and recording sightings for next year's advice. Each needs its own
  decision (who may record, and where it is kept), and is on the roadmap.
- Reusing `plantingId` for the bed keeps one task shape across the app. A
  reader must check `kind` before treating the id as a planting's; the shared
  type says so.
