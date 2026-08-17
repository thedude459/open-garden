# Quickstart: Garden Layout Designer

**Feature**: `005-garden-layout` | **Date**: 2026-08-16

## Prerequisites

- Seasonal Plantings stack already runs (Compose Postgres, migrate through
  `0004_seasonal_plantings.sql`, fixture plant sync, demo users, at least one
  garden with named beds and plantings)
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

Demo users (from 001 seed):

- `gardener@example.com` / `password123`
- `admin@example.com` / `password123`

Register a third user from the login page (e.g. `friend@example.com`) for
sharing checks.

Web is at `http://localhost:4200`. Browser calls go to `/api` and are proxied
to the Nest API on port 3000 (required for session cookies).

## Automated tests (same as CI)

```bash
npm test          # Vitest (affected-or-all) + coverage ≥80%
npm run e2e       # Playwright Chromium; starts Docker Postgres if needed
npm run test:all  # both
```

## Verify draw beds to scale (P1)

1. Sign in as gardener. Open a garden that already has plantings. Open Layout
   (from garden detail, next to Plantings / Calendar). First paint under ~2
   seconds on the local network after the garden is open (manual check, not a
   Playwright timing gate).
2. If the garden has named beds with no geometry, they appear as needs-size,
   not as a second name list. Size “Raised bed 1” to 96 × 48 inches and save.
   Reopen: same rectangle.
3. Add a second bed from the layout (name + length + width). Both appear to
   scale. Rotate one bed 90° — plantings in it stay attached. Viewer cannot
   rotate.
4. Resize a bed so a placed plant’s center is closer to an edge than `ceil(s/2)`
   inches (for catalog spacing `s`): fit flag shows; **Save is refused** with
   `Layout has spacing or fit problems`; last saved plan remains.
   Undo the resize or unplace, then save succeeds.
5. Start delete on a bed, cancel confirm — bed and placements remain. Confirm
   delete — named bed is gone from layout **and** planting list; plantings
   remain in the garden unassigned and unplaced.
6. Friend not invited: layout URL/API is not found (same as missing garden).

## Verify place plantings and spacing (P2)

1. Place two plantings of known spacing in one bed with centers closer than
   the **larger** catalog spacing — flag + save refused. Move them apart to
   at least that distance — save succeeds; no false flag.
2. Mixed spacing (e.g. 12 and 24): centers 18 inches apart — flag and refuse
   (larger value wins).
3. A planting with `spacingInches: null` shows unavailable, can save, and does
   not invent a pair distance.
4. Same variety twice → two placements. Calendar plan for a variety with no
   planting record does not appear on the layout.
5. Unplace (clear position) — planting stays on the planting list; bed
   assignment remains until unassigned. Place into a bed — planting list
   shows that bed.
6. As a viewer: plan is readable with flags; mutate controls are absent; PUT
   is 403.

## Verify offline read (P3)

1. Load layout while online (successful GET).
2. Dev server has no service worker: in Playwright, abort
   `**/api/gardens/**/layout**` (do not rely on `setOffline` + reload).
3. Last-loaded beds and placements remain visible. Try to move/resize/save —
   online-required within 5 seconds; layout does not change.
4. Planting-list offline queue still works as in 004; layout does not enqueue
   geometry.

## YAGNI (do not build)

Companion-planting rules, care reminders, purchasing, calendar plans on the
canvas, polygons, free rotation, GPS, outer property boundary, quantity field,
layout mutation queue, catalog-create on the canvas, `[ngValue]`.
