---
description: "Task list for Catalog Data Pipeline feature implementation"
---

# Tasks: Catalog Data Pipeline

**Input**: Design documents from `/specs/007-data-pipeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED per constitution. Vitest unit tests (≥80% coverage CI gate);
TDD ordering flexible. Zod contract smokes in `apps/api-e2e` run with `npm test`
(no live DB). Integration is Playwright against Compose Postgres (`npm run e2e`):
UI E2E plus HTTP request tests in `pipeline-api.spec.ts`.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Nx monorepo**: `apps/api/`, `apps/api-e2e/`, `apps/web/`, `apps/web-e2e/`,
  `libs/catalog-pipeline/` (new), `libs/shared-types/`, `libs/plant-catalog-data/`,
  `libs/plant-catalog/`, `libs/plant-provider/`, `docs/adr/`, `scripts/ci/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the catalog-pipeline domain library on the existing 006 workspace

- [X] T001 Create Nx library `libs/catalog-pipeline` with `project.json` (test/lint targets matching `libs/care-reminders/project.json`, tags `type:lib`, `scope:pipeline`, `layer:domain`) and a stub `libs/catalog-pipeline/src/index.ts`
- [X] T002 [P] Add path alias `@open-garden/catalog-pipeline` in `tsconfig.base.json` and Vitest alias plus coverage include for `libs/catalog-pipeline/src/lib/**/*.ts` in `vitest.config.ts` (exclude pipeline DTO files in `libs/shared-types`). Allow `scope:pipeline` on `scope:web` and `scope:api` in `eslint.config.js`
- [X] T003 [P] Leave `libs/catalog-pipeline/src/index.ts` as the public barrel; add named exports (`domainError`, `mergeCatalogRecords`, `fetchAllFromProvider`, `CatalogPipelineService`) only when those files land in later tasks — do not implement domain logic in Setup

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, schema, repositories, fixture expansion, Nest placeholders — MUST complete before any user story

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T004 Implement pipeline DTOs (`PipelineRunStatus`, `PipelineTriggeredBy`, `PipelineSourceStatus`, `PipelineCadence`, `PipelineRunSourceDto`, `PipelineRunSummaryDto`, `PipelineMergeDecisionDto`, `PipelineRunDetailDto`, `PipelineRunListDto`, `PipelineSettingsDto`, `PipelineSettingsPatchDto`) in `libs/shared-types/src/lib/pipeline.ts` per `specs/007-data-pipeline/contracts/shared-types.ts.md`
- [X] T005 [P] Add Zod schemas (`pipelineCadenceSchema`, `pipelineSettingsPatchSchema`, `pipelineRunListQuerySchema`; `runAtHourUtc` 0–23; `sourceOrder` non-empty strings) in `libs/shared-types/src/lib/pipeline.schemas.ts`
- [X] T006 Re-export pipeline types and schemas from `libs/shared-types/src/index.ts` (do not change gardener `PlantSummaryDto` / favorites DTOs)
- [X] T007 Add Drizzle tables `catalogPipelineRuns`, `catalogPipelineRunSources`, `catalogPipelineMergeDecisions`, `catalogPlantSources`, `catalogPipelineSettings` in `libs/plant-catalog-data/src/lib/schema.ts` per `specs/007-data-pipeline/data-model.md` (partial unique one-running-run; do not drop historical `catalogSyncRuns`)
- [X] T008 Add Drizzle migration SQL `libs/plant-catalog-data/migrations/0007_catalog_pipeline.sql` (statuses, singleton settings id=1 default cadence `daily` / hour 6 / `source_order = {fixture}`; UNIQUE running; sync CLI already applies every `*.sql` in that directory)
- [X] T009 [P] Implement `PipelineRunRepository`, `PipelineSettingsRepository`, and `PlantSourceRepository` in `libs/plant-catalog-data/src/lib/pipeline-run-repository.ts`, `libs/plant-catalog-data/src/lib/pipeline-settings-repository.ts`, and `libs/plant-catalog-data/src/lib/plant-source-repository.ts`; export them from `libs/plant-catalog-data/src/index.ts`
- [X] T010 [P] Expand `FixturePlantProvider` to **≥50** valid unique garden varieties in `libs/plant-provider/src/lib/fixture-plant-provider.ts` while **keeping** existing named plants used by 001–006 (Cherry Tomato, Sweet Basil, French Marigold, Honeycrisp Apple, Interval Herb, Unknown Herb, and any calendar/planting fixtures). Update `libs/plant-provider/src/lib/fixture-plant-provider.spec.ts` accordingly
- [X] T011 [P] Add `FixtureBPlantProvider` (`id: 'fixture-b'`) in `libs/plant-provider/src/lib/fixture-b-plant-provider.ts` with 10 variety keys overlapping `fixture` (same species+cultivar, some conflicting non-null attributes) plus 10 unique varieties; export from `libs/plant-provider/src/index.ts`; add `libs/plant-provider/src/lib/fixture-b-plant-provider.spec.ts`
- [X] T012 [P] Confirm ADR `docs/adr/0009-catalog-data-pipeline.md` is present (full load, in-memory merge + one publish transaction, 409 lock, 202 in-process, no miss-fill)
- [X] T013 Implement pipeline error helpers (`Admin role required`, `A pipeline run is already running`, `Pipeline run not found`, `Invalid pipeline settings`) in `libs/catalog-pipeline/src/lib/domain-error.ts`; export `domainError` from `libs/catalog-pipeline/src/index.ts`
- [X] T014 Implement `AdminGuard` (`user.role === 'admin'`, 403 `Admin role required`) in `apps/api/src/admin/admin.guard.ts` and register placeholder pipeline controllers imported from a new `apps/api/src/admin/admin.module.ts` (`PipelineRunsController` `@Controller('admin/pipeline/runs')`, `PipelineSettingsController` `@Controller('admin/pipeline/settings')`, `SessionGuard` + `AdminGuard`, explicit `@Inject(...)`). Wire `AdminModule` from `apps/api/src/app.module.ts`
- [X] T015 Implement `createPipelineSources()` in `apps/api/src/plants/plants.controller.ts` (or a sibling `apps/api/src/admin/pipeline-sources.ts`): always `fixture` + `fixture-b`; append `perenual` only when `PERENUAL_API_KEY` is set. Do **not** use a single `PLANT_PROVIDER` as the run’s only source
- [X] T016 Persist `role` (and keep `id`) on login/register in `sessionStorage` in `apps/web/src/app/auth/auth-api.service.ts` so an admin guard can read `currentUser.role` after refresh; add `isAdmin()` helper

