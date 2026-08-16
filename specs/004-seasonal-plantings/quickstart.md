# Quickstart: Seasonal Plantings

**Feature**: `004-seasonal-plantings` | **Date**: 2026-08-16

## Prerequisites

- Household Gardens and Planting Calendar stacks already run (Compose Postgres,
  migrate through `0003_planting_calendar.sql`, fixture plant sync, demo users,
  at least one garden)
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

## Verify record a planting (P1)

1. Sign in as gardener. Open a garden. Open Plantings (from garden detail).
   First paint under ~2 seconds on the local network.
2. Add Cherry Tomato from the paged catalog. It appears with common name /
   species / cultivar. Planted date is clearly not set (not today).
3. Set planted date to a past day, then a future day — both save. Set harvest
   on or after planted — accepted. Set harvest before planted — rejected; prior
   values remain.
4. Add Cherry Tomato again — two rows (identity is the planting, not the
   variety).
5. Add Sweet Basil from favorites (favorite it first on plant detail). Other
   members do not see the owner’s favorites list — only basil as a planting.
6. Start remove on one row, cancel confirm — row remains. Confirm remove — row
   is gone and cannot be restored; catalog, favorites, and any calendar plan
   for that variety remain.
7. As a viewer: list is readable; add/edit/remove controls are absent.
8. Friend not invited: plantings URL/API is not found (same as missing garden).

## Verify named beds (P2)

1. Create “Raised bed 1” with no plantings yet — it appears as an **empty
   group**. Unassigned is not shown.
2. Assign one tomato to that bed; leave basil unassigned. Default list: bed
   group + Unassigned. Newest **recorded** planting in a group is first (`createdAt`, not planted date).
3. Create an empty “Patio pots” bed — empty group still visible.
4. Assign every planting to a bed — Unassigned disappears; empty beds remain.
5. Filter to Raised bed 1 — other groups hidden; saved set unchanged. Clear
   filter — full grouped list returns. Filter that matches nothing: empty
   state + way to show all.
6. Rename Raised bed 1 — plantings stay assigned and show the new name.
7. Delete the bed — plantings remain in the garden as unassigned (not deleted).
8. Viewer can see bed names but cannot create, rename, or delete beds.

## Verify offline queue (P3)

1. Load plantings while online.
2. Dev server has no service worker: in Playwright, abort
   `**/api/gardens/**/plantings**` and `**/api/gardens/**/beds**`. Cached list
   stays readable. Add a planting — it appears immediately as pending.
3. Reconnect / un-abort and drain: the planting exists for another member
   after one successful sync. Pending clears.
4. Viewer offline: previously loaded list readable; mutations not offered.
5. Two devices: B deletes a planting A still has a pending date edit for.
   When A drains, the pending update **fails visibly** and does **not**
   recreate the planting. A pending **add** of a different planting still
   syncs.
6. If the user was removed while unreachable: after reconnect, plantings are
   not found and stale cache/queue is dropped (no further mutations apply).

## Performance checks (manual — not CI)

These are the technical first-load targets (plan.md), not the SC-001 one-minute
usability study and **not** a Playwright/CI timing gate.

- First plantings view <2s on local network after the garden is open.
- Bed filter does not trigger an extra network request (grouping uses the
  already-loaded concatenated set).

## Out of scope (must not appear)

Bed geometry / layout canvas, planting-calendar window math on this page,
care/watering reminders, purchasing, quantity/count on a planting, automatic
conversion between calendar plans and plantings, undelete/archive of a removed
planting.
