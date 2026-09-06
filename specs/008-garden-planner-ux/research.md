# Research: Garden Planner UX

**Feature**: `008-garden-planner-ux` | **Date**: 2026-08-21

## 1. Domain libraries (no new planner package)

**Decision**: Keep geometry, spacing, fit, rotate, and the save gate in
`libs/garden-layout`. Add **pure** helpers there for Overview vs Bed View
hit-test, area rectangles, planting name/count labels, viewport-center
placement. Extend `libs/seasonal-plantings` for `start_method` and bed-delete
behavior. Extend `libs/care-reminders` with `deriveIndoorReminders`. Do **not**
create `libs/garden-planner`.

**Rationale**: Constitution library-first and YAGNI. Spacing/fit unchanged
(ADR 0007). Indoor tasks are the same water/fertilize kinds as 006.

**Alternatives considered**:
- **New `libs/garden-planner`**: Extra Nx project for UI helpers.
- **App-only pointer math**: Drifts from the server save gate.

## 2. Persistence: areas and start method

**Decision**: Migration `0008_planner_visualization.sql`:

- Table `garden_non_planting_areas` (garden-scoped named rectangles; geometry
  always complete; no orientation).
- Columns on `garden_plantings`: `start_method` (`direct_seed` | `transplant`,
  NOT NULL, default `direct_seed` for existing rows), `indoor_started_on`
  (date, null for direct seed).
- **Delete leftover unsized beds** (`garden_beds` with null length/width):
  DELETE `direct_seed` plantings on those beds; unassign+unplace
  `transplant` plantings; then DELETE the beds. After this, POST bed without
  size is refused.

Layout GET/PUT includes `areas`. New areas are upserted on PUT (client UUID).
No name-only area POST.

**Rationale**: Spec requires areas and start method. Existing plantings behave
as direct seed (in-ground). Areas always have size at create.

**Alternatives considered**:
- **No migration / encode areas as beds**: Would allow plantings in paths.
- **Area rotate**: Spec does not require it (YAGNI).

## 3. Draft vs immediate writes

**Decision**:

| Action | Persistence |
|--------|-------------|
| Create/move/resize/rotate **bed**; place; direct seed; reposition; restore transplant to tray | Layout **draft** until Save (POST new beds + POST new direct-seed plantings + PUT layout including areas) |
| Confirmed **bed delete** | Immediate 004 DELETE; then apply start-method rules (below) |
| Confirmed **area delete** | Immediate `DELETE /areas/:areaId` |
| **Transplant create / full-delete** | Immediate planting POST/DELETE |
| Indoor complete/dismiss | Immediate 006 reminder POST |

Save still: evaluate first; POST new beds; POST new direct-seed plantings;
PUT layout; on PUT failure DELETE beds **and** plantings created in that Save.

**Rationale**: Spec FR-013 / FR-014 / FR-015. Indoor records are planting
rows, not geometry.

**Alternatives considered**:
- **Draft transplant create**: Rejected — spec says planting-record write.
- **Draft area delete**: Rejected in clarify (Option A, immediate like beds).

## 4. Start method and tray

**Decision**:

- Tray = `start_method = transplant` AND `placement == null`.
- Direct seed: never in the tray. Created in Bed View onto the open bed
  (draft planting + placement). Remove from bed (confirm) **deletes** the row
  on Save (or immediately if we DELETE on confirm then keep draft consistent —
  spec: remove-from-bed is layout-draft; **on Save** DELETE those ids).
- Transplant remove from bed: clear `bed_id` + layout coords on the draft
  (restore tray); keep `indoor_started_on` and care events.
- Place from tray: set `bed_id` + local x/y on the draft.

**Bed DELETE** (immediate):

- Direct-seed plantings **in that bed**: DELETE planting rows.
- Transplant plantings in that bed: SET `bed_id` NULL and clear layout coords
  (return to tray, keep information).

**Rationale**: Spec remove-from-bed and bed-delete scenarios.

