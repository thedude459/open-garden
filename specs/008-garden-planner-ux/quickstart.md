# Quickstart: Garden Planner UX

**Feature**: `008-garden-planner-ux` | **Date**: 2026-08-21

## Prerequisites

- Layout (005) + plantings (004) + reminders (006) stack runs
- Migrate through `0008_planner_visualization.sql`
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
npm test          # Vitest + coverage ≥80%
npm run e2e       # Playwright Chromium
npm run test:all  # both
```

## 10-bed / 50-planting fixture (required for SC-005)

Garden the gardener owns: **10** sized beds (e.g. 96×48 in) and **50** placed
plantings. Required for manual responsiveness — not optional.

## Verify Overview (P1)

1. Sign in. Open `/gardens/:id/layout`. Every sized bed is a named rectangle.
   Occupied beds show planting **names** (and counts), not in-bed marks.
   Empty beds still show. First paint under **3 seconds** on the 10×50 fixture
   (manual).
2. **Create bed** with name, length, width: rectangle appears in the **visible**
   plan; **Unsaved changes**. Create without size: 0 beds added. After migrate,
   no leftover unsized beds remain (no Needs size list).
3. Add a **non-planting area**; it is distinct from beds. Confirm-delete it:
   gone immediately; beds/plantings unchanged. Cancel confirm: area remains.
4. Drag a bed: plantings stay attached. Resize: flags at gesture **end**.
   Rotate 90°. Select a bed (click, no drag): **Bed View**, not a size form.
5. Viewer: sees map; cannot create/drag/Save; can open Bed View read-only.
   Non-member: not-found. Offline Create: online-required; draft unchanged.
6. Leave without Save after a draft bed: stored plan unchanged on reopen.

## Verify Transplant View (P1)

1. Open Transplants. **Add transplant** (catalog + started date). It appears
   here and in the Bed View **Planting tray**, not on a bed. Indoor water
   and/or fertilizer items appear when the catalog has intervals.
2. Complete/dismiss an indoor task (same as reminders). Direct seed never
   listed here.
3. Delete transplant: gone from tray. Viewer cannot add/delete.

## Verify Bed View (P1)

1. From Overview, open a sized bed. Drag a tray transplant onto the bed; it
   follows the pointer; leaves the tray; **Unsaved changes**. Other members
   still see the last save until **Save layout**.
2. **Direct seed**: pick any catalog plant; place in this bed; never in tray.
3. Remove transplant: back in tray with the same name and indoor tasks.
   Remove direct seed (confirm): planting gone.
4. Drop direct seed on tray: not deleted. Drop transplant on tray: restored.
   Drop outside the bed: **Drop missed a bed**; planting stays put.
5. No controls to resize/move/delete the bed or add areas. **Back to overview**
   keeps the draft.
6. Two known-spacing plants closer than the larger catalog spacing: flags
   **after drop**; Save refused (`Layout has spacing or fit problems`);
   stored plan unchanged.
7. Viewer cannot drag or direct-seed.

## Verify responsiveness (P2)

On the **required** 10×50 garden: open Overview within 3s (**manual** quickstart
gate, not Playwright timing); pan empty space; **Zoom in** / pinch; drag one
bed; viewer can pan/zoom but cannot move beds; in Bed View drag one planting —
item stays under the pointer (manual). Flags need not update mid-gesture.

## Offline

Load plan online. Go offline: Overview/Bed View/Transplant last load readable.
Try drag, create, area edit, transplant add, Save, confirmed delete:
online-required within 5 seconds; no draft/store change.
Reconnect after membership loss: GET 404/403; UI MUST NOT Save or mutate.