**Checkpoint**: Foundation ready — user stories can proceed

---

## Phase 3: User Story 1 - Populate the Catalog Without In-App API Sync (Priority: P1) 🎯 MVP

**Goal**: A full pipeline load of enabled sources (default `fixture`) persists the complete available catalog. Gardeners search/browse/detail from local plants only. Miss-fill is gone. `POST /api/admin/plants/sync` is removed. CLI `api:sync-plants` waits on `runAndWait()`. No gardener-facing sync control.

**Independent Test**: Run a pipeline (CLI or admin POST), then as a signed-in gardener find a named plant and open detail without any sync action and without a live provider call at lookup time. Empty name search stays empty.

### Tests for User Story 1 (REQUIRED)

- [X] T017 [P] [US1] Vitest unit tests for `fetchAllFromProvider`: pages until `nextCursor` is absent; does not stop at 500; empty page ends the source, in `libs/catalog-pipeline/src/lib/fetch-all.spec.ts`
- [X] T018 [P] [US1] Vitest unit tests that `CatalogService.list` never calls `searchByName` on empty or non-empty local results (replace the existing miss-fill case) in `libs/plant-catalog/src/lib/catalog-service.spec.ts`
- [X] T019 [P] [US1] Vitest unit tests for `CatalogPipelineService.runAndWait`: fixture-like provider with N plants persists all N; failed source with no successes leaves catalog unchanged; no secrets in `errorMessage`, in `libs/catalog-pipeline/src/lib/catalog-pipeline-service.spec.ts` (in-memory repos in `libs/catalog-pipeline/src/lib/test-memory.ts`)
- [X] T020 [P] [US1] Zod contract smokes (no live DB) for `pipelineSettingsPatchSchema` / run list query and documented **403** `Admin role required` (do **not** assert 409 here — lock is US3) in `apps/api-e2e/src/pipeline.spec.ts`
- [X] T021 [P] [US1] Playwright E2E: after seed pipeline, gardener opens catalog, finds Cherry Tomato, no sync/refresh-from-API control on plant list/detail; search for a nonsense name stays empty, in `apps/web-e2e/src/pipeline-catalog.spec.ts`
- [X] T022 [P] [US1] Playwright HTTP: gardener `POST /api/admin/pipeline/runs` 403 `Admin role required`; admin POST 202 `running` then GET plants still works; unauthenticated POST 401, in `apps/web-e2e/src/pipeline-api.spec.ts`

