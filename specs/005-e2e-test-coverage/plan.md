# Implementation Plan: End-to-End Test Coverage

**Branch**: `007-e2e-test-coverage` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature 005 spec (clarified 2026-07-07 — dedicated test DB reset, seeded
minimal catalog, UI auth specs + API session shortcuts, PR smoke vs full CI suite,
mobile click-to-place only). Builds on Features 001–004 (all user-facing journeys).

## Summary

Replace skipped, auth-blocked Playwright specs with a **reliable end-to-end test
harness** covering registration through visual planner interactions. Introduce
`globalSetup` database reset + catalog seed, reusable Playwright fixtures for
authenticated sessions and garden factories, tagged **smoke** (`@smoke`) vs **full**
projects, and a GitHub Actions workflow with PostgreSQL service container.

**Technical approach**: Extend existing Playwright + Vitest stack; add
`scripts/e2e-reset-db.ts` and `scripts/e2e-seed-catalog.ts` (wraps
`lib/reference/seed-companions.ts`); `tests/e2e/fixtures/` for API auth shortcuts;
refactor six existing spec files to remove `test.skip` placeholders; add new specs
for auth UI, garden CRUD, beds/paths, and journey map in `contracts/journey-map.md`.
No product feature code changes except optional `data-testid` attributes on critical
forms where role selectors are ambiguous.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS (unchanged from 001–004)

**Primary Dependencies**: Next.js 15, React 19, PostgreSQL 16, Drizzle ORM, Auth.js
v5 (Credentials), Playwright 1.53, Vitest 3.2 (existing)

**Storage**: Dedicated PostgreSQL database (`garden_e2e` locally; CI service
container). Full truncate + migrate + seed before each suite run (FR-018, FR-019).

**Testing**: Playwright (primary deliverable); Vitest unchanged for unit tests.
Playwright `globalSetup` for DB reset/seed; `storageState` + per-test API user
creation for isolation (FR-012, FR-013).

**Target Platform**: CI (GitHub Actions ubuntu-latest + Postgres 16); local dev
with Docker Postgres or existing `localhost:5432` test DB

**Project Type**: Test infrastructure on existing full-stack monolith (no new
runtime services)

**Performance Goals**: PR smoke subset < 8 min CI (SC-003); full suite < 15 min;
single journey spec runnable locally in < 2 min with warm server

**Constraints**: Auth UI flows only in `auth.spec.ts`; other specs use API
register + programmatic credentials sign-in; mobile phone tests exclude layout
editing (FR-010); Chromium-only in v1 (existing `playwright.config.ts`); workers=1
in CI to reduce DB contention; trace on first retry (FR-017)

**Scale/Scope**: ~12 E2E spec files; ~50 test cases; 4 Tomato/Basil/Fennel/Apple
seed plants; journey map covering 001–004 user stories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Horticultural Knowledge Engine (I)**: E2E planting tests assert catalog-driven
      spacing/incompatibility outcomes via seeded Tomato/Fennel pair — verifies engine
      integration, does not duplicate unit validation logic
- [x] **Layout & Placement Validation (II)**: Specs cover hard-block placement and
      boundary/overlap layout rules end-to-end (FR-006, FR-008)
- [N/A] **Weather-Aware Task Scheduling (III)**: Out of scope for E2E v1
- [N/A] **Organic & Safety-First (IV)**: No new recommendation surfaces
- [x] **Persistence & Extensibility (V)**: Tests verify garden/placement persistence
      after reload; fixture pattern extensible for future modules
- [x] **Domain Requirements**: Journey map traces catalog, layout, planner, and UX
      specs; orchard tree spacing hard-block verified in `growing-area-types.spec.ts`
      E2E (T040)
- [x] **Spec-Driven Quality Gates**: This feature *is* the quality gate layer for
      001–004; FR/SC mapped to contracts and quickstart

**Post-design re-check**: All gates pass. E2E suite validates constitution II
behaviors through UI; no bypass of validation in test shortcuts (API setup creates
users/gardens only, not placements).

## Project Structure

### Documentation (this feature)

```text
specs/005-e2e-test-coverage/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1 — test entities & fixture lifecycle
├── quickstart.md        # Phase 1 — local + CI commands
├── contracts/
│   ├── test-fixtures.md # Auth/garden/catalog fixture contract
│   ├── ci-pipeline.md   # PR smoke vs full suite workflow
│   └── journey-map.md   # 001–004 story → spec mapping
└── tasks.md             # Phase 2 — /speckit-tasks
```

### Source Code (repository root — additions / changes)

