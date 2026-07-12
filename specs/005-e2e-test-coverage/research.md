# Research: End-to-End Test Coverage

**Date**: 2026-07-07 | **Plan**: [plan.md](./plan.md)

## 1. Test Database Reset Strategy

### Decision: Truncate application tables + re-run migrations in `globalSetup`

**Rationale**: Clarification session chose dedicated test DB reset before each CI
suite. Drizzle migrations are idempotent; truncate-all (respecting FK order) is
faster than drop/create database. Script `scripts/e2e-reset-db.ts` runs
`TRUNCATE ... CASCADE` on user-owned tables (`users`, `gardens`, `garden_areas`,
`plant_placements`, `indoor_starts`, `bed_planting_history`, etc.) then ensures
schema via `npm run db:migrate`. Catalog tables (`canonical_plants`,
`plant_relationships`) truncated and re-seeded in step 2.

**Alternatives considered**:
- **Docker ephemeral container per job**: Heavier CI setup; migrate cost similar.
- **Unique data only, no reset**: Risks collision under parallel tests; rejected.
- **In-memory SQLite for E2E**: Schema divergence from production Postgres; rejected.

## 2. Minimal Catalog Fixture

### Decision: Reuse `lib/reference/seed-companions.ts` `SEED_PLANTS` array

**Rationale**: Already contains Tomato, Basil, Fennel (incompatible with Tomato),
and Apple (fruit_tree with rootstock spacing). Satisfies FR-019 for search, detail,
spacing, incompatibility, and orchard scenarios without external sync dependency.
`scripts/e2e-seed-catalog.ts` calls `seedReferenceData()` + `seed:planner-assets`
for illustration metadata.

**Alternatives considered**:
- **Live `sync:plants` in CI**: Slow, flaky, network-dependent; rejected.
- **Separate JSON fixture file**: Duplicates existing seed logic; rejected.
- **MSW mock catalog API**: Doesn't test real DB queries; rejected for smoke paths.

## 3. Authenticated Session Setup

### Decision: API register + programmatic Credentials sign-in; UI flows isolated to `auth.spec.ts`

**Rationale**: Clarification chose hybrid approach. `registerViaApi(request, email,
password)` POSTs `/api/auth/register`. `loginAs(page, email, password)` navigates
to `/login`, submits credentials form (single UI interaction) OR uses NextAuth CSRF
flow via `page.request` to obtain session cookie — prefer form submit for cookie
fidelity with minimal overhead. Each non-auth test generates unique
`e2e-{uuid}@test.local` email for FR-013 isolation within a reset DB.

**Alternatives considered**:
- **UI register in every test**: Slow (~3s overhead per test); rejected.
- **JWT injection / forged cookie**: Bypasses real auth path; rejected.
- **Shared global user**: Violates FR-013 parallel safety; rejected.

## 4. Playwright Project Structure (Smoke vs Full)

### Decision: Tag-based filtering with `@smoke` annotation

**Rationale**: Clarification: P1/P2 on PR, full on merge/nightly. Annotate smoke
tests `test('@smoke ...')` or `test.describe('@smoke', ...)`. npm scripts:
`playwright test --grep @smoke` (PR) and `playwright test` (full). Keeps one config,
one globalSetup, shared fixtures.

**Alternatives considered**:
- **Separate config files**: Duplicates webServer/globalSetup; rejected.
- **Two test directories**: Harder to share fixtures; rejected.
- **Manual CI file lists**: Drifts from tags; rejected.

## 5. Mobile Viewport Scope

### Decision: Dedicated Playwright project `mobile-chrome` with `iPhone 13` profile

**Rationale**: Clarification limits phone tests to click-to-place; layout editing
desktop-only. `mobile-click-place.spec.ts` runs under mobile project; bed/path
specs run under `chromium` desktop only. Tablet (768px) covered by desktop project
with viewport width set where needed.

**Alternatives considered**:
- **Single project, per-test viewport**: Works but mixes concerns; mobile project clearer.
- **Skip all mobile E2E**: Violates FR-010; rejected.

## 6. CI Pipeline & PostgreSQL

### Decision: GitHub Actions workflow with `services.postgres` and env overrides

**Rationale**: No existing E2E workflow (only `sync-plants-cron.yml`). New
`.github/workflows/e2e.yml`:
- **pull_request**: `npm run test:e2e:smoke` after `db:migrate`, `globalSetup`
- **push main + schedule nightly**: `npm run test:e2e:full`
- Env: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/garden_e2e`,
  `AUTH_SECRET` from repo secret or test default, `CI=true`

**Alternatives considered**:
- **Hosted Playwright service**: Cost/complexity; defer.
- **Skip CI initially**: Violates FR-014; rejected.

## 7. Selector Strategy & Flake Reduction

### Decision: Role-first selectors; add `data-testid` only where roles collide

**Rationale**: Existing components use semantic roles (`heading`, `button`, `alert`).
Prefer `getByRole`. Add `data-testid` to `GardenForm`, bed editor save, and canvas
bed regions only if flake persists in implementation. Wait for network:
`page.waitForResponse(/\/api\/gardens/)` on save actions.

**Alternatives considered**:
- **data-testid everywhere**: Maintenance burden; use sparingly.
- **CSS class selectors**: Brittle with design system; avoid.

## 8. Journey Map Maintenance

### Decision: `contracts/journey-map.md` as living traceability matrix

**Rationale**: FR-015 / SC-005 require documented mapping. Table columns: Source
spec, User story, E2E spec file, Status (covered/partial/excluded), Notes.
Updated in Phase C when full suite lands.

**Alternatives considered**:
- **Spreadsheet external**: Not version-controlled; rejected.
- **Code comments only**: Not visible to stakeholders; rejected.
