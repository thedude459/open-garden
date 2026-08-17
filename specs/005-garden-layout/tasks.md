---
description: "Task list for Garden Layout Designer feature implementation"
---

# Tasks: Garden Layout Designer

**Input**: Design documents from `/specs/005-garden-layout/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED per constitution. Vitest unit tests (≥80% coverage CI gate);
TDD ordering flexible. Zod contract smokes in `apps/api-e2e` run with `npm test`
(no live DB). Integration is Playwright against Compose Postgres (`npm run e2e`):
UI E2E plus HTTP request tests in `garden-layout-api.spec.ts`.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Nx monorepo**: `apps/api/`, `apps/api-e2e/`, `apps/web/`, `apps/web-e2e/`,
  `libs/garden-layout/` (new), `libs/shared-types/`, `libs/plant-catalog-data/`,
  `libs/seasonal-plantings/` (PATCH `bedId` clears layout coords),
  `libs/planting-calendar/` (unchanged — not on the canvas), `docs/adr/`,
  `scripts/ci/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the garden-layout domain library on the existing 004 workspace

- [X] T001 Create Nx library `libs/garden-layout` with `project.json` (test/lint targets matching `libs/seasonal-plantings/project.json`, tags `type:lib`, `scope:layout`, `layer:domain`) and a stub `libs/garden-layout/src/index.ts`
- [X] T002 [P] Add path aliases in `tsconfig.base.json` and Vitest alias plus coverage include for `libs/garden-layout/src/lib/**/*.ts` in `vitest.config.ts` (exclude layout DTO files in `libs/shared-types` like `planting.ts`): `@open-garden/garden-layout` barrel plus Angular-safe subpaths `@open-garden/garden-layout/evaluate` and `@open-garden/garden-layout/rotate` so the PWA never imports `LayoutService`
- [X] T003 [P] Leave `libs/garden-layout/src/index.ts` as the public barrel; add named exports (`domainError`, `evaluateLayout`, `rotateBed90`, `pairRequiredSpacing`, `LayoutService`) only when those files land in later tasks — do not implement domain logic in Setup

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, schema, repository columns, Nest placeholder — MUST complete before any user story

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T004 Implement layout DTOs (`BedOrientation`, `BedGeometryDto`, `LayoutBedDto`, `LayoutPlacementDto`, `LayoutPlantingDto`, `LayoutFlagDto`, `GardenLayoutDto`, `LayoutBedPutDto`, `LayoutPutDto`) in `libs/shared-types/src/lib/layout.ts` per `specs/005-garden-layout/contracts/shared-types.ts.md` (do not add geometry fields to `NamedBedDto` / `PlantingDto`)
- [X] T005 [P] Add Zod schemas (`layoutPutSchema`, `bedOrientationSchema`; inches finite integers; length/width ≥ 1) in `libs/shared-types/src/lib/layout.schemas.ts`
- [X] T006 Re-export layout types and schemas from `libs/shared-types/src/index.ts` (do not add fields to `CalendarDto` or favorite DTOs)
- [X] T007 Extend `gardenBeds` with nullable `originXInches`, `originYInches`, `lengthInches`, `widthInches` and `orientation` (smallint, default 0) and `gardenPlantings` with nullable `layoutXInches`, `layoutYInches` in `libs/plant-catalog-data/src/lib/schema.ts` per `specs/005-garden-layout/data-model.md`
- [X] T008 Add Drizzle migration SQL `libs/plant-catalog-data/migrations/0005_garden_layout.sql` (CHECK: geometry all-null or all four origin/length/width set with length/width ≥ 1 and orientation in 0/90/180/270; layout x/y both null or both set; sync CLI already applies every `*.sql` in that directory)
- [X] T009 [P] Extend `BedRepository` in `libs/plant-catalog-data/src/lib/bed-repository.ts` to read/write geometry columns (list still ordered by name; unsized beds keep null geometry)
- [X] T010 [P] Extend `PlantingRepository` in `libs/plant-catalog-data/src/lib/planting-repository.ts` to read/write `layoutXInches`/`layoutYInches`, add `clearLayoutCoords(plantingId)` and `clearLayoutForBed(gardenId, bedId)`, and call `clearLayoutForBed` inside bed delete **before** the bed row is removed
- [X] T011 [P] Confirm ADR `docs/adr/0007-garden-layout.md` is present (bed-local coords; atomic PUT; 422 save gate; no layout queue)
- [X] T012 Implement layout error helpers (`Viewers cannot update layout`, `Bed size and position are required`, `Bed length and width must be at least 1 inch`, `Bed rotation must be 0, 90, 180, or 270 degrees`, `Placement position is required`, `Layout has spacing or fit problems`, reuse `Garden not found` / `Bed not found` / `Planting not found`) in `libs/garden-layout/src/lib/domain-error.ts`; export `domainError` from `libs/garden-layout/src/index.ts`
- [X] T013 Register a Nest layout controller placeholder and import it from existing `GardensModule` in `apps/api/src/gardens/gardens.module.ts` / `apps/api/src/gardens/garden-layout.controller.ts` (`@Controller('gardens/:id/layout')`, reuse `SessionGuard` + `GardenMembershipGuard`, `@Inject(DATABASE)` / `@Inject(LayoutService)` — explicit `@Inject(...)`, no implicit tsx constructor types)

