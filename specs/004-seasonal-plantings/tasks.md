---
description: "Task list for Seasonal Plantings feature implementation"
---

# Tasks: Seasonal Plantings

**Input**: Design documents from `/specs/004-seasonal-plantings/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED per constitution. Vitest unit tests (≥80% coverage CI gate);
TDD ordering flexible. Zod contract smokes in `apps/api-e2e` run with `npm test`
(no live DB). Integration is Playwright against Compose Postgres (`npm run e2e`):
UI E2E plus HTTP request tests in `garden-plantings-api.spec.ts`.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Nx monorepo**: `apps/api/`, `apps/api-e2e/`, `apps/web/`, `apps/web-e2e/`,
  `libs/seasonal-plantings/` (new), `libs/shared-types/`,
  `libs/plant-catalog-data/`, `libs/gardens/` (unchanged domain),
  `libs/planting-calendar/` (unchanged — no auto-convert), `docs/adr/`,
  `scripts/ci/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the seasonal-plantings domain library on the existing 003 workspace

- [X] T001 Create Nx library `libs/seasonal-plantings` with `project.json` (test/lint targets matching `libs/planting-calendar/project.json`, tags `type:lib`, `scope:plantings`, `layer:domain`) and a stub `libs/seasonal-plantings/src/index.ts`
- [X] T002 [P] Add `@open-garden/seasonal-plantings` path in `tsconfig.base.json` and Vitest alias plus coverage include for `libs/seasonal-plantings/src/lib/**/*.ts` in `vitest.config.ts` (exclude `libs/shared-types/src/lib/planting.ts` like `calendar.ts`)
- [X] T003 [P] Leave `libs/seasonal-plantings/src/index.ts` as the public barrel; add named exports (`domainError`, `assertDatePair`, `groupPlantings`, `normalizeBedName`, `PlantingService`) only when those files land in later tasks — do not implement domain logic in Setup

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, schema, repositories, Nest placeholders — MUST complete before any user story

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T004 Implement planting DTOs (`IsoDate`, `NamedBedDto`, `PlantingDto`, `PlantingListDto`, `PlantingCreateDto`, `PlantingPatchDto`, `BedCreateDto`, `BedPatchDto`) in `libs/shared-types/src/lib/planting.ts` per `specs/004-seasonal-plantings/contracts/shared-types.ts.md`
- [X] T005 [P] Add Zod schemas for planting create/patch, bed create/patch, and list query (`page` default 1, `pageSize` default 200 max 500; ISO `YYYY-MM-DD` dates) in `libs/shared-types/src/lib/planting.schemas.ts`
- [X] T006 Re-export planting types and schemas from `libs/shared-types/src/index.ts` (do not add fields to `CalendarDto` or favorite DTOs)
- [X] T007 Add `garden_beds` (UNIQUE `(garden_id, name_normalized)`, FK garden CASCADE) and `garden_plantings` (FK garden CASCADE, FK plant RESTRICT, FK bed SET NULL, optional `planted_on`/`harvested_on` date columns, optional `client_mutation_id`; **no** UNIQUE `(garden_id, plant_id)`) in `libs/plant-catalog-data/src/lib/schema.ts` per `specs/004-seasonal-plantings/data-model.md`
- [X] T008 Add Drizzle migration SQL `libs/plant-catalog-data/migrations/0004_seasonal_plantings.sql` (sync CLI already applies every `*.sql` in that directory)
- [X] T009 [P] Implement `BedRepository` (listByGarden ordered by name, insert with optional client id, getById, rename, delete) in `libs/plant-catalog-data/src/lib/bed-repository.ts`
- [X] T010 [P] Implement `PlantingRepository` (listByGarden paged `created_at DESC` join plants, insert with optional client id, getById in garden, update dates/bed, delete returning whether a row existed) in `libs/plant-catalog-data/src/lib/planting-repository.ts`
- [X] T011 Export `BedRepository` and `PlantingRepository` from `libs/plant-catalog-data/src/index.ts`
- [X] T012 [P] Confirm ADR `docs/adr/0006-seasonal-plantings.md` is present (plantings ≠ calendar; queue must not resurrect; confirmed hard delete)
- [X] T013 Implement planting error helpers (`Plant is required`, `Plant not found`, `Planting not found`, `Bed not found`, `Bed name is required`, `Bed name must be at most 120 characters`, `That garden already has a bed with that name`, `Harvest date must be on or after planted date`, `Date must be YYYY-MM-DD`, `That id is already in use`, `Viewers cannot update plantings`, `Viewers cannot update beds`, reuse `Garden not found`) in `libs/seasonal-plantings/src/lib/domain-error.ts`; export `domainError` from `libs/seasonal-plantings/src/index.ts`
- [X] T014 Register a Nest plantings controller placeholder and import it from existing `GardensModule` in `apps/api/src/gardens/gardens.module.ts` / `apps/api/src/gardens/garden-plantings.controller.ts` (`@Controller('gardens/:id/plantings')`, reuse `SessionGuard` + `GardenMembershipGuard`, `@Inject(DATABASE)`)
- [X] T015 [P] Register a Nest beds controller placeholder in `apps/api/src/gardens/garden-beds.controller.ts` (`@Controller('gardens/:id/beds')`, same guards/`@Inject(DATABASE)`) and add it to `apps/api/src/gardens/gardens.module.ts`

