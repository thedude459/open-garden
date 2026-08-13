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

GitHub Actions runs on every PR and push to `main` / `*-plant-database`:

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
| `libs/auth` | `auth` | layer:domain |

See `specs/001-plant-database/plan.md` for architecture details.
