---
description: "Task list for Planting Calendar feature implementation"
---

# Tasks: Planting Calendar

**Input**: Design documents from `/specs/003-planting-calendar/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED per constitution. Vitest unit tests (≥80% coverage CI gate);
TDD ordering flexible. Zod contract smokes in `apps/api-e2e` run with `npm test`
(no live DB). Integration is Playwright against Compose Postgres (`npm run e2e`):
UI E2E plus HTTP request tests in `garden-calendar-api.spec.ts`.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Nx monorepo**: `apps/api/`, `apps/api-e2e/`, `apps/web/`, `apps/web-e2e/`,
  `libs/planting-calendar/` (new), `libs/shared-types/`,
  `libs/plant-catalog-data/`, `libs/plant-provider/`, `libs/plant-catalog/`,
  `libs/gardens/` (unchanged domain), `docs/adr/`, `scripts/ci/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the planting-calendar domain library on the existing 002 workspace

- [x] T001 Create Nx library `libs/planting-calendar` with `project.json` (test/lint targets matching `libs/gardens/project.json`, tags `type:lib`, `scope:calendar`, `layer:domain`) and a stub `libs/planting-calendar/src/index.ts`
- [x] T002 [P] Add `@open-garden/planting-calendar` path in `tsconfig.base.json` and Vitest alias plus coverage include for `libs/planting-calendar/src/lib/**/*.ts` in `vitest.config.ts` (exclude `libs/shared-types/src/lib/calendar.ts` like `garden.ts`)
- [x] T003 [P] Leave `libs/planting-calendar/src/index.ts` as the public barrel; add named exports (`domainError`, `computeWindows`, `overlapsThisWeek`, `CalendarService`) only when those files land in T017 and T024–T027 — do not implement domain logic in Setup

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, schema, repositories, provider guidance fields — MUST complete before any user story

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [x] T004 Implement calendar DTOs (`FrostAnchor`, `SeasonalWindowDto`, `FrostRelativeWeeksDto`, `GrowingGuidanceDto`, `CalendarWindowsDto`, `CalendarEntryDto`, `CalendarDto`, `CalendarAddDto`) in `libs/shared-types/src/lib/calendar.ts` per `specs/003-planting-calendar/contracts/shared-types.ts.md`
- [x] T005 [P] Add Zod schemas for calendar add (`plantId` UUID) and list query (`page` default 1, `pageSize` default 100 max 200) in `libs/shared-types/src/lib/calendar.schemas.ts`
- [x] T006 Extend `PlantDetailDto` with required `growingGuidance: GrowingGuidanceDto` (inner windows nullable) in `libs/shared-types/src/lib/plant.ts`; map it in `libs/plant-catalog/src/lib/plant-detail-service.ts`; update existing plant-detail unit/e2e fixtures that construct `PlantDetailDto`. Plant detail UI in `apps/web/src/app/plants/plant-detail.page.ts` MAY ignore the new field (calendar does not require displaying guidance on catalog detail)
- [x] T007 Re-export calendar types and schemas from `libs/shared-types/src/index.ts`
- [x] T008 Add `garden_calendar_entries` (UNIQUE `garden_id, plant_id`, FK garden CASCADE, FK plant RESTRICT) and optional frost-relative columns on `plants` (anchor + signed weeks triplets for indoor/sow/transplant) in `libs/plant-catalog-data/src/lib/schema.ts` per `specs/003-planting-calendar/data-model.md`
- [x] T009 Add Drizzle migration SQL `libs/plant-catalog-data/migrations/0003_planting_calendar.sql` (sync CLI already applies every `*.sql` in that directory)
- [x] T010 [P] Implement `CalendarEntryRepository` (listByGarden paged by commonName join plants, insert idempotent, delete idempotent) in `libs/plant-catalog-data/src/lib/calendar-entry-repository.ts`
- [x] T011 Extend `PlantUpsertInput` and `upsertByVarietyKey` to persist growing-guidance columns in `libs/plant-catalog-data/src/lib/plant-repository.ts`; if any window’s `|weeks| > 52` or earliest > latest or anchor is missing, persist that window as all-null (unknown) rather than failing sync
- [x] T012 Export `CalendarEntryRepository` from `libs/plant-catalog-data/src/index.ts`
- [x] T013 [P] Extend `ProviderPlant` with optional `growingGuidance` in `libs/plant-provider/src/lib/plant-data-provider.ts`; fill Cherry Tomato and Sweet Basil (last-frost indoor/transplant), French Marigold (last-frost sow, indoor null), new Spinach (first-frost sow), Red Maple all-null, and **Papaya** (fruit, `zoneMin` 9 `zoneMax` 11, no guidance) in `libs/plant-provider/src/lib/fixture-plant-provider.ts` so a zone-7 garden can show zone-mismatch
- [x] T014 [P] Keep Perenual `growingGuidance` null in `libs/plant-provider/src/lib/perenual-plant-provider.ts` (do not invent weeks from cycle text)
- [x] T015 Pass `growingGuidance` through `CatalogSyncService` upsert in `libs/plant-catalog/src/lib/catalog-sync-service.ts` (and any miss-fill path that calls `upsertByVarietyKey`)
- [x] T016 [P] Confirm ADR `docs/adr/0005-planting-calendar-windows.md` and ADR 0003 amendment (optional guidance on the provider port)
- [x] T017 Implement calendar error helpers (`Plant is required`, `Plant not found`, `Viewers cannot update this calendar`, reuse `Garden not found`) in `libs/planting-calendar/src/lib/domain-error.ts`; export `domainError` from `libs/planting-calendar/src/index.ts`
- [x] T018 Register a Nest calendar controller placeholder and import it from existing `GardensModule` in `apps/api/src/gardens/gardens.module.ts` / `apps/api/src/gardens/garden-calendar.controller.ts` (`@Controller('gardens/:id/calendar')`, reuse `SessionGuard` + `GardenMembershipGuard`, `@Inject(DATABASE)`)