### Implementation for User Story 1

- [X] T023 [P] [US1] Implement `fetchAllFromProvider` (loop `listPage` until no `nextCursor`; no limit cap) in `libs/catalog-pipeline/src/lib/fetch-all.ts`; export from `libs/catalog-pipeline/src/index.ts`
- [X] T024 [US1] Implement `mergeCatalogRecords` for a single source (variety_key via existing `buildVarietyKey` from `@open-garden/plant-catalog`, skip invalid identity, never invent null attributes) in `libs/catalog-pipeline/src/lib/merge.ts`; export from `libs/catalog-pipeline/src/index.ts`
- [X] T025 [US1] Implement `CatalogPipelineService.start` (insert `running`, return immediately) and `runAndWait` (fetch → merge → **one transaction** upsert; MUST NOT import Nest, Perenual HTTP, or Drizzle schema/SQL) in `libs/catalog-pipeline/src/lib/catalog-pipeline-service.ts`; export from `libs/catalog-pipeline/src/index.ts`. Retire write path of `libs/plant-catalog/src/lib/catalog-sync-service.ts` (delete or thin-wrap to pipeline; update `libs/plant-catalog/src/lib/catalog-sync-service.spec.ts`)
- [X] T026 [US1] Remove miss-fill from `CatalogService.list` in `libs/plant-catalog/src/lib/catalog-service.ts`; drop the `PlantDataProvider` constructor dependency if unused
- [X] T027 [US1] Implement `POST /api/admin/pipeline/runs` (admin 202, in-process continue; no `limit` body) in `apps/api/src/admin/pipeline-runs.controller.ts`; **delete** `apps/api/src/plants/plants-sync.controller.ts` and remove it from `apps/api/src/plants/plants.module.ts`
- [X] T028 [US1] Change `apps/api/src/plants/sync-cli.ts` to `CatalogPipelineService.runAndWait()` with default settings `sourceOrder` (no `limit` 500). Keep `nx run api:sync-plants` as the seed command
- [X] T029 [US1] Stop constructing a provider in `GET /api/plants` in `apps/api/src/plants/plants.controller.ts` (`CatalogService` local-only)
- [X] T030 [US1] Confirm gardener plant list/detail templates in `apps/web/src/app/plants/plant-list.page.ts` and `apps/web/src/app/plants/plant-detail.page.ts` have no sync-from-API control (FR-002 / FR-012)

**Checkpoint**: US1 MVP — full fixture load, local catalog, miss-fill gone, old sync endpoint gone

---

## Phase 4: User Story 2 - Combine Multiple Sources into One Catalog (Priority: P2)

**Goal**: A run ingests every id in `sourceOrder`. Same garden variety merges to one plant (last in order wins non-null fields; earlier fills blanks). Merge decisions recorded. Deprecated plants reactivate in place when they return. Two fixture sources suffice for verification.

**Independent Test**: Set `sourceOrder` to `["fixture", "fixture-b"]`, run the pipeline, get exactly one row per overlapping variety plus uniques from each source; field winners match last-in-order.

### Tests for User Story 2 (REQUIRED)