**Alternatives considered**:
- **004 SET NULL for all plantings on bed delete**: Would leave deleted
  direct-seed rows as unassigned in-ground plantings, against the spec.

## 5. Indoor water / fertilizer tasks

**Decision**: Add `deriveIndoorReminders` in `libs/care-reminders`. Inputs:
unplaced transplants with `indoor_started_on` and catalog
`water_interval_days` / `fertilize_interval_days`. Same repeating cursor as
006 (`garden_care_events`). **No harvest** indoor items. Omit when interval
is null. Direct seed never included. Placed transplants are **not** indoor.

Garden reminders GET (006) stays on `planted_on` only — indoor items appear
on Transplant View, not mixed into the garden reminder list.

Complete/dismiss: existing `POST /api/gardens/:id/reminders`.

**Rationale**: Spec requires associating water/fertilizer with indoor starts
without a second event store. 006 already omits when no interval.

**Alternatives considered**:
- **User-toggled tasks with custom intervals**: Extra UI and storage; catalog
  already has intervals.
- **Reuse `planted_on` for indoor start**: Collides with harvest / in-ground
  water once the plant is in a bed.

## 6. Three views and routing

**Decision**:

| View | Route |
|------|--------|
| Overview | `/gardens/:id/layout` (keep; heading may say Garden Overview) |
| Bed View | `/gardens/:id/layout/beds/:bedId` |
| Transplant View | `/gardens/:id/transplants` |

Shared Angular **planner draft service** (provided on parent or root of these
routes) holds the in-memory layout draft. Overview: click/tap on a bed without
a move/resize gesture **navigates** to Bed View. Create new bed / area: rectangle
at **viewport center in plan inches** (`viewportCenterPlan`).

**Rationale**: Select-to-open vs drag-to-move; no URL churn for Overview.

**Alternatives considered**:
- **Single page with view modes**: Harder to deep-link a bed; still need
  shared draft.
- **Rename Overview to `/planner`**: Breaks existing layout links/e2e.

## 7. Pointer events (Overview vs Bed View)

**Decision**: Pointer Events as in ADR 0009.

**Overview hit-test order** (plan inches): area resize handle → area body →
bed resize handle → bed body → empty (pan). Planting marks are **not** hit
targets. Gesture: if pointer moves past a small threshold on a bed, **move
bed**; if pointerup with no move, **open Bed View**. Same threshold for areas
(move vs select-for-geometry). Viewers: pan/zoom; tap bed still opens
read-only Bed View.

**Bed View hit-test**: planting footprint → tray item/drop zone → bed
interior (place) → outside bed (no place, no pan required). Drop transplant
on tray: restore. Drop direct seed on tray: no silent delete.

Do **not** add Angular CDK drag-drop.

**Rationale**: Clarify select-to-open; FR-004/FR-005.

## 8. Visual language

**Decision**: Overview: axis-aligned bed and area rectangles; bed/area names;
occupied beds show **name (and count)** labels, **not** in-bed marks. Areas
visually distinct (e.g. different fill, not plantable). Bed View: planting
marks with names; known spacing footprint `ceil(s/2)`; unknown **6 in**
visual only; 12-inch light grid in the bed. Tray: future transplant names.

**Rationale**: FR-002, FR-007, FR-009.

## 9. `evaluateLayout` timing

**Decision**: Unchanged from ADR 0009: run on gesture end and before Save,
not on every pointermove. Areas are **not** inputs to spacing/fit. Overlap
of areas with beds is allowed (spec).

## 10. Testing

**Decision**: Vitest for `viewportCenterPlan`, Overview vs Bed hit-test,
label aggregation, indoor derive, bed-delete by start method, drop restore
vs direct-seed refuse. Playwright: create bed appears in view; select opens
Bed View; Overview has no planting drag; direct seed from catalog; tray only
transplants; restore transplant; delete direct seed; Transplant View CRUD;
area create/delete; viewer read-only; 10×50 pointer-follow remains **manual**.

**ADR**: [0010](../../docs/adr/0010-two-view-planner.md)
