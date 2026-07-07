---
description: "Task list for End-to-End Test Coverage feature implementation"
---

# Tasks: End-to-End Test Coverage

**Input**: Design documents from `/specs/005-e2e-test-coverage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: This feature's deliverable **is** the Playwright E2E suite. Implementation
tasks write and wire E2E specs, fixtures, and CI — not separate unit tests.

**Organization**: Tasks grouped by user story. Phase 2 delivers User Story 7 (test
harness) as the blocking foundation for all journey specs.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US7)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: npm scripts and environment documentation for E2E runs

- [X] T001 Add `e2e:reset`, `test:e2e:smoke`, and `test:e2e:full` scripts to package.json per specs/005-e2e-test-coverage/plan.md
- [X] T002 [P] Create `.env.e2e.example` documenting `DATABASE_URL` and `AUTH_SECRET` for dedicated test database
- [X] T003 [P] Document local `createdb garden_e2e` one-time setup in specs/005-e2e-test-coverage/quickstart.md if not already present

---

## Phase 2: Foundational — User Story 7 (Priority: P1) Test Infrastructure

**Goal**: Reliable DB reset, catalog seed, Playwright globalSetup, and reusable fixtures
so authenticated journey tests run without `test.skip` placeholders.

**Independent Test**: Run `npm run e2e:reset` (exits 0), then
`npx playwright test tests/e2e/harness.spec.ts` — confirms seeded catalog and
`loginAs()` reaches `/gardens`.

**⚠️ CRITICAL**: No user story E2E specs can be completed until this phase is done.

- [X] T004 Implement `scripts/e2e-reset-db.ts` with truncate + `npm run db:migrate` per specs/005-e2e-test-coverage/research.md §1
- [X] T005 Implement `scripts/e2e-seed-catalog.ts` calling `seedReferenceData()` from `lib/reference/seed-companions.ts` and planner assets from `scripts/seed-planner-assets.ts` per research.md §2
- [X] T006 Create `tests/e2e/global-setup.ts` invoking reset and seed scripts before suite run
- [X] T007 [P] Create `tests/e2e/harness.spec.ts` with single test verifying globalSetup seed and `loginAs()` fixture (not tagged `@smoke`)
- [X] T008 Update `playwright.config.ts` with `globalSetup`, CI workers=1, `trace: on-first-retry`, `screenshot: only-on-failure`, and `@smoke` grep support per plan.md and FR-017
- [X] T009 [P] Implement `tests/e2e/fixtures/auth.ts` with `testEmail`, `registerViaApi`, `loginAs`, and `TEST_PASSWORD` per contracts/test-fixtures.md
- [X] T010 [P] Implement `tests/e2e/fixtures/garden.ts` with `createGardenViaApi`, `addAreaViaApi`, and `getPlantIdByName` per contracts/test-fixtures.md
- [X] T011 [P] Create `tests/e2e/fixtures/index.ts` re-exporting auth and garden helpers (climate added in T030)
- [X] T012 Add `mobile-chrome` Playwright project with `iPhone 13` device profile in `playwright.config.ts` per research.md §5

**Checkpoint**: Harness ready — journey spec implementation can begin

---

## Phase 3: User Story 1 — Account Registration and Sign-In (Priority: P1) 🎯 MVP

**Goal**: Full UI registration and sign-in coverage; protected route redirects.

**Independent Test**: `npx playwright test tests/e2e/auth.spec.ts --grep @smoke` — register, sign in, invalid inputs, and unauthenticated redirects all pass.

- [X] T013 [US1] Create `tests/e2e/auth.spec.ts` with `@smoke` UI registration happy path per FR-001
- [X] T014 [US1] Add `@smoke` UI sign-in happy path reaching protected page in `tests/e2e/auth.spec.ts` per FR-002
- [X] T015 [US1] Add invalid registration cases (bad email, duplicate, short password) to `tests/e2e/auth.spec.ts`
- [X] T016 [US1] Add incorrect credentials sign-in denial test to `tests/e2e/auth.spec.ts`
- [X] T017 [US1] Add unauthenticated redirect tests for `/plants`, `/gardens`, and garden editor routes in `tests/e2e/auth.spec.ts` per FR-003; remove duplicate `/plants` redirect from `tests/e2e/plant-catalog.spec.ts`

**Checkpoint**: Auth UI journeys covered; MVP smoke subset can include auth spec

---

## Phase 4: User Story 2 — Garden Creation and Management (Priority: P1)

**Goal**: Create garden via UI, validate dimensions, list and open gardens.

**Independent Test**: `npx playwright test tests/e2e/garden-crud.spec.ts --grep @smoke` with `loginAs()` fixture.

- [X] T018 [US2] Create `tests/e2e/garden-crud.spec.ts` with `@smoke` garden creation (name, dimensions, unit) per FR-004
- [X] T019 [US2] Add zero/negative/missing dimension validation tests to `tests/e2e/garden-crud.spec.ts` per FR-005
- [X] T020 [US2] Add garden list name/dimension display test to `tests/e2e/garden-crud.spec.ts`
- [X] T021 [US2] Add open garden → layout editor/planner loads test to `tests/e2e/garden-crud.spec.ts`

**Checkpoint**: Garden CRUD smoke path complete

---

## Phase 5: User Story 3 — Beds, Paths, and Layout Structure (Priority: P2)

**Goal**: Add beds and paths; verify boundary and overlap validation.

**Independent Test**: `npx playwright test tests/e2e/layout-beds-paths.spec.ts --grep @smoke`.

- [X] T022 [US3] Create `tests/e2e/layout-beds-paths.spec.ts` with `@smoke` plantable bed creation inside garden boundary per FR-006
- [X] T023 [US3] Add non-plantable path creation and visual distinction test to `tests/e2e/layout-beds-paths.spec.ts`
- [X] T024 [US3] Add out-of-boundary bed/path save rejection test to `tests/e2e/layout-beds-paths.spec.ts`
- [X] T025 [US3] Add overlapping area save rejection test to `tests/e2e/layout-beds-paths.spec.ts`
- [X] T026 [P] [US3] Add optional soil type and sun exposure persistence test to `tests/e2e/layout-beds-paths.spec.ts`

**Checkpoint**: Layout structure smoke path complete

---

## Phase 6: User Story 4 — Plant Catalog Discovery (Priority: P2)

**Goal**: Search, browse, view plant details, and climate filter against seeded catalog.

**Independent Test**: `npx playwright test tests/e2e/plant-catalog.spec.ts --grep @smoke`.

- [X] T027 [US4] Expand `tests/e2e/plant-catalog.spec.ts` with `@smoke` search by common name "Tomato" per FR-007
- [X] T028 [US4] Add browse-by-type filter test to `tests/e2e/plant-catalog.spec.ts`
- [X] T029 [US4] Add plant detail page assertions (maturity, spacing, companions) to `tests/e2e/plant-catalog.spec.ts`
- [X] T030 [P] [US4] Implement `tests/e2e/fixtures/climate.ts` with `setTestLocationViaApi()`, export from `tests/e2e/fixtures/index.ts`, and add `@smoke` climate compatibility filter test to `tests/e2e/plant-catalog.spec.ts` per FR-007 and US4 scenario 4

**Checkpoint**: Catalog discovery smoke path complete

---

## Phase 7: User Story 5 — Planting, Validation, and Indoor Starts (Priority: P2)

**Goal**: Valid placement, spacing/incompatibility blocks, indoor start and direct seed.

**Independent Test**: `npx playwright test tests/e2e/planting-validation.spec.ts tests/e2e/indoor-starts.spec.ts --grep @smoke`.

- [X] T031 [US5] Create `tests/e2e/planting-validation.spec.ts` with `@smoke` valid Tomato placement persisting after reload per FR-008
- [X] T032 [US5] Add minimum spacing violation block test to `tests/e2e/planting-validation.spec.ts`
- [X] T033 [US5] Add Fennel adjacent to Tomato incompatibility hard-block test to `tests/e2e/planting-validation.spec.ts`
- [X] T034 [US5] Create `tests/e2e/indoor-starts.spec.ts` with `@smoke` indoor start (no bed occupancy) and direct-seed flows per FR-009
- [X] T035 [US5] Add `page.waitForResponse` on placement POST in `tests/e2e/planting-validation.spec.ts` to reduce flake per plan.md risk table

**Checkpoint**: Planting validation smoke path complete — PR smoke subset nearly complete

---

## Phase 8: User Story 6 — Visual Planner and Interaction UX (Priority: P3)

**Goal**: Illustrated picker, desktop drag-drop, mobile click-to-place, growing-area types, zoom, accessibility.

**Independent Test**: `npm run test:e2e:full` — all refactored specs pass without `test.skip`; mobile project runs click-to-place only.

- [X] T036 [US6] Refactor `tests/e2e/planting-interaction.spec.ts` to use fixtures, remove skips; full suite only (do not tag `@smoke`) per FR-010
- [X] T037 [US6] Refactor `tests/e2e/visual-planner.spec.ts` for illustrated library and desktop drag-drop with fixtures
- [X] T038 [US6] Refactor `tests/e2e/mobile-click-place.spec.ts` under `mobile-chrome` project — click-to-place only, no bed/path layout per clarification
- [X] T039 [US6] Create `tests/e2e/growing-area-types.spec.ts` for vegetable, orchard, and container/patio types per FR-011
- [X] T040 [US6] Add orchard Apple tree spacing hard-block test to `tests/e2e/growing-area-types.spec.ts` per constitution II and plan.md
- [X] T041 [US6] Refactor `tests/e2e/visual-planner-upgrade.spec.ts` legacy garden opens in visual planner without data loss
- [X] T042 [US6] Add toolbar zoom in/out test to `tests/e2e/visual-planner.spec.ts` (full suite, not `@smoke`) per US6 scenario 7
- [X] T043 [P] [US6] Expand `tests/e2e/accessibility-contrast.spec.ts` with planner primary control contrast check per FR-016

**Checkpoint**: Full suite P3 coverage complete

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: CI pipeline, journey map finalization, selector hardening, timing validation

- [X] T044 Create `.github/workflows/e2e.yml` with PR `@smoke` and main/nightly full suite per specs/005-e2e-test-coverage/contracts/ci-pipeline.md
- [X] T045 [P] Update `specs/005-e2e-test-coverage/contracts/journey-map.md` statuses to **covered** for all implemented specs per FR-015 and SC-005
- [X] T046 [P] Add `data-testid` attributes to `components/garden/GardenForm.tsx` and bed editor save controls only if role selectors fail in CI
- [X] T047 Run `npm run test:e2e:smoke` (P1/P2 `@smoke` specs only) and confirm completion under 8 minutes per SC-003
- [X] T048 Run `npm run test:e2e:full` and confirm zero permanent `test.skip` for missing fixtures per SC-004
- [X] T049 [P] Audit `specs/005-e2e-test-coverage/contracts/journey-map.md` against `@smoke` specs: confirm all P1 rows **covered** and ≥90% P2 rows **covered** or **partial** with rationale per SC-001 and SC-002
- [X] T050 Validate all steps in `specs/005-e2e-test-coverage/quickstart.md` on clean `garden_e2e` database per SC-007

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational / US7 (Phase 2)**: Depends on Phase 1 — **BLOCKS all journey specs**
- **US1 (Phase 3)**: Depends on Phase 2 — no other story dependencies
- **US2 (Phase 4)**: Depends on Phase 2 + `loginAs()` from T009
- **US3 (Phase 5)**: Depends on Phase 2 + garden fixture from T010; logically after US2
- **US4 (Phase 6)**: Depends on Phase 2 + catalog seed from T005; T030 also needs T011 climate export
- **US5 (Phase 7)**: Depends on US3 (bed fixture) and US4 (plant IDs)
- **US6 (Phase 8)**: Depends on US5 (garden with placements); full suite only
- **Polish (Phase 9)**: Depends on US1–US6 at minimum for CI

### User Story Dependency Graph

```text
Phase 2 (US7 harness)
    ├── US1 (auth) ──────────────────────────────┐
    ├── US2 (garden) ──► US3 (beds/paths) ──► US5 (planting) ──► US6 (planner UX)
    └── US4 (catalog + climate) ─────────────────┘