- [X] T031 [P] [US2] Vitest unit tests for `mergeCatalogRecords` on a **controlled pair** (10 overlap + 10 unique each → exactly 30 keys); last source wins conflicting non-null; blanks fill from earlier; invalid records skipped; `fieldWinners` populated; **SC-003**: ≥95% of valid records have required gardener-facing attributes populated or explicitly null (never invented), in `libs/catalog-pipeline/src/lib/merge.spec.ts`
- [X] T032 [US2] Vitest unit tests for deprecation (only when **all** previously contributing sources succeeded and omitted the key) and reactivation (same row `active`, attributes refreshed, no second plant) in `libs/catalog-pipeline/src/lib/catalog-pipeline-service.spec.ts` (same file as T019 — do not run in parallel with T019)
- [X] T033 [P] [US2] Playwright E2E: admin PATCH `sourceOrder` to `["fixture", "fixture-b"]`, start run, poll `GET /api/plants` until a documented **fixture-b unique** plant appears (do not poll run detail — that is US3); assert the **10 overlap variety keys appear once** and the **10 B-uniques appear**; do **not** expect the whole catalog to contain only 30 rows (full fixture is ≥50). Reset `sourceOrder` to `["fixture"]` afterward so 003–006 named plants stay stable, in `apps/web-e2e/src/pipeline-merge.spec.ts`

### Implementation for User Story 2

- [X] T035 [US2] Extend `mergeCatalogRecords` in `libs/catalog-pipeline/src/lib/merge.ts` for multiple sources in order (last non-null wins; fill blanks; contributing source lists)
- [X] T036 [US2] Implement `GET`/`PATCH /api/admin/pipeline/settings` in `apps/api/src/admin/pipeline-settings.controller.ts` (admin only; `registeredSources` from `createPipelineSources()`; never return API keys)
- [X] T037 [US2] Drive `CatalogPipelineService` from settings `sourceOrder` in `libs/catalog-pipeline/src/lib/catalog-pipeline-service.ts`: fetch each source independently; persist `catalog_pipeline_run_sources` and `catalog_pipeline_merge_decisions`; upsert `catalog_plant_sources`
- [X] T038 [US2] Implement deprecation and reactivation rules in `libs/catalog-pipeline/src/lib/catalog-pipeline-service.ts` per `specs/007-data-pipeline/data-model.md` (empty successful source does not wipe catalog; failed source does not deprecate plants it previously supplied)

**Checkpoint**: US1 + US2 — full load plus multi-source merge and lifecycle

---

## Phase 5: User Story 3 - Operators Monitor Runs and Recover from Failures (Priority: P3)

**Goal**: Admins start/inspect runs and set daily cadence from `/admin/pipeline`. Second start is 409. One failed source + one success → `incomplete` but successful data published. Crash/stale `running` marked failed on boot. Gardeners cannot open admin pipeline.

**Independent Test**: Admin starts a run and sees status; gardener cannot; second start while running is already-running; a later successful re-run updates the catalog without a wipe.

### Tests for User Story 3 (REQUIRED)

- [X] T039 [P] [US3] Vitest unit tests for single-running lock (second `start` throws `A pipeline run is already running`) and stale `running` sweep in `libs/catalog-pipeline/src/lib/catalog-pipeline-service.spec.ts` (same file as T019/T032 — do not run in parallel with those)
- [X] T040 [P] [US3] Vitest unit tests for `tryStartScheduled`: daily + matching hour starts; already running is no-op; `disabled` does not start, in `libs/catalog-pipeline/src/lib/schedule.spec.ts`
- [X] T041 [US3] Vitest unit tests: one source throws, another succeeds → run `incomplete`, successful plants published, failed source `errorMessage` has no secrets, in `libs/catalog-pipeline/src/lib/catalog-pipeline-service.spec.ts` (same file as T039 — do not run in parallel with T039)
- [X] T042 [P] [US3] Playwright E2E: admin opens `/admin/pipeline`, starts a run, sees running then terminal with per-source counts; gardener visiting `/admin/pipeline` is redirected/forbidden and has no Pipeline nav link; set cadence daily and hour round-trips, in `apps/web-e2e/src/pipeline-admin.spec.ts`
- [X] T043 [US3] Playwright HTTP: second POST 409 `A pipeline run is already running` (force overlapping start); GET list newest-first; GET unknown id 404 `Pipeline run not found`; gardener GET settings 403, in `apps/web-e2e/src/pipeline-api.spec.ts` (same file as T022 — do not run in parallel with T022)
- [X] T034 [US3] Playwright HTTP: GET run detail includes `sources` and `merges` with `fieldWinners`; empty `sourceOrder` PATCH 400 `Invalid pipeline settings`, in `apps/web-e2e/src/pipeline-api.spec.ts` (same file as T022/T043 — do not run in parallel; requires T044 GET by id)

