# Open Garden

Home garden planning PWA — **Nx monorepo** with NestJS API and Angular web client.

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres
nx run api:sync-plants
# terminal 1
nx serve api
# terminal 2
nx serve web
```

Demo users (after sync):

- `gardener@example.com` / `password123`
- `admin@example.com` / `password123` (admin sync)

## Tests (same as CI)

Unit tests and the coverage gate (≥80%) are the GitHub `test` job. Playwright is
the `e2e` job (Postgres, fixture seed, API `:3000`, web `:4200`).

```bash
npm test              # Nx unit tests + Vitest coverage (CI test job)
npm run e2e           # Compose Postgres if needed, seed, serve, Playwright
npm run test:all      # npm test && npm run e2e
npm run e2e:only      # Playwright only (API + web already running)
```

Local `npm test` runs every project. In GitHub Actions the same script uses
`nx affected` (with `nx-set-shas`). `npm run e2e` installs Playwright Chromium,
starts the same stack as CI, then stops the API and web processes when it
finishes. If Docker is not running, the e2e script starts it (Docker Desktop
on macOS) and waits until the daemon is ready before Compose Postgres.

## Common Nx commands

```bash
nx show projects
nx graph
nx serve api
nx serve web
nx test plant-catalog
nx run-many -t test --all
nx run api:sync-plants
nx run plant-catalog-data:migrate
nx e2e web-e2e
nx affected -t test
```

## Operator plant sync

```bash
nx run api:sync-plants
# or authenticated admin:
# POST /api/admin/plants/sync { "provider": "fixture", "limit": 500 }
```

Set `PLANT_PROVIDER=perenual` and `PERENUAL_API_KEY` for the HTTP adapter.

## CI

GitHub Actions runs on every PR and push to `main` / `*-plant-database` /
`*-household-gardens` / `*-planting-calendar`. Local equivalents: `npm test` and `npm run e2e`
(`scripts/ci/test.sh`, `scripts/ci/e2e.sh`).

| Job / workflow | Purpose |
|----------------|---------|
| `test` | Nx affected tests + Vitest coverage gate (≥80% on domain libs) |
| `lint` | Nx affected ESLint (quality gate) |
| `build` | Nx affected builds (`web` production, `api` typecheck) |
| `sca` | `npm audit` (high+) + Trivy fs (HIGH/CRITICAL) + OSV lockfile scan |
| `secrets` | Gitleaks |
| `e2e` | Playwright against seeded API + web |
| `CodeQL` (`analyze`) | SAST for JavaScript/TypeScript |

CI uses Node **24.15**. Actions are SHA-pinned. Shared setup: `.github/actions/setup-node`.
Dependabot opens weekly npm + Actions PRs. `main` requires the status checks above.

## Layout

| Path | Nx project | Tags |
|------|------------|------|
| `apps/api` | `api` | type:app, scope:api |
| `apps/web` | `web` | type:app, scope:web |
| `apps/api-e2e` | `api-e2e` | type:e2e |
| `apps/web-e2e` | `web-e2e` | type:e2e |
| `libs/shared-types` | `shared-types` | layer:types |
| `libs/plant-catalog` | `plant-catalog` | layer:domain |
| `libs/plant-favorites` | `plant-favorites` | layer:domain |
| `libs/plant-catalog-data` | `plant-catalog-data` | layer:data-access |
| `libs/plant-provider` | `plant-provider` | layer:data-access |
| `libs/gardens` | `gardens` | layer:domain |
| `libs/planting-calendar` | `planting-calendar` | layer:domain |
| `libs/seasonal-plantings` | `seasonal-plantings` | layer:domain |
| `libs/garden-layout` | `garden-layout` | layer:domain |
| `libs/auth` | `auth` | layer:domain |

See `specs/001-plant-database/quickstart.md`,
`specs/002-household-gardens/quickstart.md`,
`specs/003-planting-calendar/quickstart.md`,
`specs/004-seasonal-plantings/quickstart.md`, and
`specs/005-garden-layout/quickstart.md` for architecture details,
household-garden verify steps (create/list/detail, site profile, sharing,
offline read), planting-calendar verify steps (per-garden ranges, frost
shift, type filter, this-week emphasis, offline cache), seasonal-plantings
verify steps (record/dates/confirm-delete, named beds/groups/filter, offline
queue and no-resurrect), and garden-layout verify steps (beds to scale,
spacing/fit save gate, offline read cache).