**Checkpoint**: Foundation ready — user stories can proceed

---

## Phase 3: User Story 1 - View a Garden Planting Calendar (Priority: P1) 🎯 MVP

**Goal**: Members open a per-garden calendar and see indoor/sow/transplant/harvest as date ranges from last or first frost as the catalog indicates; missing guidance is unavailable; incomplete frost explains that windows cannot be produced while the plant list remains; this-week emphasis marks start windows overlapping local today through today+6; viewers read only.

**Independent Test**: As a member of a garden with zone and both frost dates, add a last-frost-relative plant and a first-frost-relative plant, open the calendar, see ranges move when the matching frost date changes; a plant without guidance still appears with unavailable windows; a plant whose sow range includes today is emphasized while one that only harvests this week is not; viewer can read but not mutate.

### Tests for User Story 1 (REQUIRED)

- [x] T019 [P] [US1] Vitest unit tests for signed-week offsets, last vs first frost isolation, **SC-003**: same guidance with two different last-frost `MonthDay` pairs yields different indoor/sow ranges, single-number same-day range, harvest from transplant then sow then indoor, missing guidance/anchor, no clip past frost, Feb 29, year wrap in `libs/planting-calendar/src/lib/windows.spec.ts`
- [x] T020 [P] [US1] Vitest unit tests for this week = today..today+6 local, harvest overlap does not count, unavailable windows do not count, December–January wrap in `libs/planting-calendar/src/lib/this-week.spec.ts`
- [x] T021 [P] [US1] Zod contract smokes (no live DB) for `CalendarDto` / add schema and documented 404/403 messages in `apps/api-e2e/src/calendar.spec.ts`
- [x] T022 [P] [US1] Playwright E2E: add tomato + spinach, see date ranges, last-frost shift moves tomato not spinach (and reverse), maple unavailable, missing first frost banner with list still visible, viewer read-only, this-week emphasis in `apps/web-e2e/src/calendar-view.spec.ts`
- [x] T023 [P] [US1] Playwright HTTP: 401, non-member GET 404, `windowsAvailable` false when frost incomplete, GET returns no `emphasized` field, **SC-003**: same plant on two gardens with different last frost returns different indoor/sow ranges in `apps/web-e2e/src/garden-calendar-api.spec.ts`

### Implementation for User Story 1

