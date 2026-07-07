# Quickstart: End-to-End Test Coverage

**Date**: 2026-07-07 | **Plan**: [plan.md](./plan.md)

## Prerequisites

- Node.js 20 LTS
- Docker (for local Postgres via `docker-compose.yml`)
- Playwright browsers: `npx playwright install chromium`

## One-Command Local Setup

```bash
# Start Postgres, create garden_e2e if missing, migrate, and seed catalog
export DATABASE_URL=postgres://garden:garden@localhost:5432/garden_e2e
export AUTH_SECRET=local-e2e-auth-secret-min-32-chars!!
npm run e2e:prepare
```

`e2e:prepare` runs `e2e:db:ensure` then `e2e:reset`. The E2E database is separate
from dev `garden` — safe to truncate on every test run.

Optional: copy env vars into a shell profile or `.env.e2e.local`:

```bash
cp .env.e2e.example .env.e2e.local
set -a && source .env.e2e.local && set +a
```

## Run Tests

```bash
# PR smoke subset (< 8 min target)
npm run test:e2e:smoke

# Full suite (< 15 min target)
npm run test:e2e:full

# Single spec
npx playwright test tests/e2e/auth.spec.ts

# Single test with trace
npx playwright test tests/e2e/garden-crud.spec.ts --trace on

# Mobile project only
npx playwright test --project=mobile-chrome
```

## npm Scripts

| Script | Purpose |
|--------|---------|
| `e2e:db:ensure` | `docker compose up -d postgres` + create `garden_e2e` if missing |
| `e2e:reset` | Truncate + migrate + seed catalog (requires `DATABASE_URL`) |
| `e2e:prepare` | `e2e:db:ensure` + `e2e:reset` — full local prep |
| `test:e2e:smoke` | P1/P2 `@smoke` specs only |
| `test:e2e:full` | Entire suite (desktop + mobile) |

## Reset Database Manually

```bash
export DATABASE_URL=postgres://garden:garden@localhost:5432/garden_e2e
npm run e2e:reset
```

Runs truncate + migrate + catalog seed. Safe only against `garden_e2e` DB.

## CI vs Local

| | **CI (GitHub Actions)** | **Local (Docker Compose)** |
|--|-------------------------|----------------------------|
| Postgres | Ephemeral `services:` container | `docker compose` postgres service |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/garden_e2e` | `postgres://garden:garden@localhost:5432/garden_e2e` |
| Setup | `db:migrate` in workflow; `globalSetup` resets before tests | `npm run e2e:prepare` |

CI does not use Docker Compose — GitHub Actions `services:` already provides Postgres.

## Smoke Journey Checklist (manual verification)

### 1. Auth UI (`auth.spec.ts`)

1. Register new user via `/register` form
2. Sign in via `/login` form → reach `/plants` or `/gardens`
3. Visit `/gardens` logged out → redirect `/login`

### 2. Garden CRUD (`garden-crud.spec.ts`)

1. Create garden 20×10 ft → appears in list
2. Submit width `0` → validation error
3. Open garden → planner/editor loads

### 3. Beds & paths (`layout-beds-paths.spec.ts`)

1. Add bed inside garden → visible on canvas
2. Add path → distinct from bed
3. Attempt overlapping bed → blocked

### 4. Catalog (`plant-catalog.spec.ts`)

1. Search "Tomato" → results with type
2. Open detail → spacing, companions visible

### 5. Planting (`planting-validation.spec.ts`)

1. Place Tomato on bed → persists after reload
2. Place Fennel adjacent to Tomato → blocked

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `docker is required for e2e:db:ensure` | Install Docker; start Docker Desktop |
| `connection refused` Postgres | Run `npm run e2e:db:ensure` |
| `Password for user …` with native psql | Use Docker path above; don't use `createdb` with macOS user |
| `Email already registered` locally | Run `npm run e2e:reset` or use unique emails |
| Redirect loop on login | Set `AUTH_SECRET` env var |
| Canvas click misses bed | Increase timeout; check garden has bed fixture |
| Smoke exceeds 8 min | Run with `--workers=1`; profile slow spec |

## Artifacts on Failure

- Trace: `test-results/` (on first retry per config)
- Re-run locally: `npx playwright show-trace test-results/.../trace.zip`

## Related Docs

- [test-fixtures.md](./contracts/test-fixtures.md) — helper API
- [ci-pipeline.md](./contracts/ci-pipeline.md) — GitHub Actions
- [journey-map.md](./contracts/journey-map.md) — coverage matrix
