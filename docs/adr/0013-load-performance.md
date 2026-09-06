# ADR 0013: Batched garden list, layout load, and search identity

## Status

Accepted

## Context

Spec 011 requires garden-list bed/placement counts, Overview/Bed View spacing and canopy, and plant-search illustration location without work that grows per garden, per placement, or per search result. Today the list has no counts; layout GET already joins plants for spacing; search has no illustration field and miss-fill upserts one row at a time. Overview/Bed View also await garden detail after layout.

## Decision

1. **List counts**: `bedCount` and `placementCount` on `GardenSummaryDto`. Fill with grouped aggregates for the page’s garden ids only (membership-scoped). Placement = planting with bed and layout coordinates.
2. **Layout load**: Keep one `listAllForLayout` join; derive canopy via `plantingFootprintRadius`. Parallelize client layout GET + garden detail GET. Do not add a canopy column.
3. **Search**: `illustrationUrl: string | null` on `PlantSummaryDto` with no image pipeline in this feature (null → existing CSS stand-in). Miss-fill uses one multi-row upsert.
4. **Gates**: Vitest/api-e2e fail on N+1 and on assembly ≥ 1s (20 gardens / 100 placements). Playwright fails on per-result data GETs and on interactive &gt; 2s. Log assembly milliseconds on the three handlers.

## Consequences

+ List can show counts without linear queries as households grow.
+ Layout load cost stays a join, locked by tests so a future loop cannot return unnoticed.
+ Search clients can render identity from one response; picture GETs remain allowed.
- Counts did not exist on the list before; clients and Zod must be updated together.
- Real plant artwork is still a later feature (`illustrationUrl` stays null until then).
- Layout PUT remains row-at-a-time (save path, out of scope).