### Implementation for User Story 3

- [X] T044 [US3] Implement `GET /api/admin/pipeline/runs` and `GET /api/admin/pipeline/runs/:id` in `apps/api/src/admin/pipeline-runs.controller.ts` (paged list; detail includes sources + merges)
- [X] T045 [US3] Implement lock insert (partial unique `running`) and boot stale-run sweeper (`running` → `failed` with a safe message) in `libs/catalog-pipeline/src/lib/catalog-pipeline-service.ts`; map conflict to 409 in `apps/api/src/admin/pipeline-runs.controller.ts`
- [X] T046 [US3] Implement `tryStartScheduled` in `libs/catalog-pipeline/src/lib/schedule.ts` and a Nest `onModuleInit` 60s interval (no `@nestjs/schedule` package) in `apps/api/src/admin/pipeline-scheduler.service.ts` that calls it; triggeredBy `schedule`
- [X] T047 [US3] Set overall run status `succeeded` | `incomplete` | `failed` from per-source outcomes in `libs/catalog-pipeline/src/lib/catalog-pipeline-service.ts` (partial success still publishes successful sources)
- [X] T048 [P] [US3] Implement Angular pipeline API client (relative `/api`, `withCredentials`) in `apps/web/src/app/admin/pipeline-api.service.ts`
- [X] T049 [US3] Implement standalone `PipelinePage` (start run, poll status, list runs, edit cadence / hour / sourceOrder; native controls, no `[ngValue]`) in `apps/web/src/app/admin/pipeline.page.ts`; `adminGuard` in `apps/web/src/app/admin/admin.guard.ts`; auth-guarded `/admin/pipeline` in `apps/web/src/app/app.routes.ts`; Pipeline nav link only when `isAdmin()` in `apps/web/src/app/app.component.ts`

**Checkpoint**: All three user stories independently demonstrable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Coverage, YAGNI, quickstart, README, isolation hardening, CI parity

- [X] T050 [P] Replace README operator sync (`POST /api/admin/plants/sync` / limit 500) with pipeline steps from `specs/007-data-pipeline/quickstart.md` in `README.md`
- [X] T051 [P] Confirm gardener catalog, favorites, gardens, calendar, plantings, layout, and reminders authorization/payloads still do not call plant providers in `apps/api/src/plants/plants.controller.ts`, `apps/api/src/favorites/favorites.controller.ts`, and garden controllers
- [X] T052 Confirm Vitest coverage ≥80% for `libs/catalog-pipeline` (and that `vitest.config.ts` coverage include lists it)
- [X] T053 YAGNI pass: no weather/imagery ingest, no job queue/Redis, no `@nestjs/schedule`, no gardener last-updated badge, no second live vendor required, no miss-fill leftover, no `limit` on pipeline start in `apps/api` or `libs/catalog-pipeline`
- [X] T054 Run `specs/007-data-pipeline/quickstart.md` validation (P1 populate, P2 merge, P3 monitor). Manually confirm gardener catalog first page <2s on the local network after load — **not** a CI/Playwright timing gate. SC-001 (find a plant in under 1 minute) and SC-008 (operator walkthrough) are **manual**, not CI gates
- [X] T055 Security pass: non-admin pipeline 403, unauthenticated 401, no API keys in run errors or settings JSON, gardener screens have no pipeline diagnostics — `apps/api/src/admin/pipeline-runs.controller.ts`, `apps/api/src/admin/pipeline-settings.controller.ts`, `apps/web/src/app/admin/pipeline.page.ts`
- [X] T056 Confirm `libs/catalog-pipeline` does not import Nest, Perenual HTTP, or Drizzle schema/SQL. `CatalogPipelineService` MAY import catalog-data repository **classes** (constructor injection). Angular admin page may import only shared-types — not repositories or provider adapters
- [X] T058 Confirm existing 003–006 Playwright specs still pass after fixture expansion (named plants remain) via `npm run e2e`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (workspace already exists from 001–006)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational; extends US1 publish with multi-source merge
- **US3 (Phase 5)**: Depends on Foundational + US1 start/run; inspect/schedule overlay
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on US2/US3; CLI + POST start + local catalog so the story is independently testable. **Merge of two sources is not satisfied until US2.** **Admin inspect UI is not satisfied until US3.**
- **US2 (P2)**: After Foundational; practically extends US1 `CatalogPipelineService`. T032 is **not** parallel with T019 (same service spec). T033 polls `GET /api/plants`, not run detail.
- **US3 (P3)**: After Foundational; needs US1 POST start. T039/T041 are **not** parallel with T019/T032 (same service spec). T043 and T034 are **not** parallel with T022 (same HTTP spec). T034 requires T044 GET by id.