```text
playwright.config.ts                 # globalSetup, smoke/full projects, env
package.json                         # test:e2e:smoke, test:e2e:full, e2e:reset

scripts/
├── e2e-reset-db.ts                  # Truncate app tables, run migrations
└── e2e-seed-catalog.ts              # Seed minimal catalog (+ planner assets)

tests/e2e/
├── global-setup.ts                  # Reset DB + seed before suite
├── fixtures/
│   ├── auth.ts                      # registerViaApi, loginAs, testEmail
│   ├── garden.ts                    # createGardenViaApi, addBedViaApi
│   └── index.ts                     # extended test base export
├── auth.spec.ts                     # NEW — full UI register/login @smoke
├── garden-crud.spec.ts              # NEW — create/list/open @smoke
├── layout-beds-paths.spec.ts        # NEW — beds, paths, validation @smoke
├── plant-catalog.spec.ts            # EXPAND — search, detail @smoke
├── planting-validation.spec.ts      # NEW — spacing, incompatible @smoke
├── indoor-starts.spec.ts            # NEW — indoor + direct seed
├── growing-area-types.spec.ts       # NEW — vegetable/orchard/container
├── visual-planner.spec.ts           # REFACTOR — remove skips
├── planting-interaction.spec.ts     # REFACTOR — remove skips
├── mobile-click-place.spec.ts       # REFACTOR — phone viewport only
├── visual-planner-upgrade.spec.ts   # REFACTOR — legacy garden open
└── accessibility-contrast.spec.ts   # KEEP — expand planner screen

.github/workflows/
└── e2e.yml                          # NEW — PR smoke + main/nightly full
```

**Structure Decision**: Single monorepo layout; all E2E infrastructure under
`tests/e2e/` and `scripts/e2e-*.ts` per existing `playwright.config.ts` conventions.

## Phase 0: Research Summary

See [research.md](./research.md). All technical unknowns resolved:

| Unknown | Decision |
|---------|----------|
| DB reset strategy | Truncate + `drizzle-kit migrate` via `e2e-reset-db.ts` |
| Catalog seed | Reuse `lib/reference/seed-companions.ts` SEED_PLANTS |
| Auth shortcut | API register + Playwright credentials CSRF sign-in helper |
| Smoke vs full | Playwright `@smoke` tag + separate npm scripts |
| Mobile scope | Phone project uses `iPhone 13` device; no bed/path layout tests |
| CI Postgres | GitHub Actions `services.postgres` + `DATABASE_URL` override |

## Phase 1: Design Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Test entity model | [data-model.md](./data-model.md) | Fixture lifecycle, isolation rules |
| Fixture contract | [contracts/test-fixtures.md](./contracts/test-fixtures.md) | Helper API surface |
| CI contract | [contracts/ci-pipeline.md](./contracts/ci-pipeline.md) | Workflow triggers, env vars |
| Journey map | [contracts/journey-map.md](./contracts/journey-map.md) | FR-015 / SC-005 traceability |
| Quickstart | [quickstart.md](./quickstart.md) | Developer runbook |

## Implementation Phases (for `/speckit-tasks`)

### Phase A — Harness (P1 infrastructure)

1. `e2e-reset-db.ts` + `e2e-seed-catalog.ts`
2. `global-setup.ts` wired in `playwright.config.ts`
3. `fixtures/auth.ts` + `fixtures/garden.ts`
4. `.env.e2e.example` documenting `DATABASE_URL`, `AUTH_SECRET`
5. `package.json` scripts: `e2e:reset`, `test:e2e:smoke`, `test:e2e:full`

### Phase B — Smoke specs (P1/P2, PR gate)

1. `auth.spec.ts` — UI register/login/redirects
2. `garden-crud.spec.ts` — create, invalid dims, list, open
3. `layout-beds-paths.spec.ts` — bed + path + overlap/boundary
4. Expand `plant-catalog.spec.ts`
5. `planting-validation.spec.ts` — Tomato ok, Fennel blocked

### Phase C — Full suite (P2/P3, merge/nightly)

1. `indoor-starts.spec.ts`, `growing-area-types.spec.ts`
2. Refactor visual-planner, planting-interaction, mobile-click-place
3. Expand accessibility-contrast for planner controls
4. Complete `journey-map.md` exclusions

### Phase D — CI

1. `.github/workflows/e2e.yml` — PR `@smoke`, push main + nightly `full`
2. Verify SC-003 timing; tune workers/timeouts

## Complexity Tracking

> No constitution violations requiring justification.

## Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| NextAuth CSRF flakiness in API login helper | Centralize in `loginAs()`; retry once; document in quickstart |
| Canvas pointer tests flaky | Use `data-testid` on beds where needed; `page.waitForResponse` on placement POST |
| CI suite exceeds 15 min | Smoke on PR only; parallelize read-only specs in full suite later |
| Local dev without test DB | `quickstart.md` documents `createdb garden_e2e` one-time setup |

## Next Command

`/speckit-tasks` — generate dependency-ordered `tasks.md` from this plan.
