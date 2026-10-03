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

Demo users (after sync, when `SEED_DEMO_USERS=true` in `.env`):

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
2. Start UI and API: `WEB_HOST=0.0.0.0 docker compose --profile app up -d api web` with a **unique** `SESSION_SECRET` from the same NAS setup (not the example in `.env.example`). Set `SEED_DEMO_USERS=false` (or omit it) so gardener/admin are not created.
3. Gardeners open `http://<NAS-IP>:8080`. Map host **80** → container **8080** in the NAS UI if you want port 80. If you terminate TLS in front of the stack, set `COOKIE_SECURE=true` (or omit `COOKIE_SECURE` and pass `X-Forwarded-Proto: https`).
4. Stop UI/API with `docker compose --profile app stop api web`; leave Postgres running.

Do not commit a production `.env`. Local defaults in `.env.example` (`open_garden`, `dev-only-…`, `SEED_DEMO_USERS=true`) are for laptop testing only.

## Tests (same as CI)

Unit tests and the coverage gate (≥80%) run in the GitHub `verify` job. Playwright is
the `e2e` job (Postgres, fixture seed, API `:3000`, web `:4200`).

```bash
npm test              # Local: every Nx test target, then the Vitest coverage gate
npm run e2e           # Compose Postgres if needed, seed, serve, Playwright
npm run test:all      # npm test && npm run e2e
npm run e2e:only      # Playwright only (API + web already running)
```

Local `npm test` runs every project, then the coverage gate. In GitHub Actions the
same script runs only the coverage gate (one Vitest process). Affected lint and
build still use `nx-set-shas`. `npx nx affected -t test` is the faster local pass.
`npm run e2e` installs Playwright Chromium,
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

GitHub Actions runs on every PR and push to `main`. Local equivalents: `npm test` and `npm run e2e`
(`scripts/ci/test.sh`, `scripts/ci/e2e.sh`).

| Job / workflow | Purpose |
|----------------|---------|
| `verify` | Affected ESLint, Vitest coverage gate (≥80% on domain libs), affected builds (`web` production, `api` typecheck) |
| `sca` | `npm audit` (high+) + Trivy fs (HIGH/CRITICAL), diffed against the PR base or the previous commit on `main` |
| `secrets` | Gitleaks |
| `e2e` | Live HTTP, then Playwright (2 workers, no retries) against seeded API + web. Failure uploads the report and traces. A pull request that only changes the lockfile, development dependencies, or workflow pins passes this check without browsers. A production `dependencies` change still runs the suite |
| `CodeQL` (`analyze`) | SAST for JavaScript/TypeScript |

CI uses Node **24.15** (`.nvmrc`). Actions are SHA-pinned. Shared setup: `.github/actions/setup-node`.
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