**Checkpoint**: Foundation ready — user stories can proceed

---

## Phase 3: User Story 1 - Draw Beds to Scale (Priority: P1) 🎯 MVP

**Goal**: Owners/collaborators open a garden layout, size existing named beds (same objects as the planting list), add rectangular beds with length/width, move them, rotate in 90-degree steps (placements stay attached in local coords), and confirm-delete a bed (named bed gone from layout and planting list; plantings unassigned and unplaced). Unsized beds appear as needs-size, not a second name list. Viewers read only. Non-members get garden not-found. US1 MAY PUT with empty `placements` so this story is independently testable; **placing plantings and the 422 spacing/fit save gate are complete only after US2**.

**Independent Test**: As owner, open layout, create or size at least two beds with length and width, reopen and see the same geometry; a bed created on the planting list can be sized here without a duplicate name; viewer cannot change bed shapes; non-member cannot open the layout (same not-found as a missing garden).

### Tests for User Story 1 (REQUIRED)

- [X] T014 [P] [US1] Vitest unit tests for `rotateBed90` (orientation cycles 0→90→180→270→0; local length/width and placement coords unchanged), plan-space mapping, incomplete geometry rejected, in `libs/garden-layout/src/lib/rotate.spec.ts` and `libs/garden-layout/src/lib/geometry.spec.ts`
- [X] T015 [P] [US1] Vitest unit tests for `LayoutService.get` / `put` beds-only snapshot: unsized beds listed with `geometry: null`; PUT listed beds persist origin/length/width/orientation; omitted beds keep names and clear geometry; viewer PUT refused; non-member `Garden not found`; last PUT wins in `libs/garden-layout/src/lib/layout-service.spec.ts` (in-memory repos in `libs/garden-layout/src/lib/test-memory.ts`)
- [X] T016 [P] [US1] Zod contract smokes (no live DB) for `layoutPutSchema` and documented 404/403/400 messages in `apps/api-e2e/src/layout.spec.ts`
- [X] T017 [P] [US1] Playwright E2E: open layout from garden detail; size a planting-list bed without duplicating the name; add a second bed with length and width; reopen same geometry; rotate 90°; start delete cancel leaves bed; confirm delete removes named bed from layout and planting list and leaves plantings unassigned; viewer read-only in `apps/web-e2e/src/layout-beds.spec.ts`
- [X] T018 [P] [US1] Playwright HTTP: 401, non-member GET/PUT 404 `Garden not found`, viewer PUT 403 `Viewers cannot update layout`, PUT two beds 200 then GET matches, PUT omitting a bed clears its geometry but name remains, DELETE bed 204 then plantings `bedId` null and layout coords null in `apps/web-e2e/src/garden-layout-api.spec.ts`

