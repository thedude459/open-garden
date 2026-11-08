# Quickstart: Catalog Data Pipeline

**Feature**: `007-data-pipeline` | **Date**: 2026-08-18

## Prerequisites

- Node.js LTS / npm
- Docker Compose Postgres (same stack as 001–006)
- Demo users from 001 seed: `gardener@example.com` / `password123` and
  `admin@example.com` / `password123`

## Local stack

```bash
docker compose up -d postgres
npm run migrate          # includes 0007_catalog_pipeline.sql
npm run api:sync-plants  # blocking full fixture pipeline load (no 500 cap)
# terminal 1
npm run api:serve
# terminal 2
npm run web:serve
```

Web is at `http://localhost:4200`. Browser calls go to `/api` and are proxied
to the Nest API on port 3000 (session cookies).

Optional live source: set `PERENUAL_API_KEY` and PATCH settings
`sourceOrder` to `["fixture", "perenual"]`. Local/CI default is fixture only.

## Automated tests (same as CI)

```bash
npm test          # Vitest (affected-or-all) + coverage ≥80%
npm run e2e       # Playwright Chromium; starts Docker Postgres if needed
npm run test:all  # both
```

Pipeline unit coverage lives in `libs/catalog-pipeline` (merge, lock reject,
deprecation/reactivation, miss-fill absence). Catalog list tests must assert
**no** provider call on empty name search.

## Verify populate without in-app API sync (P1)

1. After `api:sync-plants`, sign in as gardener. Open Plants. First page
   shows fixture plants (including Cherry Tomato). Search and open detail
   in under 1 minute. There is **no** sync/refresh-from-API control on
   gardener screens.
2. Search for a name that is not in the catalog: empty state. The API must
   not call Perenual/fixture search to fill the miss (network abort of
   provider hosts still returns empty, not new rows).
3. As gardener, `POST /api/admin/pipeline/runs` is 403 `Admin role required`.
4. Catalog first paint after the garden/catalog is open remains a **manual**
   local-network check (<2s), not a Playwright timing gate.

## Verify multi-source merge (P2)

1. Sign in as admin. PATCH settings `sourceOrder` to `["fixture", "fixture-b"]`
   (admin form is P3). Start a run. Poll the **catalog** until a fixture-b unique
   plant appears (do not require run-detail GET until P3).
2. Overlapping varieties appear **once**. Unique varieties from `fixture-b` appear. Do not expect the whole catalog to contain only 30 rows (the 30-key pair is a unit-test contract). Conflicting fields follow last-in-order wins; blanks fill from earlier sources. Run detail (after US3) shows `fieldWinners`.
3. Reset `sourceOrder` to `["fixture"]` for the rest of the product e2e
   (003–006 named plants).

## Verify operator monitor and recover (P3)

1. As admin, start a run. Status becomes `running` then terminal. Detail
   lists each source. Gardeners still cannot open `/admin/pipeline`.
2. Start a second run while the first is forced `running`: 409
   `A pipeline run is already running`. The first run is unchanged.
3. Disable or break one source (e.g. enable `perenual` without a usable key)
   and keep fixture: run ends `incomplete` or fixture-only `succeeded` with
   the failed source recorded; previously loaded plants remain searchable.
4. Set cadence `daily` and `runAtHourUtc`. Confirm the settings GET round
   trip. (Firing the clock is a unit test of `tryStartScheduled`, not a
   24-hour wait.)

## Performance / scale notes

- Fixture full load (≥50 plants) completes well under SC-006’s 2 minutes.
- Live Perenual full paging is operator-initiated; gardeners keep using the
  last published catalog while it runs.
