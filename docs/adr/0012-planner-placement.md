# ADR 0012: Planner placement mapping and catalog reject

## Status

Accepted

## Context

Spec 008 stored bed origins from a stacked garden-origin fallback and mapped
pointers with pan/scale helpers that did not match the SVG `viewBox` plus CSS
transform. Direct seed used **Add {name}** at bed center. Spec 010 requires
visible-viewport create, grab-offset moves, Bed View catalog search, and
reject-without-placing for invalid catalog drops, while Overview shows
planting marks that must not be editable.

## Decision

1. **Screen mapping**: `GardenPlanCanvas.clientToPlan` / `viewportCenterPlan()`
   using SVG `getScreenCTM()` is the only UI mapping. Do not import
   `clientToPlanWithPanScale` or lib `viewportCenterPlan` from
   `@open-garden/garden-layout` for placement.
2. **Overview create**: rectangle **center** at the visible viewport
   (`originFromCenter`). **Move** uses `originFromGrabOffset` (no center-snap).
3. **Overview marks**: draw footprints (`showPlantingMarks`);
   `allowPlantingDrag` is false and `hitTestPlan(..., includePlantings: false)`
   so marks are not draggable. No plant panel on Overview.
4. **Bed View catalog**: `catalogDropOutcome` on the open bed. `ok` adds a
   draft `direct_seed` at the drop **center**. `miss` / `spacing` / `fit`
   **reject** (no planting, clear arm, specific notice). Moving an
   **existing** planting still uses 008 `applyPlantingDrop` + flags (Save 422).

## Consequences

+ Create bed/area and catalog place match what the gardener sees after zoom/pan.
+ Invalid catalog drops never look like success; leftover null-spacing
  plantings stay `unavailable`.
- Catalog list omits unknown spacing; GET-by-id may still return null spacing.
- Playwright must use Arm/drag/click, not **Add {name}**, in Bed View.