**Checkpoint**: Foundation ready — user stories can proceed

---

## Phase 3: User Story 1 - Record a Planting in a Garden (Priority: P1) 🎯 MVP

**Goal**: Owners/collaborators add a catalog variety (or a personal favorite) as a planting on a garden list, set or clear planted/harvest dates (past/today/future; unset stays unset), confirm-remove permanently, and see unavailable varieties still listed. Viewers read only. Non-members get garden not-found. Same variety may appear as multiple rows. US1 MAY show a flat newest-recorded-first list so this story is independently testable; **FR-015 grouped-by-bed default is complete only after US2**.

**Independent Test**: As owner, add a planting for a catalog plant in a garden, see it on that garden’s list with variety identity, set or clear planted and harvest dates, confirm-remove it (and verify cancel leaves it); a viewer can read but not mutate; a non-member cannot find the list.

### Tests for User Story 1 (REQUIRED)

- [X] T016 [P] [US1] Vitest unit tests for ISO date parse, future allowed, null stays unset (not today), harvest ≥ planted when both set, harvest without planted allowed in `libs/seasonal-plantings/src/lib/dates.spec.ts`
- [X] T017 [P] [US1] Vitest unit tests for add (duplicate variety = two rows), client-id idempotent POST in same garden vs CONFLICT other garden, list newest-recorded-first (`createdAt` DESC, not planted date), PATCH dates last-write-wins, harvest-before-planted rejected with prior values, DELETE missing throws `Planting not found` (not idempotent success), viewer refused, unknown plant, deprecated plant still listed with `status`, non-member `Garden not found` in `libs/seasonal-plantings/src/lib/planting-service.spec.ts` (in-memory repos in `libs/seasonal-plantings/src/lib/test-memory.ts`)
- [X] T018 [P] [US1] Zod contract smokes (no live DB) for create/patch/list schemas and documented 404/403 messages in `apps/api-e2e/src/plantings.spec.ts`
- [X] T019 [P] [US1] Playwright E2E: add tomato from catalog, unset planted date not today, past and future dates save, harvest-before-planted rejected, add tomato again = two rows, add basil from favorites without exposing favorites to another member, cancel remove leaves the row, confirm remove gone with catalog/favorites/calendar unchanged, viewer read-only in `apps/web-e2e/src/plantings-record.spec.ts`
- [X] T020 [P] [US1] Playwright HTTP: 401, non-member GET 404, viewer POST/PATCH/DELETE 403 `Viewers cannot update plantings`, POST 201 then same `id` 200 (one row), second POST different id same plantId 201 (two rows), PATCH missing planting 404 does not create, DELETE existing 204 then DELETE again 404 in `apps/web-e2e/src/garden-plantings-api.spec.ts`

