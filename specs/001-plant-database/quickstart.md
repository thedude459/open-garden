# Quickstart: Plant Database

**Feature**: 001-plant-database | **Branch**: `003-plant-database`

## Prerequisites

- Node.js 20+
- Docker (for Postgres)
- API keys: [Trefle](https://trefle.io/), [Perenual](https://perenual.com/docs/api)

## Initial Setup

```bash
# Clone and install (once scaffold exists)
npm install

# Environment
cp .env.example .env
# Set: DATABASE_URL, TREFLE_API_TOKEN, PERENUAL_API_KEY,
#      NEXTAUTH_SECRET, NEXTAUTH_URL

# Start Postgres
docker compose up -d postgres

# Run migrations
npm run db:migrate

# Seed curated reference data (companions, rootstocks)
npm run seed:reference

# Initial plant sync from providers
npm run sync:plants
```

## Development

```bash
npm run dev
# → http://localhost:3000
```

1. Register at `/register` (email + password)
2. Sign in → redirected to `/plants`
3. Search catalog (online, server-side)
4. Open plant detail → triggers recently-viewed tracking
5. Enable climate filter → prompted for postal code on first use
6. Search unknown plant → create provisional

## Pin Plants for Offline Cache

1. Open a plant detail page while online
2. Click "Pin for offline" → adds to `user_garden_plant_refs`
3. Verify plant appears in `/api/users/me/cache/manifest` response

## Scheduled Sync

```bash
# Manual trigger (same as cron)
npm run sync:plants

# Or hit internal endpoint (requires CRON_SECRET header)
curl -X POST http://localhost:3000/api/internal/sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Offline Cache Validation

1. Sign in and view 3+ plant detail pages
2. Open DevTools → Application → IndexedDB → verify `plants` store populated
3. DevTools → Network → Offline
4. Navigate to a recently viewed plant detail → loads from cache
5. Attempt full catalog search offline → offline banner; scoped search only

## Test Commands

```bash
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E
```

### Key E2E scenarios (maps to spec; implemented in T067 `tests/e2e/plant-catalog.spec.ts`)

| Spec | Test |
|------|------|
| SC-001 / US1 P1 | Search by common name returns results < 10s |
| US1 | Unauthenticated redirect to login |
| US2 P2 | Detail page shows all FR-004 fields + companion links |
| US3 P3 | Climate filter hard-excludes incompatible plants |
| US4 P4 | Create provisional; find in search; cross-session persistence |
| SC-003 | Offline detail for cached plant |
| SC-004 | `/api/plants/:id/relationships` returns plant IDs |

### Unit test scenarios (maps to spec)

| Spec | Test |
|------|------|
| FR-017 | Non-organic fertilizer not persisted — `tests/unit/fertilizer-filter.test.ts` (T020) |

## API Smoke Test

```bash
# After sign-in, copy session cookie
curl -b cookies.txt "http://localhost:3000/api/plants/search?q=tomato"

curl -b cookies.txt "http://localhost:3000/api/plants/{id}/relationships"

curl -b cookies.txt "http://localhost:3000/api/users/me/cache/manifest"
```

## Constitution Validation Checklist

Before marking feature complete:

- [ ] Plant search reads from Postgres catalog, not hard-coded data
- [ ] Companion/incompatible returns queryable plant IDs
- [ ] Rootstock spacing from curated `rootstock_options` table
- [ ] Non-organic fertilizer filtered in sync pipeline (unit test: T020 `tests/unit/fertilizer-filter.test.ts`)
- [ ] Provisional merge retains user values for null canonical fields
- [ ] Auth required for all catalog routes

## Next Step

Run `/speckit-tasks` to generate implementation tasks from this plan.
