# Quickstart: Fix Planner Placement

**Feature**: `010-fix-planner-placement` | **Date**: 2026-08-22

## Prerequisites

- Migrate through existing `0008` (no new migration for this feature)
- Fixture plants with **known** spacing (`npm run api:sync-plants`)
- Node.js LTS / npm

## Local stack

```bash
docker compose up -d postgres
npm run migrate
npm run api:sync-plants
# terminal 1
npm run api:serve
# terminal 2
npm run web:serve
```

Demo: `gardener@example.com` / `password123`. Web: `http://localhost:4200`.

## Automated tests (same as CI)

```bash
npm test          # Vitest + coverage ≥80% (garden-layout origin + catalog-drop; catalog omit-spacing)
npm run e2e       # Playwright Chromium
npm run test:all  # both
```

## Verify Overview placement (P1)

1. Open Garden Overview. Zoom in and pan so the default garden center is **off-screen**.
2. **Create bed** (name, length, width): the rectangle appears in the **visible** view with its **center** in that viewport — not at a hidden garden origin.
3. Grab a **corner** (not the center) and drag: that corner stays under the pointer (no snap so the center jumps onto the cursor). Repeat for **Create non-planting area**.
4. **Save layout**; reload Overview: beds/areas are at the same spots.
5. Confirm there is **no** plant search / Plant panel on Overview. Planting marks (if any) do not drag; dragging a bed still moves the bed.

## Verify Bed View catalog plant (P1)

1. **Open bed**. Plant panel is visible. If the garden has a hardiness zone, the zone filter **starts on that zone**.
2. Search by name; optionally filter type. Results show a stand-in, common name, category; zone filter on → climate indicator.
3. Drag a result onto a clear spot in the open bed: a **direct seed** appears at the drop (not in the tray). **Unsaved changes**. No Transplant View.
4. **Save layout**. Reopen Overview: the **mark** is on that bed. Bed View still shows it.
5. Arm another result, click a valid spot: same as a drag. **Direct seed** empty-state control focuses the panel and does **not** plant by itself.
6. There is **no** `Add {name}` button that plants at bed center without a target.

## Verify reject (P2)

1. Drag a catalog result onto the heading / off the bed: **Drop missed a bed**; no new planting; not left silently armed.
2. Drop onto a spot that overlaps / is too close: **Too close to another plant** (or **Does not fit in this bed**); no planting created.
3. Offline: Create bed or catalog place → online-required; draft unchanged.
4. Move an **existing** planting too close: 008 flags + Save refused (`Layout has spacing or fit problems`) — still allowed on the draft.

## Verify catalog admission

1. Plants page and Bed View panel: 0 results with unknown spacing.
2. A fixture planting whose variety has null spacing (if present) remains in the bed; that variety is absent from search.

## Manual gates (not Playwright timing)

- Pointer tracking while dragging a bed at two zoom levels (SC-001 feel).
- Viewer cannot Create bed or Arm a catalog result.