### Implementation for User Story 1

- [X] T021 [P] [US1] Implement `assertDatePair` / ISO `YYYY-MM-DD` helpers in `libs/seasonal-plantings/src/lib/dates.ts`; export `assertDatePair` from `libs/seasonal-plantings/src/index.ts`
- [X] T022 [US1] Implement `PlantingService.list` / `create` / `update` / `remove` (inject `PlantingRepository` + `BedRepository` + plant/garden membership repos as constructor deps; pageSize default 200 max 500; GET includes `beds` even if empty; list sort `createdAt` DESC; create allows client UUID; remove is hard delete throwing `Planting not found` when absent) in `libs/seasonal-plantings/src/lib/planting-service.ts`; export it from `libs/seasonal-plantings/src/index.ts`
- [X] T023 [US1] Expose `GET/POST /api/gardens/:id/plantings` and `PATCH/DELETE /api/gardens/:id/plantings/:plantingId` (owner/collaborator mutate; viewer 403; non-member 404; POST returns `PlantingListDto`; PATCH returns `PlantingDto`; DELETE 204 or 404) mapping contracts in `apps/api/src/gardens/garden-plantings.controller.ts`
- [X] T024 [P] [US1] Implement Angular plantings API client (relative `/api`, `withCredentials`) GET/POST/PATCH/DELETE in `apps/web/src/app/gardens/plantings-api.service.ts`; list GET uses `pageSize=200` and, if `total` exceeds the first page, fetches remaining pages and concatenates before the page renders groups
- [X] T025 [US1] Implement standalone plantings page: empty-list CTA, variety identity, unset dates displayed as not set, native `<input type="date">`, harvest-before-planted error message, deprecated/`status !== 'active'` unavailable-variety indicator (row remains), in-page Cancel/Confirm remove (same pattern as garden delete in `garden-detail.page.ts`; cancel does not call DELETE), viewer hides mutate, in `apps/web/src/app/gardens/garden-plantings.page.ts`
- [X] T026 [US1] Add auth-guarded `/gardens/:id/plantings` in `apps/web/src/app/app.routes.ts` and a Plantings link from `apps/web/src/app/gardens/garden-detail.page.ts` (alongside Calendar; do not imply they are the same list)
- [X] T027 [US1] Add paged catalog search picker via existing `GET /api/plants` (not an unbounded dump) on `apps/web/src/app/gardens/garden-plantings.page.ts`
- [X] T028 [US1] Add favorites-as-picker (existing `GET /api/favorites`, session-private) on `apps/web/src/app/gardens/garden-plantings.page.ts` without listing another member’s favorites

**Checkpoint**: US1 MVP — per-garden planting list, dates, confirm delete, isolation, duplicate variety rows

---

## Phase 4: User Story 2 - Optional Named Beds as Lists (Priority: P2)

**Goal**: Owners/collaborators create/rename/delete named beds (labels only). Completes FR-015: default planting list is grouped by bed; empty named beds appear as empty groups; Unassigned appears only when at least one planting has no bed; optional filter to one bed does not mutate; newest recorded planting (`createdAt`) in a group is first; deleting a bed unassigns plantings (does not delete them). Viewers see names but cannot manage beds.

**Independent Test**: Owner creates a named bed, assigns two plantings to it, sees the default grouped list, filters to that bed, moves a planting to another bed or to no bed, deletes the bed and confirms plantings remain unassigned; viewer cannot create beds.

### Tests for User Story 2 (REQUIRED)

