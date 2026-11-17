# Contributing to Open Garden

Thanks for helping. This guide covers running the app from source, the tests,
and how changes get in. To *run* Open Garden rather than work on it, see the
[README](README.md) and [docs/deploy.md](docs/deploy.md).

Plant data (sowing windows, spacing, families, companions) lives in its own
CC0 repository, [open-garden-data](https://github.com/thedude459/open-garden-data).
Corrections and new crops go there, and need no TypeScript.

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
`npm run migrate:generate`; add any CHECK constraints to the generated SQL by
hand (`schema.ts` does not declare them). Never edit a migration that has
shipped in a release, including `0000_baseline.sql`
([ADR 0018](docs/adr/0018-baseline-migration.md)).

To run the same containers people install, use
`docker compose --profile app up -d --build` (see the README).

## Tests

CI runs exactly these; run them before opening a pull request.

```bash
npm test              # every Nx test target, then the Vitest coverage gate (≥80%)
npm run e2e           # Postgres, seed, API + production web build, live HTTP + Playwright
npm run test:all      # both
npm run e2e:stack     # Postgres, seed, API + production web, left running (Ctrl-C stops)
npm run e2e:only      # Playwright only, against a running stack (e.g. from e2e:stack)
npx nx affected -t test   # faster local pass over what you changed
npm run format        # format with Prettier (CI runs npm run format:check)
```

The one-time Prettier reformat is listed in `.git-blame-ignore-revs`; run
`git config blame.ignoreRevsFile .git-blame-ignore-revs` once so local
`git blame` skips it (GitHub does this automatically).

`npm run e2e` uses its own database, `open_garden_e2e` (created if missing), so
test data never lands in your app database. Set `DATABASE_URL` to override. It
starts Docker if needed (Docker Desktop on macOS) and stops the API and web
processes when it finishes.

**Running the browser tests while you work.** Start the stack once with
`npm run e2e:stack` and leave it running, then run specs against it with
`npm run e2e:only -- apps/web-e2e/src/<name>.spec.ts`. Both scripts stop with a
message if port 3000 or 4200 is already taken, usually by a server from an
earlier run that is still going. Stop that server first, so you never test an
old build. To use a Chromium already on your machine instead of Playwright's
download, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its path.

**Coverage.** Two numbers matter:

- The **80% gate** on the domain libraries (`npm run test:coverage`).
- The **per-area ratchet** (`npm run test:coverage:all`): every app and lib has a
  floor in [`scripts/ci/coverage-floors.json`](scripts/ci/coverage-floors.json),
  and CI fails if an area's unit coverage drops below it. When you add tests,
  raise the floor in the same pull request
  (`node scripts/ci/coverage-summary.js --write scripts/ci/coverage-floors.json`);
  lower one only on purpose, and say why.

`E2E_COVERAGE=1 npm run e2e` also records which API code the live HTTP and
Playwright suites run; CI reports *unit* and *unit + live* coverage per area in
the `e2e` job summary.

Expectations for new code (from [AGENTS.md](AGENTS.md)):

- Unit tests for domain logic; keep coverage at or above the gate.
- Repository (SQL) changes get a `*.db.spec.ts` next to the repository. Use
  `createTestDb()` from `libs/plant-catalog-data/src/lib/test-db.ts`: an
  in-process PostgreSQL (PGlite) with every migration applied, no Docker.
- Logic with a clear invariant (geometry, dates, ranges) gets a
  `*.property.spec.ts` with [fast-check](https://fast-check.dev/).
- Angular components and anything that needs Angular's injector get a
  `*.component.spec.ts` next to the file. These run under Angular's own Vitest
  runner in a simulated browser (`npx nx test web`), with `TestBed` and
  `HttpTestingController`; see `apps/web/src/app/auth/login.page.component.spec.ts`.
  Plain functions in `apps/web` keep ordinary `*.spec.ts` files, listed in
  `vitest.config.ts`.
- Once a feature has UI and API, add live HTTP (`apps/api-e2e`) and Playwright
  (`apps/web-e2e`) tests. See [apps/web-e2e/CONVENTION.md](apps/web-e2e/CONVENTION.md).
- Prefer role-based Playwright locators, and never fixed sleeps.

**Bugs and flaky tests found along the way.** A bug you find while working on
something else gets a GitHub issue (label `bug`), even when you fix it in the
same pull request, so the list of known problems lives in one place; a fix in
the pull request closes the issue with `Fixes #n`. A test that passes and
fails on the same code also gets the `flaky-test` label: say how often it
failed (`--repeat-each`), and whether it also fails on `main`. Never skip or
retry a flaky test to get green; fix the cause.

**Workarounds in tests.** When you work around a problem to make a test run
(a different action than a person would take, a local-only config, a step done
by hand), open an issue for the real problem with the labels `bug` and
`test-workaround`, and add it to **Test workarounds** in `docs/roadmap.md`.
Remove the line when the issue is fixed. A workaround never goes into the
repository without its issue.

## Useful commands

```bash
npx nx show projects
npx nx graph
npx nx test plant-catalog
npx nx test web                 # Angular component tests
npx nx run-many -t lint --all
npm run migrate                 # apply migrations with drizzle-kit
npm run api:sync-plants         # migrate, seed, and import the bundled plant catalog
```

The plant catalog is the open-garden-data release in
`libs/plant-provider/catalog/`, pinned by SHA-256 in
`libs/plant-provider/src/lib/dataset-release-provider.ts`. To move to a newer
release, replace both files there (the JSON and its `.sigstore.json`), run
`gh attestation verify <file> --owner thedude459`, update `BUNDLED_CATALOG`,
and update the e2e specs if crops they use changed. The import also runs from
the admin page (`/admin/pipeline`) or `POST /api/admin/pipeline/runs`. See
[docs/catalog-pipeline-checks.md](docs/catalog-pipeline-checks.md) and
[ADR 0020](docs/adr/0020-dataset-as-the-catalog.md).

## Continuous integration

GitHub Actions runs on every pull request and push to `main`. Every job below
is a required check on `main`.

| Check | What it does |
|---|---|
| `verify` | Prettier check, affected ESLint, the Vitest coverage gate, the per-area coverage ratchet, the dependency-license check, and affected builds |
| `sca` | `npm audit` (high+) and Trivy filesystem scan, compared with the base so only new findings fail |
| `secrets` | Gitleaks |
| `workflows` | actionlint and zizmor on the GitHub Actions workflows |
| `analyze` | CodeQL for JavaScript/TypeScript |
| `images (api)`, `images (web)` | hadolint, image build, and Trivy image scan (fixable HIGH/CRITICAL fail); skipped for documentation-only changes |
| `e2e` | Live HTTP, then Playwright (4 workers, no retries) against a seeded API (run from the same bundle the Docker image ships) and web app; reports unit + live coverage |

The `e2e` job passes without running browsers when a pull request only changes
documentation, editor or formatter config, the lockfile, development
dependencies, or workflow pins (`scripts/ci/e2e-needed.js`). A failed run
uploads the Playwright report and traces.

Outside pull requests, [Scorecard](.github/workflows/scorecard.yml) checks supply-chain practices on every push to `main` and weekly, [Image scan](.github/workflows/image-scan.yml) scans the latest published images every week, and [Dataset compatibility](.github/workflows/dataset-compat.yml) imports the latest open-garden-data release every day, so a release this app cannot read is caught before anyone upgrades to it.

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

## Translations

Open Garden is written in US English and shows English to everyone, whatever
the browser's language ([ADR 0029](docs/adr/0029-english-only-translations-by-contribution.md)).
Other languages come from people who speak them. If you would like to add
one, open an issue first so we can agree on the approach.

- **Dates and month names** already go through one setting, `APP_LOCALE` in
  `libs/web-ui/src/lib/dates.ts`, and the helpers `formatDay`,
  `formatMonthDay`, and `formatMonthName`. Use them for any new date; never
  format one by hand or with the browser's locale.
- **Interface text** is not marked for translation yet. The first translation
  sets up Angular's built-in i18n (`@angular/localize`): mark the text in the
  templates, extract `messages.xlf`, add `messages.<locale>.xlf`, and build
  one app per language. Text the API writes (Today task titles, reminder
  emails) then follows the request's language.
- **Crop names** come from the dataset: add `names.<locale>` to a crop in
  [open-garden-data](https://github.com/thedude459/open-garden-data).
- New user-facing text should be plain, short sentences, so it translates
  well.

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