### Implementation for User Story 1

- [X] T019 [P] [US1] Implement `rotateBed90` and bed-local ↔ plan helpers in `libs/garden-layout/src/lib/rotate.ts` and `libs/garden-layout/src/lib/geometry.ts`; export from `libs/garden-layout/src/index.ts` and `@open-garden/garden-layout/rotate`
- [X] T020 [US1] Implement `LayoutService.get` / `put` (inject bed/planting/plant/membership repos as constructor deps; PUT is one transaction of geometry snapshot; empty `placements` allowed; MUST NOT import Nest, Perenual HTTP, or Drizzle schema/SQL) in `libs/garden-layout/src/lib/layout-service.ts`; export it from `libs/garden-layout/src/index.ts`
- [X] T021 [US1] Expose `GET/PUT /api/gardens/:id/layout` (owner/collaborator PUT; viewer GET 200 PUT 403; non-member 404; PUT returns `GardenLayoutDto`) mapping contracts in `apps/api/src/gardens/garden-layout.controller.ts`
- [X] T022 [P] [US1] Implement Angular layout API client (relative `/api`, `withCredentials`) GET/PUT in `apps/web/src/app/gardens/layout-api.service.ts`
- [X] T023 [US1] Implement standalone layout page: empty-layout CTA, needs-size list for unsized named beds, native `<input type="number">` for length/width, 90° rotate control, move on the plan (SVG or positioned rectangles in inch space), pan/zoom or equivalent, in-page Cancel/Confirm bed delete (same pattern as planting remove; confirm calls existing DELETE `/beds/:bedId`; cancel does not call API), no rename field (rename stays on the planting list), viewer hides mutate, in `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T024 [US1] Add auth-guarded `/gardens/:id/layout` **before** `gardens/:id` in `apps/web/src/app/app.routes.ts` and a Layout link from `apps/web/src/app/gardens/garden-detail.page.ts` (alongside Plantings / Calendar; do not imply they are the same)
- [X] T025 [US1] Creating a named bed from the layout uses existing POST `/api/gardens/:id/beds` then PUT geometry — wire on `apps/web/src/app/gardens/garden-layout.page.ts` without a second bed-name catalog

**Checkpoint**: US1 MVP — to-scale rectangular beds, 90° rotate, confirm delete, isolation

---

## Phase 4: User Story 2 - Place Plantings and Check Spacing (Priority: P2)

**Goal**: Owners/collaborators place existing seasonal plantings (not calendar plans) into a bed; placing sets `bedId` on the planting list. Center-to-center spacing uses the **larger** catalog value; fit is `ceil(s/2)` inches from edges. Blocking flags refuse PUT (422) with `Layout has spacing or fit problems`; unavailable spacing does not block. Unplace clears x/y only. Resize/rotate overflow flags fit and does not auto-unplace. Duplicate variety = two placements. Deprecated varieties still identify placements. Viewers see flags but cannot place.

**Independent Test**: Place two existing plantings of known spacing in one bed too close together, see a spacing flag and `Layout has spacing or fit problems`; move them apart, flag clears and save succeeds; unknown spacing is placeable and saveable; calendar plan for the same variety does not appear on the layout.

### Tests for User Story 2 (REQUIRED)

- [X] T026 [P] [US2] Vitest unit tests for `pairRequiredSpacing` (max of two known; skip if either null), center-to-center too-close, mixed 12/24 at 18 inches flags, fit `ceil(s/2)` (e.g. `s=5` needs 3 inches from the edge) / bed smaller than `s`, unavailable never blocking, deprecated plant still evaluates, in `libs/garden-layout/src/lib/spacing.spec.ts` and `libs/garden-layout/src/lib/evaluate-layout.spec.ts`
- [X] T027 [US2] Vitest unit tests for `LayoutService.put` 422 when blocking flags exist (no write; last valid snapshot remains), PUT placements set `bedId`, omit placement clears x/y only, PUT into a bed assigns that bed, plantings of same `plantId` are two placements, in `libs/garden-layout/src/lib/layout-service.spec.ts` (same file as T015 — do not run in parallel with T015)
- [X] T028 [US2] Zod contract smokes for 422 `Layout has spacing or fit problems` message in `apps/api-e2e/src/layout.spec.ts` (same file as T016 — do not run in parallel with T016)
- [X] T029 [P] [US2] Playwright E2E: place two known-spacing plantings too close — flag + visible `Layout has spacing or fit problems` and save refused; move apart — save; mixed larger-wins; unavailable can save; unplace keeps planting on list; place updates planting-list bed; two rows of same variety = two placements; calendar plan without a planting is absent; resize overflow flags and refuses save without unplacing; deprecated/`status !== 'active'` variety still labels the placement and can be unplaced; viewer cannot place in `apps/web-e2e/src/layout-place.spec.ts`
- [X] T030 [US2] Playwright HTTP: PUT too-close 422 and following GET is previous valid plan; PUT mixed-spacing 18" vs 12/24 422; PUT with `spacingInches` null placement 200; PUT placement sets planting `bedId`; omit placement leaves `bedId` unless also unassigned via list; viewer PUT 403 in `apps/web-e2e/src/garden-layout-api.spec.ts` (same file as T018 — do not run in parallel with T018)

### Implementation for User Story 2

- [X] T031 [P] [US2] Implement `pairRequiredSpacing`, fit check (`Math.ceil(s/2)` edge clearance; `length < s` or `width < s` is unfit), and `evaluateLayout` (per-bed pairs; overlapping beds do not compare across beds; `unavailable` non-blocking) in `libs/garden-layout/src/lib/spacing.ts` and `libs/garden-layout/src/lib/evaluate-layout.ts`; export from `libs/garden-layout/src/index.ts` and `@open-garden/garden-layout/evaluate`
- [X] T032 [US2] Run `evaluateLayout` inside `LayoutService.put` **before** write; any blocking flag → throw `Layout has spacing or fit problems` and write nothing; apply placements (set `bedId` + local x/y); omitted plantings unplaced only in `libs/garden-layout/src/lib/layout-service.ts`
- [X] T033 [US2] Map 422 `VALIDATION_ERROR` for the save gate (400 for malformed inches/orientation) in `apps/api/src/gardens/garden-layout.controller.ts`; GET includes `spacingInches`, `placement`, and `flags`
- [X] T034 [US2] When planting-list PATCH changes `bedId` (including to null), clear layout x/y in `libs/seasonal-plantings/src/lib/planting-service.ts` (call `PlantingRepository.clearLayoutCoords`)
- [X] T035 [US2] Unplaced tray + place/move/unplace on `apps/web/src/app/gardens/garden-layout.page.ts` using `evaluateLayout` on unsaved edits; on blocking flags, PUT is attempted or blocked and the user MUST see `Layout has spacing or fit problems` (do not fail silently); native `<select>` for unplaced plantings (no `[ngValue]`); do not show calendar plans; no rename control on the layout page
- [X] T036 [US2] After successful PUT, planting list for that garden shows the same `bedId` (reload or shared cache) — verify from `apps/web/src/app/gardens/garden-layout.page.ts` / plantings page without auto-creating plantings from the catalog on the canvas

**Checkpoint**: US1 + US2 — beds to scale, placements, spacing/fit save gate

---

## Phase 5: User Story 3 - Read a Previously Loaded Layout Offline (Priority: P3)

**Goal**: Last **successfully saved** GET remains readable offline. Geometry/placement edits require connectivity (online-required; no layout mutation queue). Unsaved invalid arrangements MUST NOT become the cache. Stale cache after membership loss MUST NOT authorize PUT. Viewers can read the cache. Planting-list queue stays independent.

**Independent Test**: Load layout online, go offline, still see beds and placements; try to move a bed offline and see online-required; planting-list queued edits remain a separate flow.

### Tests for User Story 3 (REQUIRED)

- [X] T037 [P] [US3] Playwright E2E: after layout GET online, abort `**/api/gardens/**/layout**` (not `setOffline` + reload), cached beds/placements readable; move/resize/save shows online-required within 5 seconds and does not change stored plan in `apps/web-e2e/src/layout-offline.spec.ts`
- [X] T038 [P] [US3] Playwright E2E: viewer offline reads cache and cannot mutate; collaborator caches layout, owner removes them while layout API aborted, restore and refresh — not found, cache dropped, mutate not offered — in `apps/web-e2e/src/layout-offline.spec.ts`
- [X] T039 [P] [US3] Playwright E2E: 422 PUT does not overwrite IndexedDB cache (last valid GET remains after reload) in `apps/web-e2e/src/layout-offline.spec.ts`

### Implementation for User Story 3

- [X] T040 [P] [US3] Implement IndexedDB read-through cache keyed by user + garden id (garden/layout 404 deletes that cache; 422 does not write cache) in `apps/web/src/app/gardens/garden-layout-cache.service.ts`
- [X] T041 [US3] Wire cache through `apps/web/src/app/gardens/layout-api.service.ts` and `apps/web/src/app/gardens/garden-layout.page.ts`: show last successful GET when GET fails with status 0/abort; mutate/save while unreachable shows online-required and MUST NOT enqueue; do not queue layout PUT into `og-plantings-queue`
- [X] T042 [US3] On reconnect GET 404 (removed member): drop that garden’s layout cache and do not PUT — in `apps/web/src/app/gardens/layout-api.service.ts` and `apps/web/src/app/gardens/garden-layout.page.ts`

**Checkpoint**: All three user stories independently demonstrable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Coverage, YAGNI, quickstart, isolation hardening, CI parity

- [X] T043 [P] Confirm plant catalog, favorites, and calendar authorization/payloads are unchanged (layout PUT does not write `garden_calendar_entries` or favorites) in `apps/api/src/plants/plants.controller.ts`, `apps/api/src/favorites/favorites.controller.ts`, and `apps/api/src/gardens/garden-calendar.controller.ts`
- [X] T044 [P] Point operators at garden-layout verify steps from `specs/005-garden-layout/quickstart.md` in `README.md`
- [X] T045 Confirm Vitest coverage ≥80% for `libs/garden-layout` (and that `vitest.config.ts` coverage include lists it)
- [X] T046 YAGNI pass: no companion-planting rules, care reminders, purchasing, calendar plans on the canvas, polygons, arbitrary-angle rotation, GPS, outer property boundary, quantity field, layout mutation queue, or catalog-create on the canvas in `apps/web` or `apps/api`
- [X] T047 Run `specs/005-garden-layout/quickstart.md` validation (beds to scale, spacing/fit save gate, offline read). Manually confirm first layout view <2s on the local network after the garden is open — **not** a CI/Playwright timing gate
- [X] T048 Security pass: GET/PUT non-member stays 404, viewer PUT 403, PUT cannot attach another garden’s bed or planting ids, no secrets, errors use `ApiErrorDto` in `apps/api/src/gardens/garden-layout.controller.ts`
- [X] T049 Native controls only (no `[ngValue]`) on length/width, orientation, unplaced picker in `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T050 Confirm `libs/garden-layout` does not import Nest, Perenual HTTP, or Drizzle schema/SQL. `LayoutService` MAY import catalog-data repository **classes** (constructor injection, same as `PlantingService`). Angular layout page may import only `evaluateLayout`, `rotateBed90`, and shared-types — not repositories or the garden-layout barrel
- [X] T051 Confirm last-write-wins: two sequential valid PUTs, later save is stored; following GET shows it — covered in `apps/web-e2e/src/garden-layout-api.spec.ts`
- [X] T052 Confirm overlapping beds do not run cross-bed spacing (only same-bed pairs) in `libs/garden-layout/src/lib/evaluate-layout.spec.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (workspace already exists from 001–004)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational; extends US1 PUT with placements and the save gate
- **US3 (Phase 5)**: Depends on Foundational + a loaded layout GET from US1 (cache also covers US2 placements)
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on US2/US3; includes GET + PUT beds + confirm-delete so the story is independently testable (empty `placements` is enough). **Spacing/fit 422 is not satisfied until US2.**
- **US2 (P2)**: After Foundational; practically extends US1 layout page (place, flags, save gate). T027 is **not** parallel with T015 (same `layout-service.spec.ts`). T028 may extend the same `layout.spec.ts` as T016 — do not treat those two as parallel file-writers.
- **US3 (P3)**: After Foundational; needs US1 GET payload to cache; PUT failures reuse US1/US2 API client

### Within Each User Story

- Tests required; ordering vs implementation flexible
- Shared contracts / library public interface before app wiring
- Library/service before REST endpoints before Angular UI
- Authorization and migrations with the story that needs them (schema is Foundational)
- Unit coverage complete; integration + Playwright when UI + API are ready

### Parallel Opportunities

- Phase 1: T002–T003 after T001
- Phase 2: T004–T005 parallel; T009–T010 after T007; T011 parallel with schema; T013 after T012
- US1: T014–T018 tests parallel; T019 parallel with service; T022 parallel with controller
- US2: T026, T029 tests parallel; T027 after T015 (same service spec); T028 after T016 (same Zod file); T030 after T018 (same HTTP spec); T031 parallel with tests; T034 parallel with evaluate implementation
- US3: T037–T039 tests parallel with T040 cache service
- Polish: T043–T044, T046, T049–T050, T052 parallel

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Vitest rotate.spec.ts + geometry.spec.ts"
Task: "Vitest layout-service.spec.ts (beds-only)"
Task: "Zod layout.spec.ts"
Task: "Playwright layout-beds.spec.ts"
Task: "Playwright garden-layout-api.spec.ts"

# Domain then API then UI:
Task: "rotate.ts + geometry.ts"
Task: "layout-service.ts"
Task: "garden-layout.controller.ts"
Task: "garden-layout.page.ts"
```