- [X] T029 [P] [US2] Vitest unit tests for empty beds as empty groups, Unassigned omitted when all assigned and when zero plantings, Unassigned present when any `bedId` is null, newest-recorded-first within group (`createdAt` DESC, not planted date), bed-name sort, filter is view-only in `libs/seasonal-plantings/src/lib/group-plantings.spec.ts`
- [X] T030 [US2] Vitest unit tests for trim/case-insensitive unique bed names, blank rejected, 120-char max, delete bed SET NULL on plantings, assign/unassign, viewer bed mutate refused in `libs/seasonal-plantings/src/lib/planting-service.spec.ts` (same file as T017 — do not run in parallel with T017)
- [X] T031 [P] [US2] Zod contract smokes for bed create/patch and duplicate-name CONFLICT message in `apps/api-e2e/src/plantings-beds.spec.ts`
- [X] T032 [P] [US2] Playwright E2E: create empty bed visible as empty group (Unassigned hidden), assign + unassigned mix shows both, all assigned hides Unassigned, empty second bed still visible, filter to one bed and clear, filter-no-match empty state, rename keeps assignment, delete bed keeps plantings unassigned, viewer cannot manage beds in `apps/web-e2e/src/plantings-beds.spec.ts`
- [X] T033 [P] [US2] Playwright HTTP: POST bed 201, duplicate name 409, POST planting with other-garden `bedId` 404, DELETE bed 204 then plantings `bedId` null, viewer bed POST 403 `Viewers cannot update beds` in `apps/web-e2e/src/garden-plantings-api.spec.ts`

### Implementation for User Story 2

- [X] T034 [P] [US2] Implement `normalizeBedName` and `groupPlantings(plantings, beds)` (empty beds included; Unassigned only when needed; name sort; newest-recorded-first by `createdAt`) in `libs/seasonal-plantings/src/lib/beds.ts` and `libs/seasonal-plantings/src/lib/group-plantings.ts`; export from `libs/seasonal-plantings/src/index.ts`
- [X] T035 [US2] Implement `PlantingService.createBed` / `renameBed` / `deleteBed` (SET NULL plantings) and validate `bedId` belongs to the garden on planting create/update in `libs/seasonal-plantings/src/lib/planting-service.ts`
- [X] T036 [US2] Expose `POST /api/gardens/:id/beds` and `PATCH/DELETE /api/gardens/:id/beds/:bedId` in `apps/api/src/gardens/garden-beds.controller.ts` (viewer 403; non-member 404; POST 201/200 idempotent client id)
- [X] T037 [US2] Add bed create/rename/delete (and planting `bedId` patch) to `apps/web/src/app/gardens/plantings-api.service.ts`
- [X] T038 [US2] Render default grouped list via `groupPlantings` on the **full concatenated list** from T024 on `apps/web/src/app/gardens/garden-plantings.page.ts`: empty bed groups, Unassigned only when needed, client-side single-bed filter that does not DELETE, filter-empty state + show-all control, native select for bed assignment, viewer hides bed manage

**Checkpoint**: US1 + US2 — grouped planting list with named beds as labels

---

## Phase 5: User Story 3 - Offline Planting Changes Queue and Sync (Priority: P3)

**Goal**: Last-loaded planting list remains readable offline. Owner/collaborator add/update/remove plantings and beds apply on-device immediately as pending and sync on reconnect. Last intent per existing entity coalesces. Pending update/remove of a remotely deleted planting fails visibly and does not recreate it; pending adds still sync. Viewers read cache only. Removed members cannot keep acting from stale cache.

**Independent Test**: Load the list online, go offline, add a planting, see it on the list as pending, reconnect, confirm it appears for another member after sync; a viewer offline can read but cannot queue mutations.

### Tests for User Story 3 (REQUIRED)

