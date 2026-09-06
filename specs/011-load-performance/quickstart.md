# Quickstart: Load Performance

**Feature**: `011-load-performance` | **Date**: 2026-08-23

## Prerequisites

- Existing migrations through `0008` (no new migration)
- Fixture plants with known spacing (`npm run api:sync-plants`)
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
npm test          # Vitest + coverage ≥80% (count batching, layout join-once, miss-fill upsertMany, assembly <1s)
npm run e2e       # Playwright including 20-garden list, 100-placement planner, search data-request count, 2s interactive
npm run test:all  # both
```

Assembly timings also appear in API logs: `garden.list.assembly_ms`, `garden.layout.assembly_ms`, `plants.list.assembly_ms`.

## Verify garden list (P1)

1. Create **20** gardens (API or UI) as one user. Open **Gardens**.
2. Each row shows bed count and placement count. A garden with no beds/plantings shows **0**.
3. Network: one gardens list request — not one extra request per garden for counts.
4. List is scrollable / a garden is openable within **2 seconds**.

## Verify Overview and Bed View (P1)

1. Seed a garden with **100** placed plantings in a sized bed (API create + Save layout).
2. Open **Garden Overview**: marks sized from spacing/canopy as today; pan/zoom within **2 seconds**.
3. **Open bed**: same plantings, correct footprints; no wait on per-planting fetches.
4. Viewer of that garden: same picture, cannot save.

## Verify plant search (P2)

1. Plants page: Apply a search with **≥10** results. Each row has stand-in (or img if `illustrationUrl` set). No `GET /api/plants/:id` per row.
2. Bed View plant panel: same completeness and request rule.
3. Results usable within **2 seconds**; do not wait for images.

## Verify regression gate (P3)

1. Temporarily restore a per-garden count query or per-result plant GET — the new tests MUST fail.
2. Confirm the three timings are present on failure output or API logs.