---

## Parallel Example: User Story 2

```bash
Task: "spacing.spec.ts + evaluate-layout.spec.ts"
Task: "spacing.ts + evaluate-layout.ts"
Task: "LayoutService.put save gate"
Task: "Playwright layout-place.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`libs/garden-layout`)
2. Complete Phase 2: Foundational (CRITICAL) including migration 0005
3. Complete Phase 3: US1 (beds to scale, rotate, confirm delete, tests)
4. **STOP and VALIDATE** via quickstart P1 checks
5. Demo a garden plan before placements and offline cache

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP to-scale beds + confirm delete
3. US2 → placements, spacing/fit, 422 save gate
4. US3 → offline read cache (no layout queue)
5. Polish → coverage, YAGNI, quickstart, `npm test` / `npm run e2e`

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then: Developer A finishes US1 UI; B starts US2 spacing/evaluate; C starts US3 cache (after GET shape exists)

---

## Notes

- [P] = different files, no incomplete dependencies
- [USn] maps to spec user stories for traceability
- Commit after each task or logical group
- Stop at checkpoints to validate independently
- Avoid: new NgModules, GraphQL/tRPC, duplicated DTOs outside `libs/shared-types`, a second data lib, direct Perenual calls, implicit Nest constructor injection under tsx, layout mutation queue, companion rules, `[ngValue]`, importing the garden-layout barrel from Angular
- Reuse `GardenMembershipGuard` (`params.id` = garden id); non-member 404; viewer 403 on PUT
- Planting-list queue stays online-only for membership/calendar; this feature MUST NOT enqueue layout PUT
- Calendar add/remove MUST NOT appear as placeable items
- Do not start 006 care-reminders application code in this feature
