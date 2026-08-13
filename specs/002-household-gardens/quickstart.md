# Quickstart: Household Gardens

**Feature**: `002-household-gardens` | **Date**: 2026-08-13

## Prerequisites

- Plant database stack already runs (Compose Postgres, migrate, fixture sync,
  two demo users)
- Node.js LTS / npm; `npx nx …`

## Local stack

```bash
docker compose up -d postgres
nx run plant-catalog-data:migrate
nx run api:sync-plants
# terminal 1
nx serve api
# terminal 2
nx serve web
```

Demo users (from 001 seed):

- `gardener@example.com` / `password123`
- `admin@example.com` / `password123`

Register a third user from the login page (e.g. `friend@example.com`) for
sharing checks.

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
2. Go offline (DevTools): those views still readable.
3. Attempt create, edit, invite, or delete — online-required within ~5 seconds;
   membership unchanged.

## Performance gates (manual)

- First garden list/detail <2s on local network after login.
- Confirm delete is a single extra click, then garden disappears from the list
  immediately when online.

## Out of scope (must not appear)

Planting calendar math, bed geometry, layout canvas, in-ground plantings, care
reminders.
