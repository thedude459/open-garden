# Contributing to Open Garden

Thanks for helping. This guide covers running the app from source, the tests,
and how changes get in. To *run* Open Garden rather than work on it, see the
[README](README.md) and [docs/deploy.md](docs/deploy.md).

## Before you start

- Read [AGENTS.md](AGENTS.md): the project's principles (library-first,
  tests required, strict types, multi-user from the start) and coding style.
  Coding agents read it too.
- Lasting design decisions are recorded as ADRs in [docs/adr](docs/adr).
  Add one when a change is architectural.
- [docs/roadmap.md](docs/roadmap.md) lists planned work. For anything large,
  open an issue first so we can agree on the approach.
- Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Development setup

You need Node.js **24.15** (see `.nvmrc`), npm, and Docker (for Postgres).
Nx is a local dev dependency: use `npx nx …` or the `npm run` scripts, not a
global `nx`.

The inner loop runs Postgres in Docker and the API and web app on your machine:

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run api:sync-plants     # migrate, seed demo users, load the fixture catalog
npm run api:serve           # terminal 1: API on http://localhost:3000
npm run web:serve           # terminal 2: web on http://localhost:4200 (proxies /api)
```

With `SEED_DEMO_USERS=true` (the `.env.example` default) you can sign in as
`gardener@example.com` / `password123`, or `admin@example.com` / `password123`
for the admin pages.

Migrations run automatically through `npm run api:sync-plants` and on every API
container start. They are tracked, so each one runs once per database. To add
one, change `libs/plant-catalog-data/src/lib/schema.ts` and run
`npm run migrate:generate`.

To run the same containers people install, use
`docker compose --profile app up -d --build` (see the README).

## Tests

CI runs exactly these; run them before opening a pull request.

```bash
npm test              # every Nx test target, then the Vitest coverage gate (≥80%)
npm run e2e           # Postgres, seed, API + production web build, live HTTP + Playwright
npm run test:all      # both
npm run e2e:only      # Playwright only, against an API and web you already started
npx nx affected -t test   # faster local pass over what you changed
```

`npm run e2e` uses its own database, `open_garden_e2e` (created if missing), so
test data never lands in your app database. Set `DATABASE_URL` to override. It
starts Docker if needed (Docker Desktop on macOS) and stops the API and web
processes when it finishes.

Expectations for new code (from [AGENTS.md](AGENTS.md)):

- Unit tests for domain logic; keep coverage at or above the gate.
- Once a feature has UI and API, add live HTTP (`apps/api-e2e`) and Playwright
  (`apps/web-e2e`) tests. See [apps/web-e2e/CONVENTION.md](apps/web-e2e/CONVENTION.md).
- Prefer role-based Playwright locators, and never fixed sleeps.

## Useful commands

```bash
npx nx show projects
npx nx graph
npx nx test plant-catalog
npx nx run-many -t lint --all
npm run migrate                 # apply migrations with drizzle-kit
npm run api:sync-plants         # migrate, seed, and run the full fixture catalog load
```

The catalog pipeline also runs from the admin page (`/admin/pipeline`) or
`POST /api/admin/pipeline/runs`. For the optional Perenual source, set
`PERENUAL_API_KEY` and add `"perenual"` to the pipeline's `sourceOrder`.
See [docs/catalog-pipeline-checks.md](docs/catalog-pipeline-checks.md).

## Continuous integration

GitHub Actions runs on every pull request and push to `main`. Every job below
is a required check on `main`.

| Check | What it does |
|---|---|
| `verify` | Affected ESLint, the Vitest coverage gate, the dependency-license check, affected builds, and a report-only whole-codebase coverage table |
| `sca` | `npm audit` (high+) and Trivy filesystem scan, compared with the base so only new findings fail |
| `secrets` | Gitleaks |
| `workflows` | actionlint and zizmor on the GitHub Actions workflows |
| `analyze` | CodeQL for JavaScript/TypeScript |
| `images (api)`, `images (web)` | hadolint, image build, and Trivy image scan (fixable HIGH/CRITICAL fail); skipped for documentation-only changes |
| `e2e` | Live HTTP, then Playwright (2 workers, no retries) against a seeded API and web app |

The `e2e` job passes without running browsers when a pull request only changes
documentation, editor or formatter config, the lockfile, development
dependencies, or workflow pins (`scripts/ci/e2e-needed.js`). A failed run
uploads the Playwright report and traces.

Outside pull requests, [Scorecard](.github/workflows/scorecard.yml) checks supply-chain practices on every push to `main` and weekly, and [Image scan](.github/workflows/image-scan.yml) scans the latest published images every week.

Actions are pinned by commit SHA. Dependabot opens weekly updates for npm,
GitHub Actions, and the Docker images; patch and minor updates merge on their
own once checks pass, and majors wait for review.

## Releasing

Releases use [semantic versioning](https://semver.org/) tags (`v0.1.0`).
While the project is pre-1.0, releases are still normal (not pre-release)
GitHub Releases: the 0.x number is what says "early". Bump the minor version
for meaningful changes and the patch version for fixes; a minor bump may
include breaking changes, so say so in the notes. Commit messages need no
special format: the notes come from merged pull request titles.

Use the pre-release flag only for release candidates (`v0.2.0-rc.1`) you want
to try before the real release. Pre-releases do not become "latest", so the
README install link and the `latest` image tag skip them.

1. Make sure `main` is green.
2. Publish a GitHub Release with a new tag, letting GitHub write the notes:

   ```bash
   gh release create v0.1.0 --target main --generate-notes
   ```

   Edit the notes to call out anything operators must do (new settings,
   breaking changes). Mark a release candidate (`v0.2.0-rc.1`) as a
   pre-release; it then does not move the `latest` tag.
3. The [Release workflow](.github/workflows/release.yml) then:
   - builds `api` and `web` for `linux/amd64` and `linux/arm64`
   - pushes them to `ghcr.io/thedude459/open-garden-{api,web}` tagged `0.1.0`,
     `0.1`, `0`, and `latest`, with an SBOM and build provenance
   - records a GitHub attestation and scans the pushed images with Trivy
   - attaches `compose.yaml` (from `deploy/compose.yaml`, with the version
     pinned) to the release; the README install downloads it

The first time, check that both packages under the repository's **Packages**
are **public** (Package settings → Change visibility), or installs cannot pull
them.

## Pull requests

- Branch from `main`; keep a pull request to one change.
- Describe the problem, the approach, and how you tested it.
- Note any deliberate exception to [AGENTS.md](AGENTS.md) in the description.
- By contributing, you agree your contribution is licensed under the project's
  license, [AGPL-3.0-or-later](LICENSE).

## Project layout

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
| `libs/garden-place` | `garden-place` | layer:domain (place lookup, climate, maps) |
| `libs/web-ui` | `web-ui` | notices and busy helpers |
