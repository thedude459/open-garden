# ADR 0009: Garden planner as a client draft over layout PUT

## Status

Accepted — **partially superseded by [ADR 0010](./0010-two-view-planner.md)**
(two views, non-planting areas, start method). Bed draft Save, compensating
DELETE, leftover unsized beds, and IndexedDB last-GET-only still apply.

## Context

Garden Layout (005 / ADR 0007) already stores bed-local geometry and refuses
PUT while spacing/fit flags exist. The PWA layout page is form-driven: beds
without geometry are easy to miss, plantings are placed with x/y fields, and
`evaluateLayout` runs during rendering. Gardeners expect a Planter-like
spatial planner (visible beds, drag plantings, pan/zoom) without cartoon art
and without changing spacing rules.

Clarify 2026-08-18: beds are created with a size; Save is explicit; unplace is
tray drop or a control; empty space pans; flags refresh when the gesture ends.

## Decision

1. Keep persistence and REST from ADR 0007 (`GET/PUT /layout`, 004 beds). No
   new tables. IndexedDB remains last successful GET only.
2. Add pure plan-space helpers (`planToLocal`, hit-test, footprint radius) to
   `libs/garden-layout`. Do not add a second domain library.
3. The Angular planner holds a **working draft**. Object drags and new sized
   beds (client UUID) stay local until Save, and require connectivity (offline
   must not change the draft). Save evaluates first, POSTs new beds, then PUTs.
   If PUT fails, DELETE those new beds. Other members never see the draft.
   Leaving the page discards the in-memory draft.
4. Pointer Events + transform pan/zoom. Hit-test order: planting, resize
   handle, bed, empty (pan). `evaluateLayout` runs on gesture end, not on
   every pointermove. Unknown-spacing mark radius is 6 inches (visual only).
5. Leftover `geometry: null` beds are not drawn. Confirmed bed delete stays
   an immediate 004 DELETE (destructive, already confirmed), not draft-batched.

## Consequences

+ Same save gate and membership model as 005; Playwright HTTP specs reuse
+ Drag can stay smooth because flags are not computed per pixel
- Save after creating beds is two requests (POST then PUT); PUT failure must
  DELETE those new beds so FR-003 holds
- Bed delete is not draft-batched (by design, reuse of 004 confirm-delete)