### Within Each User Story

- Tests required; ordering vs implementation flexible
- Shared contracts / library public interface before app wiring
- Library/service before REST endpoints before Angular UI
- Authorization and migrations with the story that needs them (schema is Foundational)
- Unit coverage complete; integration + Playwright when UI + API are ready

### Parallel Opportunities

- Phase 1: T002–T003 after T001
- Phase 2: T004–T005 parallel; T009–T011 after T007; T012 parallel with schema; T014 after T013
- US1: T017–T022 tests parallel; T023 parallel with merge; T027 after T025
- US2: T031 and T033 parallel; T032 after T019
- US3: T040 and T042 parallel; T048 parallel with controller GET; T039 after T032; T034 after T044
- Polish: T050–T051, T053, T056 parallel

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Vitest fetch-all.spec.ts"
Task: "Vitest catalog-service.spec.ts (no miss-fill)"
Task: "Vitest catalog-pipeline-service.spec.ts (runAndWait)"
Task: "Zod pipeline.spec.ts"
Task: "Playwright pipeline-catalog.spec.ts"
Task: "Playwright pipeline-api.spec.ts (403/202)"

# Domain then API then CLI:
Task: "fetch-all.ts + merge.ts (single source)"
Task: "catalog-pipeline-service.ts start/runAndWait"
Task: "Remove miss-fill; delete plants-sync.controller"
Task: "sync-cli runAndWait"
```

---

## Parallel Example: User Story 2

```bash
Task: "merge.spec.ts multi-source (parallel)"
Task: "merge.ts last-wins + fill blanks"
Task: "GET/PATCH settings"
Task: "Playwright pipeline-merge.spec.ts"
```

---

## Parallel Example: User Story 3

```bash
Task: "schedule.spec.ts (parallel)"
Task: "pipeline-admin.spec.ts (parallel)"
Task: "GET runs list/detail + 409 lock"
Task: "PipelinePage + adminGuard"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`libs/catalog-pipeline`)
2. Complete Phase 2: Foundational (CRITICAL) including migration 0007, ≥50 fixtures, fixture-b adapter
3. Complete Phase 3: US1 (full load, miss-fill gone, local catalog, tests)
4. **STOP and VALIDATE** via quickstart P1 checks
5. Demo gardener catalog from pipeline data before multi-source merge and admin UI

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP populated catalog without in-app API sync
3. US2 → multi-source merge, deprecation/reactivation
4. US3 → admin inspect, 409 lock, schedule, incomplete runs
5. Polish → coverage, YAGNI, README, `npm test` / `npm run e2e`

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then: Developer A finishes US1 CLI/API/catalog; B starts US2 merge; C starts US3 admin UI (after POST 202 shape exists)

---

## Notes

- [P] = different files, no incomplete dependencies
- [USn] maps to spec user stories for traceability
- Commit after each task or logical group
- Stop at checkpoints to validate independently
- Avoid: new NgModules, GraphQL/tRPC, duplicated DTOs outside `libs/shared-types`, a second data lib, direct Perenual calls, implicit Nest constructor injection under tsx, `@nestjs/schedule`, Redis/Bull, miss-fill leftover, `limit` on pipeline start, gardener last-updated badge
- Native admin form controls are T049 only (no separate native-controls polish task)
- Reuse `users.role === 'admin'`; garden membership is irrelevant to pipeline
- `api:sync-plants` remains the blocking seed; HTTP start is 202 + in-process
- After US2 merge e2e, reset `sourceOrder` to `["fixture"]` so 003–006 stay green
- Angular admin page MUST NOT import `@open-garden/catalog-pipeline` service/repos