- [X] T039 [P] [US3] Playwright E2E: after plantings GET online, abort `**/api/gardens/**/plantings**` and `**/api/gardens/**/beds**` (not `setOffline` + reload), cached list readable; add planting (and create bed) while unreachable appears pending; restore routes and drain — other member sees the planting after sync — in `apps/web-e2e/src/plantings-offline.spec.ts`
- [X] T040 [P] [US3] Playwright E2E: two-browser no-resurrect — B deletes a planting A has a pending PATCH for; when A drains, visible failure, planting not recreated; a pending add of a **new** planting still syncs — in `apps/web-e2e/src/plantings-offline.spec.ts`
- [X] T041 [P] [US3] Playwright E2E: viewer offline reads cache and cannot queue; collaborator caches list, owner removes them while planting APIs aborted, restore and refresh — not found, cache/queue dropped, mutate not offered — in `apps/web-e2e/src/plantings-offline.spec.ts`

### Implementation for User Story 3

- [X] T042 [P] [US3] Implement IndexedDB read-through cache keyed by user + garden id (garden/plantings 404 deletes that cache) in `apps/web/src/app/gardens/garden-plantings-cache.service.ts`
- [X] T043 [US3] Implement IndexedDB mutation queue (one record per `planting:<id>` or `bed:<id>`; last intent overwrites; unsynced create+delete of same client id drops net-zero; client UUID on create) in `apps/web/src/app/gardens/plantings-offline.queue.ts`
- [X] T044 [US3] Wire cache + queue through `apps/web/src/app/gardens/plantings-api.service.ts` and `apps/web/src/app/gardens/garden-plantings.page.ts`: optimistic list; unsynced items show **pending**; failed drain shows **needs-attention** with the error (not success); drain on online; planting remove still requires in-page confirm before enqueue; do not queue calendar or membership APIs
- [X] T045 [US3] On drain: PATCH/DELETE `Planting not found` fails visibly and MUST NOT POST a replacement; garden 404 drops that garden’s cache and queue; viewer never enqueues — in `apps/web/src/app/gardens/plantings-api.service.ts` and `apps/web/src/app/gardens/garden-plantings.page.ts`

**Checkpoint**: All three user stories independently demonstrable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Coverage, YAGNI, quickstart, isolation hardening, CI parity

