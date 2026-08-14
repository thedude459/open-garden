# Quickstart: Household Gardens

**Feature**: `002-household-gardens` | **Date**: 2026-08-14

## Prerequisites

- Plant database stack already runs (Compose Postgres, migrate, fixture sync,
  two demo users)
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

## Verify create / list / detail (P1)

1. Sign in as gardener. Open Gardens — empty state if none exist.
2. Create “Backyard” with optional notes. Garden appears on the list with role
   owner. Open detail in under ~2 seconds on the local network.
3. Create a second garden named “Backyard” — rejected (owned-name unique).
4. Rename to “Front yard”; reopen — name persisted.
5. Sign in as friend (never invited) — gardener’s gardens are not listed;
   opening the id directly shows not found / no access.
6. Delete: start delete, cancel — garden remains. Confirm — garden gone for
   the owner; name “Front yard” can be created again.

## Verify site profile (P2)

1. Set zone 7, last frost Apr 15, first frost Oct 20 — persist on reopen.
2. Clear first frost only — last frost remains; first shows not set.
3. Set last frost Oct 20 and first frost Apr 15 — rejected; prior values remain.
4. Same-day both frost dates — rejected.
5. As a viewer (after sharing), site fields are visible but not editable.

## Verify sharing (P3)

1. As owner, invite `friend@example.com` as collaborator — friend sees the
   garden; member list shows emails and roles for owner and friend.
2. Invite an email with no account — clear failure; no member added.
3. Friend (collaborator) edits notes — saved. Friend invite/delete — refused.
4. Owner changes friend to viewer — friend can read member emails but cannot
   edit. Owner transfers ownership to friend — friend is owner; original owner
   is collaborator.
5. Favorites and catalog still work; friend never sees gardener’s favorites.

## Verify offline read

1. Load garden list + one detail while online.
2. Dev server has no service worker: in Playwright, abort `**/api/gardens**`
   (do not `setOffline` + reload). Cached list/detail stay readable.
3. Attempt create, edit, invite, or delete — online-required within ~5 seconds;
   membership unchanged.

## Performance gates (manual)

- First garden list/detail <2s on local network after login.
- Confirm delete is a single extra click, then garden disappears from the list
  immediately when online.

## Out of scope (must not appear)

Planting calendar math, bed geometry, layout canvas, in-ground plantings, care
reminders.