```

### Parallel Opportunities

- **Phase 1**: T002, T003 in parallel after T001
- **Phase 2**: T007, T009, T010, T011 in parallel after T004–T006, T008
- **After Phase 2**: US1 and US2 can start in parallel; US4 can parallel US2/US3
- **Phase 6**: T030 parallel with T027–T029 after T011 exports climate fixture
- **Phase 8**: T043 parallel with T036–T042
- **Phase 9**: T045, T046, T049 in parallel

### Parallel Example: After Foundational

```bash
# Developer A — auth (US1)
npx playwright test tests/e2e/auth.spec.ts

# Developer B — garden CRUD (US2)
npx playwright test tests/e2e/garden-crud.spec.ts

# Developer C — catalog (US4, after T005 seed verified)
npx playwright test tests/e2e/plant-catalog.spec.ts
```

---

## Implementation Strategy

### MVP First (US7 + US1 + US2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational harness (US7)
3. Complete Phase 3: US1 auth spec
4. Complete Phase 4: US2 garden CRUD
5. **STOP and VALIDATE**: `npm run test:e2e:smoke` with auth + garden specs tagged `@smoke`

### PR Smoke Gate (US1–US5)

1. MVP + Phase 5–7 (beds, catalog, planting)
2. Tag P1/P2 tests `@smoke` only (see Notes)
3. Wire `.github/workflows/e2e.yml` PR trigger
4. **VALIDATE**: SC-001, SC-002 (T049), SC-003 (T047) on CI

### Full Suite (US6 + Polish)

1. Complete Phase 8 visual planner specs
2. Complete Phase 9 CI nightly + journey map
3. **VALIDATE**: SC-004 (T048), SC-005 (T045)

---

## Notes

- `auth.spec.ts` MUST use UI flows only for register/login happy paths (FR-012)
- All other specs use `loginAs()` from `tests/e2e/fixtures/auth.ts`
- `@smoke` reserved for P1/P2 only: auth, garden-crud, layout-beds-paths, plant-catalog, planting-validation, indoor-starts
- P3 specs (planting-interaction, visual-planner, mobile-click-place, growing-area-types, visual-planner-upgrade) run in full suite only — no `@smoke`
- Never point `DATABASE_URL` at production; use `garden_e2e` only
- Constitution II behaviors verified via Tomato/Fennel incompatibility E2E (T033) and Apple orchard spacing (T040), not bypassed in fixtures
- Commit after each phase checkpoint