- [x] T024 [P] [US1] Implement leap-safe month-day add weeks/days using reference year 2024 and `wrapsYear` in `libs/planting-calendar/src/lib/month-day.ts`; export from `libs/planting-calendar/src/index.ts` as needed
- [x] T025 [P] [US1] Implement `computeWindows(gardenFrost, guidance, daysToMaturity)` in `libs/planting-calendar/src/lib/windows.ts`; export `computeWindows` from `libs/planting-calendar/src/index.ts`
- [x] T026 [P] [US1] Implement `overlapsThisWeek(startWindows, todayLocal: Date)` in `libs/planting-calendar/src/lib/this-week.ts` (indoor/sow/transplant only); export it from `libs/planting-calendar/src/index.ts`
- [x] T027 [US1] Implement `CalendarService.list` (inject `CalendarEntryRepository` + plant/garden repos as constructor deps; membership assumed; join entries+plants+garden; `windowsAvailable`; `zoneMismatch`; include `status` so deprecated plants stay listed; pageSize default 100 max 200; sort `commonName`) and idempotent `add` (so US1 can be tested without US2 UI) in `libs/planting-calendar/src/lib/calendar-service.ts`; export it from `libs/planting-calendar/src/index.ts`
- [x] T028 [US1] Expose `GET /api/gardens/:id/calendar` and `POST /api/gardens/:id/calendar` (owner/collaborator; viewer POST 403; non-member 404) mapping `CalendarDto` in `apps/api/src/gardens/garden-calendar.controller.ts`
- [x] T029 [P] [US1] Implement Angular calendar API client (relative `/api`, `withCredentials`) GET/POST in `apps/web/src/app/gardens/calendar-api.service.ts`
- [x] T030 [US1] Implement standalone calendar page: missing-frost explanation, empty state, per-entry ranges or unavailable, deprecated/`status !== 'active'` unavailable-variety indicator (entry remains; owner/collaborator can still remove later), this-week visual class **and** prefix text “This week” (not color-only), viewer hides add, client sort emphasized then next start then name, using `overlapsThisWeek` in `apps/web/src/app/gardens/garden-calendar.page.ts`
- [x] T031 [US1] Add auth-guarded `/gardens/:id/calendar` in `apps/web/src/app/app.routes.ts` and a Calendar link from `apps/web/src/app/gardens/garden-detail.page.ts`
- [x] T032 [US1] Add a minimal add control (plant picker via existing paged `GET /api/plants`, not an unbounded dump) on `apps/web/src/app/gardens/garden-calendar.page.ts` so the US1 independent test can place tomato/spinach/maple

**Checkpoint**: US1 MVP — per-garden ranges, frost-shift, this-week emphasis, missing-frost list, isolation

---

## Phase 4: User Story 2 - Choose Plants and Filter the Calendar (Priority: P2)

**Goal**: Owners/collaborators add from catalog or personal favorites, remove plants, filter the view by plant type without mutating the saved set, see zone-mismatch, and never create duplicate rows; viewers cannot change the set; favorites stay private.

**Independent Test**: Owner or collaborator adds a favorite plant and a catalog plant, filters by type so only one type remains, removes a plant, confirms a viewer cannot change the set; another user does not see this garden’s calendar plants; adding the same plant twice stays one row.

### Tests for User Story 2 (REQUIRED)

- [x] T033 [P] [US2] Vitest unit tests for idempotent add, remove, viewer refused, unknown plant, deprecated plant still listed with `status` in `libs/planting-calendar/src/lib/calendar-service.spec.ts`
- [x] T034 [P] [US2] Zod contract smokes for add body and 403 viewer message in `apps/api-e2e/src/calendar-mutate.spec.ts`
- [x] T035 [P] [US2] Playwright E2E: add from favorites without exposing favorites to other members, type filter hide/show, filter-to-tree empty state with a way to clear the filter, remove leaves catalog/favorites, duplicate add one row, add Papaya (zones 9–11) to a **zone-7** garden and assert zone-mismatch (not hidden), viewer POST/DELETE refused in `apps/web-e2e/src/calendar-plants.spec.ts`
- [x] T036 [P] [US2] Playwright HTTP: POST 201 then 200 duplicate, DELETE 204 twice, viewer 403, stranger 404, unknown plant 404 in `apps/web-e2e/src/garden-calendar-api.spec.ts`

### Implementation for User Story 2

