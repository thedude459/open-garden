# Quickstart: Plant Database

**Feature**: `001-plant-database` | **Date**: 2026-08-01

## Prerequisites

- Node.js LTS and npm (Nx workspace; `npx nx …` or install Nx CLI globally)
- Docker (PostgreSQL via Compose)
- Signed-in test user (auth bootstrap from plan)

## Local stack

```bash
# From repo root (after Nx workspace exists)
docker compose up -d postgres

# Apply migrations (Drizzle)
nx run plant-catalog-data:migrate

# Seed via fixture provider / operator sync
nx run api:sync-plants -- --provider=fixture

# Start API + web
nx serve api
nx serve web
```

## Verify catalog (P1)

1. Open login page; sign in as a normal user.
2. Open Plant Catalog with no search — first page of plants appears (≤20) in
   under ~2 seconds on the local network.
3. Search by common name — matches listed; open detail — attributes visible
   (nulls shown as unavailable, not fabricated).
4. With API reachable but external provider stopped: browse of already-synced
   plants still works (no live provider dependency).
5. After loading list + at least one detail while online, set the browser
   offline (DevTools): previously loaded catalog browse/detail still works from
   client cache.

## Verify filters (P2)

1. Filter by plant type only — list narrows; no name required.
2. Filter by hardiness zone — only plants whose range includes that zone.
3. Combine name + zone + type — all criteria apply.
4. Impossible filter combo — empty state, not an error splash.

## Verify favorites (P3)

1. From plant detail, add favorite — appears on Favorites list.
2. Remove favorite — gone from list; plant still in catalog.
3. Sign in as second user — cannot see first user’s favorites.
4. Offline: add/remove favorite — UI updates immediately (&lt;500ms feel) with
   pending state; reconnect — server matches last intent after sync.

## Performance gates (manual)

- First catalog page on LAN: &lt;2s
- Offline favorite add/remove UI apply: &lt;500ms

## Tests

```bash
nx test plant-catalog
nx test plant-favorites
nx test plant-provider
nx test api   # or api-e2e integration
nx e2e web-e2e
```

Coverage for touched libs/apps must remain ≥80% (enforced in CI).

## Contract smoke (examples)

```bash
# After login cookie is available:
curl -b cookies.txt 'http://localhost:3000/api/plants?page=1&pageSize=20'
curl -b cookies.txt 'http://localhost:3000/api/plants?q=tomato&zone=7&plantType=vegetable'
curl -b cookies.txt -X PUT 'http://localhost:3000/api/favorites/{plantId}'
curl -b cookies.txt -X DELETE 'http://localhost:3000/api/favorites/{plantId}'
```

## Out of scope checks

Confirm UI/API do **not** expose planting schedules, garden layout placement, or
care reminders as part of this feature.
