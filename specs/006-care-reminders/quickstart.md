# Quickstart: Care Reminders

**Feature**: `006-care-reminders` | **Date**: 2026-08-17

## Prerequisites

- Seasonal Plantings stack already runs (Compose Postgres, migrate through
  `0006_care_reminders.sql`, fixture plant sync including **Interval Herb**,
  demo users, at least one garden with dated plantings)
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

## Verify see reminders (P1)

1. Sign in as gardener. Open a garden that already has a planting with a
   planted date and known days to maturity (Cherry Tomato). Open Reminders
   (from garden detail, next to Plantings / Calendar / Layout). First paint
   under ~2 seconds on the local network after the garden is open (manual
   check, not a Playwright timing gate).
2. Harvest for that planting appears (due today, overdue, or upcoming —
   including dates more than 14 days away). List is flat: overdue oldest-first,
   then due today, then upcoming soonest-first — not grouped by bed.
3. A planting with no planted date does not invent a harvest day. Cherry
   Tomato (Moderate water, no interval) has **no** watering row.
4. Record **Interval Herb** as a planting with a planted date: at most one
   watering and one fertilizing item (not a stack of missed weeks).
5. Two plantings of the same dated variety → two harvest items. A calendar
   plan without a planting does not appear.
6. Empty garden: CTA to record plantings. Garden with one undated and one dated
   planting: only the dated row appears. Friend not invited: reminders
   URL/API is not found (same as missing garden). Viewer can read; no
   complete/dismiss controls.

## Verify complete or dismiss (P2)

1. As collaborator, complete a harvest item. Refresh as owner: harvest is
   gone; the planting still exists; `harvestedOn` is still unset unless edited
   on the planting list.
2. Dismiss a watering item on Interval Herb: that occurrence is gone; a later
   watering can appear after 7 days (`dueOn + interval`). Harvest dismiss ends
   harvest for that planting.
3. Viewer POST complete is 403 `Viewers cannot update reminders`.
4. Two browsers complete/dismiss the same occurrence: later save is stored;
   following GET shows that result.
5. Complete/dismiss on a **deprecated** variety still works.
6. DELETE a planting from the planting list — its reminders no longer appear.

## Verify offline queue (P3)

1. Load reminders while online (successful GET with `asOf`).
2. Dev server has no service worker: in Playwright, abort
   `**/api/gardens/**/reminders**` (do not rely on `setOffline` + reload).
3. Last-loaded list remains visible. Complete one item — pending on-device.
   Restore network and drain: other member sees completed state after one
   successful sync. Failed drain shows needs-attention, not success.
4. Planting-list and layout queues are unchanged; reminders MUST NOT enqueue
   into `og-plantings-queue` or layout PUT.
5. Remove the user from the garden while a complete is pending: on reconnect,
   the completion MUST NOT apply; they see garden not found.
6. **Concurrent clear**: member A completes online while member B had pending
   complete for the same occurrence — after B drains, GET shows cleared.
7. **Cold offline**: open reminders with no prior GET — online-required or
   empty state, not a broken error.

## YAGNI (do not build)

Layout editing, calendar generation, purchasing, weather irrigation, companion
rules, OS push, pruning/pest kinds, mapping Moderate→days, auto-fill
`harvestedOn` on harvest complete, `[ngValue]`, reminder mutations on the
planting or layout queues.