- [x] T037 [P] [US2] Implement `CalendarService.remove` (idempotent 204 domain) and enforce viewer cannot add/remove in `libs/planting-calendar/src/lib/calendar-service.ts`
- [x] T038 [US2] Expose `DELETE /api/gardens/:id/calendar/:plantId` (204 idempotent; viewer 403; non-member 404) in `apps/api/src/gardens/garden-calendar.controller.ts`
- [x] T039 [US2] Add DELETE to `apps/web/src/app/gardens/calendar-api.service.ts` and remove control on `apps/web/src/app/gardens/garden-calendar.page.ts` (hidden for viewers)
- [x] T040 [US2] Add favorites-as-picker (existing `GET /api/favorites`, session-private) on `apps/web/src/app/gardens/garden-calendar.page.ts` without listing another member’s favorites
- [x] T041 [US2] Implement client-side plant-type filter (vegetable/herb/flower/fruit/shrub/tree) that does not call DELETE, does not drop emphasis on remaining rows, and when the filter matches nothing shows a clear empty state with a control to clear the filter, in `apps/web/src/app/gardens/garden-calendar.page.ts`
- [x] T042 [US2] Render `zoneMismatch` as a clear indicator for Papaya on a zone-7 garden (omit/unknown when garden zone is null) in `apps/web/src/app/gardens/garden-calendar.page.ts`

**Checkpoint**: US1 + US2 — usable calendar set with filter and private favorites picker

---

## Phase 5: User Story 3 - Read a Previously Loaded Calendar Offline (Priority: P3)

**Goal**: Last-loaded calendar remains readable offline; add/remove require connectivity; this-week emphasis uses current local date against cached windows; after reconnect, windows match current frost and removed members cannot act on stale cache.

**Independent Test**: Open a calendar online, go offline (abort calendar API), still read the same windows; try to add a plant offline and see online-required; reconnect and refresh after frost change.

### Tests for User Story 3 (REQUIRED)

- [x] T043 [P] [US3] Playwright E2E: after calendar GET online, abort `**/api/gardens/**/calendar**` (not `setOffline` + reload), cached calendar readable; add/remove while unreachable shows online-required within 5 seconds and does not mutate; while calendar API is still aborted, PATCH garden last frost via `/api/gardens/:id` (not aborted), then restore calendar routes and refresh — tomato windows match the new frost — in `apps/web-e2e/src/calendar-offline.spec.ts`
- [x] T044 [P] [US3] Playwright E2E: cached calendar, advance local date / freeze clock so emphasis follows view-time today not load-day in `apps/web-e2e/src/calendar-offline.spec.ts`
- [x] T045 [P] [US3] Playwright E2E: collaborator caches calendar, owner removes them while calendar API aborted, restore routes and refresh — calendar not found, cache dropped, add not offered in `apps/web-e2e/src/calendar-offline.spec.ts`

### Implementation for User Story 3

- [x] T046 [P] [US3] Implement IndexedDB read-through cache keyed by user + garden id (no mutation queue; garden/calendar 404 deletes that cache) in `apps/web/src/app/gardens/garden-calendar-cache.service.ts`
- [x] T047 [US3] Wire GET through the cache in `apps/web/src/app/gardens/calendar-api.service.ts` and `apps/web/src/app/gardens/garden-calendar.page.ts`; recompute `overlapsThisWeek` at view time from cached windows
- [x] T048 [US3] Surface online-required (no silent fail, no queue) for add/remove in `apps/web/src/app/gardens/calendar-api.service.ts` and `apps/web/src/app/gardens/garden-calendar.page.ts`

**Checkpoint**: All three user stories independently demonstrable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Coverage, YAGNI, quickstart, isolation hardening, CI parity

