# Open Garden

Home garden planning PWA — **Nx monorepo** with NestJS API and Angular web client.

## Quick start

Nx is a local devDependency (`npx nx …` or `npm run …`). Do not expect a global `nx` binary.

Host workflow (inner loop): Postgres in Compose, API and web on this machine.

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run api:sync-plants
# terminal 1
npm run api:serve
# terminal 2
npm run web:serve
```

Web: `http://localhost:4200`. API: `http://localhost:3000` (proxied as `/api`).

Demo users (after sync):

- `gardener@example.com` / `password123`
- `admin@example.com` / `password123` (admin pipeline)

### Stacked app (Docker Compose)

One origin for pages and API. Local testing binds **loopback only**.

```bash
cp -n .env.example .env
docker compose --profile app up -d --build
```

Open **`http://127.0.0.1:8080`** on this machine (not a LAN IP). Sign in with the demo gardener above. First boot migrates and loads the fixture catalog; later boots skip the pipeline.

Stop UI and API without wiping gardens: `docker compose --profile app stop api web`. Postgres stays up. `docker compose --profile app down` does **not** remove `pgdata` unless you pass `-v` — do not use `-v` unless you mean to destroy stored data.

If **8080** or **5432** is already in use, Docker/Compose prints a bind error that names the port. Stop the other process or set `WEB_PORT`.

#### NAS production

1. Start Postgres alone: `docker compose up -d postgres` with `POSTGRES_PASSWORD` (and user/db if not the local defaults) from the **NAS Docker UI** — not a file in git.
2. Start UI and API: `WEB_HOST=0.0.0.0 docker compose --profile app up -d api web` with `SESSION_SECRET` from the same NAS setup.
3. Gardeners open `http://<NAS-IP>:8080`. Map host **80** → container **8080** in the NAS UI if you want port 80.
4. Stop UI/API with `docker compose --profile app stop api web`; leave Postgres running.

Do not commit a production `.env`. Local defaults in `.env.example` (`open_garden`, `dev-only-…`) are for laptop testing only.

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
npx nx show projects
npx nx graph
npm run api:serve
npm run web:serve
npx nx test plant-catalog
npx nx run-many -t test --all
npm run api:sync-plants
npm run migrate
npm run e2e:only
npx nx affected -t test
```

## Operator catalog pipeline

```bash
npm run api:sync-plants         # blocking full fixture load (no 500 cap)
# In-product admin: sign in as admin@example.com and open /admin/pipeline
# HTTP: POST /api/admin/pipeline/runs (202, continues in-process)
```

Optional live source: set `PERENUAL_API_KEY` and PATCH settings
`sourceOrder` to `["fixture", "perenual"]`. Local/CI default is fixture only.

See `specs/007-data-pipeline/quickstart.md` for populate / merge / monitor checks.

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
| `libs/catalog-pipeline` | `catalog-pipeline` | layer:domain |
| `libs/auth` | `auth` | layer:domain |
| `libs/care-reminders` | `care-reminders` | layer:domain |
| `libs/web-ui` | `web-ui` | notices and busy helpers |

See `specs/001-plant-database/quickstart.md`,
`specs/002-household-gardens/quickstart.md`,
`specs/003-planting-calendar/quickstart.md`,
`specs/004-seasonal-plantings/quickstart.md`,
`specs/005-garden-layout/quickstart.md`,
`specs/006-care-reminders/quickstart.md`,
`specs/007-data-pipeline/quickstart.md`,
`specs/008-garden-planner-ux/quickstart.md`,
`specs/009-ui-feedback-polish/quickstart.md`, and
`specs/010-fix-planner-placement/quickstart.md` for architecture details,
household-garden verify steps (create/list/detail, site profile, sharing,
offline read), planting-calendar verify steps (per-garden ranges, frost
shift, type filter, this-week emphasis, offline cache), seasonal-plantings
verify steps (record/dates/confirm-delete, named beds/groups/filter, offline
queue and no-resurrect), garden-layout verify steps (beds to scale,
spacing/fit save gate, offline read cache), and garden planner UX verify
steps (Garden Overview map of beds and areas, Transplant View indoor starts,
Bed View tray of unplaced transplants, shared in-memory draft until Save,
pan/zoom, offline mutations leave the draft unchanged). Waiting actions show
busy on the control and a shared **Notification** (success auto-clears;
errors and **Drop missed a bed** stay until **Dismiss**). Overview uses a
**You are here** marker, **Open bed {name}**, and **Bed** / **Area** labels.
