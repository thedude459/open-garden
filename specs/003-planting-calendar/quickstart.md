# Quickstart: Planting Calendar

**Feature**: `003-planting-calendar` | **Date**: 2026-08-16

## Prerequisites

- Household Gardens stack already runs (Compose Postgres, migrate through
  `0002_gardens.sql`, fixture plant sync, demo users, at least one garden with
  zone 7 / last frost Apr 15 / first frost Oct 20)
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

## Verify view calendar (P1)

1. Sign in as gardener. Open a garden that has both frost dates. Open Calendar
   (from garden detail). First paint under ~2 seconds on the local network.
2. Add Cherry Tomato (fixture, last-frost indoor/transplant). Indoor-start and
   transplant show as date ranges, not a single invented day. Harvest is a
   range from transplant + days to maturity.
3. Add Spinach (fixture, first-frost sow). Sow range is tied to first frost.
4. Change last frost by 14 days on garden detail, return to calendar: tomato
   indoor/transplant ranges move; spinach sow does not. Reverse for first frost.
5. Add Red Maple (no guidance): listed with windows unavailable (not guessed).
6. Clear first frost on the garden: calendar shows windows cannot be produced;
   the plant list remains; add/remove still work when online.
7. As a viewer: calendar is readable; add/remove controls are absent.

## Verify choose plants and filter (P2)

1. Add Sweet Basil from favorites (favorite it first on plant detail). Other
   members do not see the owner’s favorites list — only basil on the calendar.
2. Add French Marigold (flower). Filter type to vegetable — marigold hidden;
   tomato remains. Clear filter — full set returns. Saved set unchanged.
3. Add Cherry Tomato again — still one row.
4. Remove marigold — gone from calendar; catalog and favorites unchanged.
5. Add Papaya (fixture fruit, zones 9–11, no guidance) to a zone-7 garden —
   listed with a clear zone-mismatch, not hidden. Honeycrisp (3–7) must **not**
   show mismatch on that garden.
6. Friend not invited: calendar URL/API is not found (same as missing garden).
7. Friend as viewer: POST/DELETE refused.

## Verify this-week emphasis

1. With fixture dates chosen so tomato indoor range includes today (or freeze
   the clock in Playwright), tomato is emphasized; a plant whose only overlap
   is harvest is not; maple is not.
2. Filter to another type: remaining emphasized rows keep emphasis.
3. No start windows this week: full list, no empty-state for “nothing this week.”

## Verify offline read (P3)

1. Load the calendar while online.
2. Dev server has no service worker: in Playwright, abort
   `**/api/gardens/**/calendar**`. Cached calendar stays readable. Current-week
   emphasis follows the test clock / local date, not the original load day.
3. Attempt add or remove — online-required within ~5 seconds; set unchanged.
4. Reconnect and refresh: windows match current frost dates. If the user was
   removed while unreachable, calendar is not found and stale cache is dropped.

## Performance gates (manual)

These are the technical first-load targets (plan.md), not the SC-001 two-minute
usability study.

- First calendar view <2s on local network after the garden is open.
- This-week emphasis does not trigger an extra network request.

## Out of scope (must not appear)

Layout canvas, bed geometry, in-ground planting records, care/watering
reminders, purchasing, automatic conversion of calendar rows into plantings.