- [X] T046 [P] Confirm plant catalog, favorites, and calendar authorization/payloads are unchanged (no garden-scoped favorites; recording a planting does not write `garden_calendar_entries`) in `apps/api/src/plants/plants.controller.ts`, `apps/api/src/favorites/favorites.controller.ts`, and `apps/api/src/gardens/garden-calendar.controller.ts`
- [X] T047 [P] Point operators at seasonal-plantings verify steps from `specs/004-seasonal-plantings/quickstart.md` in `README.md`
- [X] T048 Confirm Vitest coverage ≥80% for `libs/seasonal-plantings` (and that `vitest.config.ts` coverage include lists it)
- [X] T049 YAGNI pass: no bed geometry/layout canvas, planting-calendar window math on the plantings page, care reminders, quantity/count field, archive/undelete, or auto-convert from calendar in `apps/web` or `apps/api`
- [X] T050 Run `specs/004-seasonal-plantings/quickstart.md` validation (record/dates/confirm-delete, beds/groups/filter, offline queue, no-resurrect). Manually confirm first plantings view <2s on the local network after the garden is open — **not** a CI/Playwright timing gate
- [X] T051 Security pass: GET non-member stays 404, viewer mutate 403, client-supplied ids cannot attach to another garden (CONFLICT/404), no secrets, errors use `ApiErrorDto` in `apps/api/src/gardens/garden-plantings.controller.ts` and `apps/api/src/gardens/garden-beds.controller.ts`
- [X] T052 Native controls only (no `[ngValue]`) on plantings add/dates/bed select/filter in `apps/web/src/app/gardens/garden-plantings.page.ts`
- [X] T053 Confirm `libs/seasonal-plantings` does not import Nest, Perenual HTTP, or Drizzle schema/SQL. `PlantingService` MAY import `PlantingRepository` / `BedRepository` / `PlantRepository` (constructor injection, same as `libs/gardens`). Angular plantings page may import only `assertDatePair`, `groupPlantings`, `normalizeBedName`, and shared-types — not repositories
- [X] T054 Confirm last-write-wins: two sequential PATCHes of dates/bed, later save is stored; following GET shows it — covered in `apps/web-e2e/src/garden-plantings-api.spec.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (workspace already exists from 001–003)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational; extends US1 list with beds/grouping
- **US3 (Phase 5)**: Depends on Foundational + a loaded planting list from US1 (queue also covers US2 bed mutations)
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on US2/US3; includes GET + create/update/confirm-delete so the story is independently testable (flat list is enough). **FR-015 is not satisfied until US2.**
- **US2 (P2)**: After Foundational; practically extends US1 plantings page (groups, filter, bed CRUD). Completes FR-015. T030 is **not** parallel with T017 (same spec file).
- **US3 (P3)**: After Foundational; needs US1 GET payload to cache; mutations reuse US1/US2 API client

### Within Each User Story

- Tests required; ordering vs implementation flexible
- Shared contracts / library public interface before app wiring
- Library/service before REST endpoints before Angular UI
- Authorization and migrations with the story that needs them (schema is Foundational)
- Unit coverage complete; integration + Playwright when UI + API are ready

### Parallel Opportunities

- Phase 1: T002–T003 after T001
- Phase 2: T004–T005 parallel; T009–T010 after T007; T012 parallel with schema; T014–T015 after T013
- US1: T016–T020 tests parallel; T021 parallel with service; T024 parallel with controller
- US2: T029, T031–T033 tests parallel; T030 after T017 (same `planting-service.spec.ts`); T034 parallel with tests; T037–T038 after beds API
- US3: T039–T041 tests parallel with T042 cache service
- Polish: T046–T047, T049, T052–T053 parallel

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Vitest dates.spec.ts"
Task: "Vitest planting-service.spec.ts"
Task: "Zod plantings.spec.ts"
Task: "Playwright plantings-record.spec.ts"
Task: "Playwright garden-plantings-api.spec.ts"

# Domain then API then UI:
Task: "dates.ts"
Task: "planting-service.ts"
Task: "garden-plantings.controller.ts"
Task: "garden-plantings.page.ts"
```

---

## Parallel Example: User Story 2

```bash
Task: "group-plantings.spec.ts"
Task: "beds.ts + group-plantings.ts"
Task: "garden-beds.controller.ts"
Task: "Playwright plantings-beds.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`libs/seasonal-plantings`)
2. Complete Phase 2: Foundational (CRITICAL) including migration 0004 and both tables
3. Complete Phase 3: US1 (list, dates, confirm delete, catalog/favorites pickers, tests)
4. **STOP and VALIDATE** via quickstart P1 checks
5. Demo a garden planting list before named-bed groups and offline queue

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP planting records + dates + confirm delete
3. US2 → named beds, grouped list, filter
4. US3 → offline cache + mutation queue (no resurrect)
5. Polish → coverage, YAGNI, quickstart, `npm test` / `npm run e2e`

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then: Developer A finishes US1 UI; B starts US2 beds/grouping; C starts US3 cache/queue (after GET shape exists)

---

## Notes

- [P] = different files, no incomplete dependencies
- [USn] maps to spec user stories for traceability
- Commit after each task or logical group
- Stop at checkpoints to validate independently
- Avoid: new NgModules, GraphQL/tRPC, duplicated DTOs outside `libs/shared-types`, a second data lib, direct Perenual calls, implicit Nest constructor injection under tsx, resurrecting plantings on PATCH/DELETE 404, idempotent 204 DELETE for missing plantings, quantity field, calendar auto-convert
- Reuse `GardenMembershipGuard` (`params.id` = garden id); non-member 404; viewer 403 on mutate
- Calendar add/remove and garden membership stay online-only; this queue MUST NOT call those APIs
- Do not start 005–006 application code in this feature