- [x] T049 [P] Confirm plant catalog and favorites authorization is unchanged (no garden-scoped favorites) in `apps/api/src/plants/plants.controller.ts` and `apps/api/src/favorites/favorites.controller.ts`
- [x] T050 [P] Point operators at planting-calendar verify steps from `specs/003-planting-calendar/quickstart.md` in `README.md`
- [x] T051 Confirm Vitest coverage ≥80% for `libs/planting-calendar` (and that `vitest.config.ts` coverage include lists it)
- [x] T052 YAGNI pass: no layout canvas, bed geometry, in-ground plantings, care reminders, or automatic planting records in `apps/web` or `apps/api`
- [x] T053 Run `specs/003-planting-calendar/quickstart.md` validation (view/frost-shift, plants/filter/favorites, this-week, offline read, reconnect, <2s local calendar)
- [x] T054 Security pass: GET non-member stays 404, viewer mutate 403, no secrets, errors use `ApiErrorDto` in `apps/api/src/gardens/garden-calendar.controller.ts`
- [x] T055 Native controls only (no `[ngValue]`) on calendar add/filter in `apps/web/src/app/gardens/garden-calendar.page.ts`
- [x] T056 Confirm `libs/planting-calendar` does not import Nest, Perenual HTTP, or Drizzle schema/SQL. `CalendarService` MAY import `CalendarEntryRepository` / `PlantRepository` (constructor injection, same as `libs/gardens`). Angular calendar page may import only `overlapsThisWeek` and shared-types — not repositories

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (workspace already exists from 001/002)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational; extends US1 GET/page with mutate UX
- **US3 (Phase 5)**: Depends on Foundational + a loaded calendar from US1
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on US2/US3; includes GET + minimal POST so the story is independently testable
- **US2 (P2)**: After Foundational; practically extends US1 calendar page (filter, favorites picker, remove)
- **US3 (P3)**: After Foundational; needs US1 GET payload to cache; mutations reuse US1/US2 API client

### Within Each User Story

- Tests required; ordering vs implementation flexible
- Shared contracts / library public interface before app wiring
- Library/service before REST endpoints before Angular UI
- Authorization and migrations with the story that needs them (schema is Foundational)
- Unit coverage complete; integration + Playwright when UI + API are ready

### Parallel Opportunities

- Phase 1: T002–T003 after T001
- Phase 2: T004–T005 parallel; T010–T011 after T008; T013–T014 parallel; T016 parallel with schema
- US1: T019–T023 tests parallel; T024–T026 parallel; T029 parallel with controller
- US2: T033–T036 tests parallel; T037 parallel with tests; T040–T042 parallel after DELETE API
- US3: T043–T045 tests parallel with T046 cache service
- Polish: T049–T050, T052, T055–T056 parallel

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Vitest windows.spec.ts"
Task: "Vitest this-week.spec.ts"
Task: "Zod calendar.spec.ts"
Task: "Playwright calendar-view.spec.ts"
Task: "Playwright garden-calendar-api.spec.ts GET"

# Domain in parallel:
Task: "month-day.ts"
Task: "windows.ts"
Task: "this-week.ts"
```

---

## Parallel Example: User Story 2

```bash
Task: "calendar-service.spec.ts add/remove"
Task: "DELETE garden-calendar.controller.ts"
Task: "Playwright calendar-plants.spec.ts"
Task: "Favorites picker + type filter on garden-calendar.page.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`libs/planting-calendar`)
2. Complete Phase 2: Foundational (CRITICAL) including guidance columns, fixtures, migration 0003
3. Complete Phase 3: US1 (ranges, this-week, missing frost, GET/minimal add, tests)
4. **STOP and VALIDATE** via quickstart P1 checks
5. Demo a garden calendar before favorites filter and offline cache

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP calendar view + frost-relative ranges + this-week
3. US2 → add/remove, favorites picker, type filter, zone mismatch
4. US3 → offline read cache, online-required mutations
5. Polish → coverage, YAGNI, quickstart, `npm test` / `npm run e2e`

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then: Developer A finishes US1 UI; B starts US2 mutate/filter; C starts US3 cache (after GET shape exists)

---

## Notes

- [P] = different files, no incomplete dependencies
- [USn] maps to spec user stories for traceability
- Commit after each task or logical group
- Stop at checkpoints to validate independently
- Avoid: new NgModules, GraphQL/tRPC, duplicated DTOs outside `libs/shared-types`, a second data lib, offline mutation queue, direct Perenual calls from calendar, inventing frost weeks, sending `emphasized` from the API, implicit Nest constructor injection under tsx
- Reuse `GardenMembershipGuard` (`params.id` = garden id); non-member 404; viewer 403 on mutate
- Do not start 004–006 application code in this feature
