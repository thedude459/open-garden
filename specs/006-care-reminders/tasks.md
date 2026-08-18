---
description: "Task list for Care Reminders feature implementation"
---

# Tasks: Care Reminders

**Input**: Design documents from `/specs/006-care-reminders/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED per constitution. Vitest unit tests (≥80% coverage CI gate);
TDD ordering flexible. Zod contract smokes in `apps/api-e2e` run with `npm test`
(no live DB). Integration is Playwright against Compose Postgres (`npm run e2e`):
UI E2E plus HTTP request tests in `care-reminders-api.spec.ts`.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Nx monorepo**: `apps/api/`, `apps/api-e2e/`, `apps/web/`, `apps/web-e2e/`,
  `libs/care-reminders/` (new), `libs/shared-types/`, `libs/plant-catalog-data/`,
  `libs/plant-catalog/`, `libs/plant-provider/`, `libs/seasonal-plantings/`
  (unchanged planting CRUD), `libs/garden-layout/` (unchanged — reminders not
  on the canvas), `libs/planting-calendar/` (unchanged — plans are not
  reminders), `docs/adr/`, `scripts/ci/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the care-reminders domain library on the existing 005 workspace

- [X] T001 Create Nx library `libs/care-reminders` with `project.json` (test/lint targets matching `libs/garden-layout/project.json`, tags `type:lib`, `scope:care`, `layer:domain`) and a stub `libs/care-reminders/src/index.ts`
- [X] T002 [P] Add path aliases in `tsconfig.base.json` and Vitest alias plus coverage include for `libs/care-reminders/src/lib/**/*.ts` in `vitest.config.ts` (exclude reminder DTO files in `libs/shared-types`): `@open-garden/care-reminders` barrel plus Angular-safe subpath `@open-garden/care-reminders/derive` so the PWA never imports `CareReminderService`. Allow `scope:care` on `scope:web` and `scope:api` in `eslint.config.js`
- [X] T003 [P] Leave `libs/care-reminders/src/index.ts` as the public barrel; add named exports (`domainError`, `addIsoDateDays`, `deriveReminders`, `sortReminders`, `CareReminderService`) only when those files land in later tasks — do not implement domain logic in Setup

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, schema, repositories, fixture interval plant, Nest placeholder — MUST complete before any user story

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T004 Implement reminder DTOs (`CareKind`, `ReminderUrgency`, `CareAction`, `ReminderItemDto`, `ReminderListDto`, `ReminderMutationDto`) in `libs/shared-types/src/lib/reminders.ts` and add optional `waterIntervalDays` / `fertilizeIntervalDays` (`number | null`) on `PlantDetailDto` in `libs/shared-types/src/lib/plant.ts` per `specs/006-care-reminders/contracts/shared-types.ts.md` (do not use `waterNeeds` as a cadence)
- [X] T005 [P] Add Zod schemas (`careKindSchema`, `reminderMutationSchema`, `asOfQuerySchema`; dates `YYYY-MM-DD`) in `libs/shared-types/src/lib/reminders.schemas.ts`
- [X] T006 Re-export reminder types and schemas from `libs/shared-types/src/index.ts` (do not add fields to `PlantingDto`, `CalendarDto`, or layout DTOs)
- [X] T007 Extend `plants` with nullable `waterIntervalDays` / `fertilizeIntervalDays` and add `gardenCareEvents` (`plantingId`, `kind`, `occurrenceOn`, `action`, timestamps; UNIQUE `(planting_id, kind, occurrence_on)`; FK CASCADE from plantings) in `libs/plant-catalog-data/src/lib/schema.ts` per `specs/006-care-reminders/data-model.md`
- [X] T008 Add Drizzle migration SQL `libs/plant-catalog-data/migrations/0006_care_reminders.sql` (interval columns integer null; CHECK kind in water/fertilize/harvest; CHECK action in completed/dismissed; UNIQUE occurrence key; sync CLI already applies every `*.sql` in that directory)
- [X] T009 [P] Extend `PlantUpsertInput` and `PlantRepository.upsertByVarietyKey` in `libs/plant-catalog-data/src/lib/plant-repository.ts` to persist `waterIntervalDays` / `fertilizeIntervalDays` (null stays null; do not infer from `waterNeeds`)
- [X] T010 [P] Implement `CareEventRepository` in `libs/plant-catalog-data/src/lib/care-event-repository.ts` (`listForGardenPlantings`, `upsertEvent` last-write-wins on the unique key) and export it from `libs/plant-catalog-data/src/index.ts`
- [X] T011 [P] Add `waterIntervalDays` / `fertilizeIntervalDays` on `ProviderPlant` in `libs/plant-provider/src/lib/plant-data-provider.ts`; fixture plant **Interval Herb** (`waterIntervalDays: 7`, `fertilizeIntervalDays: 21`, known `daysToMaturity`) in `libs/plant-provider/src/lib/fixture-plant-provider.ts`; leave Perenual mapping null in `libs/plant-provider/src/lib/perenual-plant-provider.ts`; pass fields through `libs/plant-catalog/src/lib/catalog-sync-service.ts` and `libs/plant-catalog/src/lib/plant-detail-service.ts`. Existing fixtures keep qualitative `waterNeeds` and **null** intervals
- [X] T012 [P] Confirm ADR `docs/adr/0008-care-reminders.md` is present (derived list; care events; client `asOf`; queue isolation; no Moderate→days map)
- [X] T013 Implement reminder error helpers (`Viewers cannot update reminders`, `Care kind is required`, reuse `Garden not found` / `Planting not found` / `Date must be YYYY-MM-DD`) in `libs/care-reminders/src/lib/domain-error.ts`; export `domainError` from `libs/care-reminders/src/index.ts`
- [X] T014 Register a Nest reminders controller placeholder and import it from existing `GardensModule` in `apps/api/src/gardens/gardens.module.ts` / `apps/api/src/gardens/garden-reminders.controller.ts` (`@Controller('gardens/:id/reminders')`, reuse `SessionGuard` + `GardenMembershipGuard`, `@Inject(DATABASE)` / `@Inject(CareReminderService)` — explicit `@Inject(...)`, no implicit tsx constructor types)

**Checkpoint**: Foundation ready — user stories can proceed

---

## Phase 3: User Story 1 - See Care Reminders for Garden Plantings (Priority: P1) 🎯 MVP

**Goal**: Garden members open a garden’s reminder list derived from seasonal plantings: harvest from planted date + days to maturity (including far-future dates); water/fertilize only when catalog interval columns are set (qualitative `waterNeeds` omitted, not unavailable rows). Flat list: overdue oldest-first, then due today, then upcoming soonest-first. Viewers read. Non-members get garden not-found. Empty garden CTA to record plantings; plantings with nothing derivable show nothing due / not ready. US1 is GET-only — **complete/dismiss is US2**.

**Independent Test**: With a planting that has a planted date and known days to maturity, open reminders and see a harvest item; a planting with no planted date does not invent a harvest day; Cherry Tomato (Moderate, no interval) has no watering row; a calendar plan without a planting does not appear; non-members get the same not-found as a missing garden.

### Tests for User Story 1 (REQUIRED)

- [X] T015 [P] [US1] Vitest unit tests for ISO calendar-day math (`addIsoDateDays`, `diffIsoDateDays`; no DST shift) in `libs/care-reminders/src/lib/dates.spec.ts`
- [X] T016 [P] [US1] Vitest unit tests for `deriveReminders`: harvest omit without planted/DTM; harvest omit when `harvestedOn` set; harvest listed when far future; qualitative water omitted; missing fertilize omitted; Interval Herb one open water and one open fertilize (no stack of missed weeks); **interval boundary fixture** (e.g. planted `2026-01-01`, interval 7 days, `asOf` `2026-02-05` → single water `dueOn` `2026-02-05`, not three overdue rows); planted in the future → upcoming on planted date; two plantings of same variety → two harvest items; calendar/favorite/layout-only rows not passed in so they cannot appear, in `libs/care-reminders/src/lib/derive.spec.ts`
- [X] T017 [P] [US1] Vitest unit tests for `sortReminders` (overdue oldest-first, then due today, then upcoming soonest-first; same `dueOn` ties `plantingId` then kind harvest/water/fertilize) in `libs/care-reminders/src/lib/sort.spec.ts`
- [X] T018 [P] [US1] Vitest unit tests for `CareReminderService.list`: required `asOf`; viewer allowed; non-member `Garden not found`; empty plantings → empty items; deprecated variety still labeled, in `libs/care-reminders/src/lib/care-reminder-service.spec.ts` (in-memory repos in `libs/care-reminders/src/lib/test-memory.ts`)
- [X] T019 [P] [US1] Zod contract smokes (no live DB) for `asOfQuerySchema` / `reminderMutationSchema` and documented 404/400 messages in `apps/api-e2e/src/reminders.spec.ts`
- [X] T020 [P] [US1] Playwright E2E: open Reminders from garden detail; dated Cherry Tomato harvest visible (including >14 days away); no watering row for Moderate-without-interval; empty garden CTA; **undated planting contributes no row while dated planting still shows harvest**; two dated rows of same variety = two harvests; calendar-only plan absent; viewer read-only (no complete/dismiss controls); list order overdue → due today → upcoming in `apps/web-e2e/src/reminders-list.spec.ts`
- [X] T021 [P] [US1] Playwright HTTP: 401; non-member GET 404 `Garden not found`; missing/bad `asOf` 400 `Date must be YYYY-MM-DD`; GET harvest listed; GET Cherry Tomato has no water item; GET Interval Herb planting has at most one water and one fertilize item in `apps/web-e2e/src/care-reminders-api.spec.ts`

### Implementation for User Story 1

- [X] T022 [P] [US1] Implement `addIsoDateDays` / `diffIsoDateDays` (UTC date construction on `YYYY-MM-DD`) in `libs/care-reminders/src/lib/dates.ts`; export from `libs/care-reminders/src/index.ts`
- [X] T023 [US1] Implement `deriveReminders` and `sortReminders` per `specs/006-care-reminders/research.md` (harvest one-shot vs repeating cursor; one open water/fertilize; no Moderate map) in `libs/care-reminders/src/lib/derive.ts` and `libs/care-reminders/src/lib/sort.ts`; export from `libs/care-reminders/src/index.ts` and `@open-garden/care-reminders/derive`
- [X] T024 [US1] Implement `CareReminderService.list` (inject planting/plant/event/membership repos as constructor deps; `asOf` required; MUST NOT import Nest, Perenual HTTP, or Drizzle schema/SQL) in `libs/care-reminders/src/lib/care-reminder-service.ts`; export it from `libs/care-reminders/src/index.ts`
- [X] T025 [US1] Expose `GET /api/gardens/:id/reminders?asOf=` (any member 200; non-member 404; returns sorted `ReminderListDto`) in `apps/api/src/gardens/garden-reminders.controller.ts`
- [X] T026 [P] [US1] Implement Angular reminders API client (relative `/api`, `withCredentials`) GET with local-today `asOf` in `apps/web/src/app/gardens/reminders-api.service.ts`
- [X] T027 [US1] Implement standalone reminders page: flat list with distinct overdue / due today / upcoming labels (not color-only); empty-garden CTA to plantings; garden-level “nothing due / not ready” when no derivable items (undated plantings contribute **no** rows; other plantings may still list); deprecated variety still identified; **cold offline open with no cache** shows online-required or empty state (not a broken error); viewer hides mutate controls (none yet in US1), in `apps/web/src/app/gardens/garden-reminders.page.ts`
- [X] T028 [US1] Add auth-guarded `/gardens/:id/reminders` **before** `gardens/:id` in `apps/web/src/app/app.routes.ts` and a Reminders link from `apps/web/src/app/gardens/garden-detail.page.ts` (alongside Plantings / Calendar / Layout; do not imply they are the same)

**Checkpoint**: US1 MVP — derived harvest list, omit qualitative water, isolation, sort

---

## Phase 4: User Story 2 - Complete or Dismiss a Reminder (Priority: P2)

**Goal**: Owners/collaborators complete (care performed) or dismiss (skip this occurrence). Garden-shared. Repeating care advances `dueOn + intervalDays` (still one open item; may remain overdue). Harvest complete/dismiss hides harvest and MUST NOT write `harvestedOn`. Viewers 403. Last-write-wins on the occurrence key. Planting, catalog, favorites, calendar, and layout are unchanged.

**Independent Test**: Collaborator marks a harvest reminder done; another member no longer sees it as due; the planting remains on the planting list with `harvestedOn` still unset; viewer attempt to complete fails.

### Tests for User Story 2 (REQUIRED)

- [X] T029 [P] [US2] Vitest unit tests for derive after events: **any** harvest event for a planting hides harvest (even if posted `dueOn` differed); water complete/dismiss advances one interval (no stack); cursor is greatest `occurrence_on`, in `libs/care-reminders/src/lib/derive.spec.ts` (same file as T016 — do not run in parallel with T016)
- [X] T030 [US2] Vitest unit tests for `CareReminderService.complete` / `dismiss`: viewer refused `Viewers cannot update reminders`; non-member `Garden not found`; planting other garden `Planting not found`; harvest complete does not change planting dates; last upsert wins on the same occurrence key; **complete/dismiss succeeds on deprecated variety**; **list after planting DELETE omits that planting’s reminders**, in `libs/care-reminders/src/lib/care-reminder-service.spec.ts` (same file as T018 — do not run in parallel with T018)
- [X] T031 [US2] Zod contract smokes for complete/dismiss body and 403 message `Viewers cannot update reminders` in `apps/api-e2e/src/reminders.spec.ts` (same file as T019 — do not run in parallel with T019)
- [X] T032 [P] [US2] Playwright E2E: collaborator completes harvest — second member no longer sees it due; planting still listed; `harvestedOn` unset; dismiss water on Interval Herb then next occurrence can appear; harvest dismiss ends harvest; **complete/dismiss on deprecated variety**; viewer has no complete/dismiss controls in `apps/web-e2e/src/reminders-complete.spec.ts`
- [X] T033 [US2] Playwright HTTP: viewer POST 403 `Viewers cannot update reminders`; complete 204 then GET omits that harvest; GET planting list `harvestedOn` still null; two sequential complete/dismiss of same occurrence, later action stored; **POST with stale `dueOn` returns 204 but GET stays cleared**; **DELETE planting then GET omits its reminders**, in `apps/web-e2e/src/care-reminders-api.spec.ts` (same file as T021 — do not run in parallel with T021)

### Implementation for User Story 2

- [X] T034 [US2] Implement `CareReminderService.complete` / `dismiss` (upsert event; MUST NOT PATCH planting dates; MUST NOT delete planting) in `libs/care-reminders/src/lib/care-reminder-service.ts`
- [X] T035 [US2] Expose `POST /api/gardens/:id/reminders/complete` and `POST /api/gardens/:id/reminders/dismiss` (owner/collaborator 204; viewer 403; non-member 404) in `apps/api/src/gardens/garden-reminders.controller.ts`
- [X] T036 [US2] Wire Complete and Dismiss on `apps/web/src/app/gardens/garden-reminders.page.ts` via `apps/web/src/app/gardens/reminders-api.service.ts`; after success, refresh GET; native buttons (no `[ngValue]`); viewer stays read-only

**Checkpoint**: US1 + US2 — list, complete/dismiss, shared household state

---

## Phase 5: User Story 3 - Offline Complete/Dismiss Queue (Priority: P3)

**Goal**: Last successful GET remains readable offline. Owners/collaborators complete/dismiss on-device immediately (pending), then sync. Failed sync is needs-attention, not success. Viewers read cache only. Queue is `og-reminders-queue`, not `og-plantings-queue` and not layout PUT. Membership loss drops cache/queue and MUST NOT apply pending completes.

**Independent Test**: Load reminders while connected, lose connectivity without wiping the last load, mark one done (pending), reconnect and refresh; another member sees it completed; after membership loss, stale last-load MUST NOT authorize complete/dismiss.

### Tests for User Story 3 (REQUIRED)

- [X] T037 [P] [US3] Playwright E2E: after reminders GET online, abort `**/api/gardens/**/reminders**` (not `setOffline` + reload), cached list readable; complete shows pending; restore and drain — other member sees completed; pending visible before sync in `apps/web-e2e/src/reminders-offline.spec.ts`
- [X] T038 [P] [US3] Playwright E2E: viewer offline reads cache and cannot queue; collaborator caches reminders, owner removes them while reminders API aborted, restore and refresh — not found, cache dropped, pending MUST NOT apply — in `apps/web-e2e/src/reminders-offline.spec.ts`
- [X] T039 [P] [US3] Playwright E2E: failed drain shows needs-attention (not success); planting 404 on complete fails visibly and does not recreate a planting or reminder; **member A completes online while member B has pending complete for same occurrence — after B drains, GET shows cleared and harvest/water does not reappear**, in `apps/web-e2e/src/reminders-offline.spec.ts`

### Implementation for User Story 3

- [X] T040 [P] [US3] Implement IndexedDB read-through cache keyed by user + garden id (garden 404 deletes that cache) in `apps/web/src/app/gardens/garden-reminders-cache.service.ts` (`og-reminders`)
- [X] T041 [P] [US3] Implement complete/dismiss queue keyed by `plantingId:kind:dueOn` (last intent overwrites; viewer never enqueues) in `apps/web/src/app/gardens/reminders-offline.queue.ts` (`og-reminders-queue`)
- [X] T042 [US3] Wire cache + queue through `apps/web/src/app/gardens/reminders-api.service.ts` and `apps/web/src/app/gardens/garden-reminders.page.ts`: show last GET on abort; overlay pending/failed; repeating next due uses `addIsoDateDays(dueOn, intervalDays)` from `@open-garden/care-reminders/derive`; **no cache on first offline visit → online-required or empty (not error)**; MUST NOT write `og-plantings-queue` or layout PUT
- [X] T043 [US3] On reconnect GET/POST 404 (removed member): drop that garden’s reminder cache and queue and do not keep applying — in `apps/web/src/app/gardens/reminders-api.service.ts` and `apps/web/src/app/gardens/garden-reminders.page.ts`

**Checkpoint**: All three user stories independently demonstrable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Coverage, YAGNI, quickstart, isolation hardening, CI parity

- [X] T044 [P] Confirm plant catalog, favorites, calendar, plantings, and layout authorization/payloads are unchanged (reminder POST does not write `garden_plantings` dates, `garden_calendar_entries`, favorites, or layout columns) in `apps/api/src/plants/plants.controller.ts`, `apps/api/src/favorites/favorites.controller.ts`, `apps/api/src/gardens/garden-calendar.controller.ts`, `apps/api/src/gardens/garden-plantings.controller.ts`, and `apps/api/src/gardens/garden-layout.controller.ts`
- [X] T045 [P] Point operators at care-reminders verify steps from `specs/006-care-reminders/quickstart.md` in `README.md`
- [X] T046 Confirm Vitest coverage ≥80% for `libs/care-reminders` (and that `vitest.config.ts` coverage include lists it)
- [X] T047 YAGNI pass: no layout editing, calendar generation, purchasing, weather irrigation, companion rules, OS push, pruning/pest kinds, mapping Moderate→days, auto-fill `harvestedOn` on harvest complete, or reminder mutations on planting/layout queues in `apps/web` or `apps/api`
- [X] T048 Run `specs/006-care-reminders/quickstart.md` validation (see reminders, complete/dismiss, offline queue). Manually confirm first reminders view <2s on the local network after the garden is open — **not** a CI/Playwright timing gate
- [X] T049 Security pass: GET/POST non-member stays 404, viewer POST 403, POST cannot attach another garden’s planting ids, no secrets, errors use `ApiErrorDto` in `apps/api/src/gardens/garden-reminders.controller.ts`
- [X] T050 Native controls only (no `[ngValue]`) on complete/dismiss in `apps/web/src/app/gardens/garden-reminders.page.ts`
- [X] T051 Confirm `libs/care-reminders` does not import Nest, Perenual HTTP, or Drizzle schema/SQL. `CareReminderService` MAY import catalog-data repository **classes** (constructor injection, same as `PlantingService`). Angular reminders page may import only `deriveReminders` / `sortReminders` / `addIsoDateDays` and shared-types — not repositories or the care-reminders barrel
- [X] T052 Confirm last-write-wins: two sequential complete/dismiss of the same occurrence, later save is stored; following GET shows it — covered in `apps/web-e2e/src/care-reminders-api.spec.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (workspace already exists from 001–005)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational; extends US1 GET with complete/dismiss
- **US3 (Phase 5)**: Depends on Foundational + a loaded reminders GET from US1 (queue overlays US2 mutations)
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on US2/US3; GET + list UI so the story is independently testable. **Complete/dismiss is not satisfied until US2.**
- **US2 (P2)**: After Foundational; practically extends US1 reminders page. T029 is **not** parallel with T016 (same `derive.spec.ts`). T030 is **not** parallel with T018 (same service spec). T031 is **not** parallel with T019 (same Zod file). T033 is **not** parallel with T021 (same HTTP spec).
- **US3 (P3)**: After Foundational; needs US1 GET payload to cache; complete/dismiss queue reuses US2 API client

### Within Each User Story

- Tests required; ordering vs implementation flexible
- Shared contracts / library public interface before app wiring
- Library/service before REST endpoints before Angular UI
- Authorization and migrations with the story that needs them (schema is Foundational)
- Unit coverage complete; integration + Playwright when UI + API are ready

### Parallel Opportunities

- Phase 1: T002–T003 after T001
- Phase 2: T004–T005 parallel; T009–T011 after T007; T012 parallel with schema; T014 after T013
- US1: T015–T021 tests parallel; T022 parallel with derive; T026 parallel with controller
- US2: T032 tests parallel; T029 after T016; T030 after T018; T031 after T019; T033 after T021
- US3: T037–T039 tests parallel with T040–T041 cache/queue services
- Polish: T044–T045, T047, T050–T051 parallel

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Vitest dates.spec.ts"
Task: "Vitest derive.spec.ts"
Task: "Vitest sort.spec.ts"
Task: "Vitest care-reminder-service.spec.ts (list)"
Task: "Zod reminders.spec.ts"
Task: "Playwright reminders-list.spec.ts"
Task: "Playwright care-reminders-api.spec.ts (GET)"

# Domain then API then UI:
Task: "dates.ts + derive.ts + sort.ts"
Task: "care-reminder-service.ts list"
Task: "garden-reminders.controller.ts GET"
Task: "garden-reminders.page.ts"
```

---

## Parallel Example: User Story 2

```bash
Task: "derive.spec.ts event cases (after T016)"
Task: "CareReminderService.complete/dismiss"
Task: "POST complete/dismiss controller"
Task: "Playwright reminders-complete.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`libs/care-reminders`)
2. Complete Phase 2: Foundational (CRITICAL) including migration 0006 and Interval Herb
3. Complete Phase 3: US1 (derived list, omit qualitative water, sort, tests)
4. **STOP and VALIDATE** via quickstart P1 checks
5. Demo a harvest list before complete/dismiss and offline queue

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP derived reminder list
3. US2 → complete/dismiss, shared household state
4. US3 → offline cache + complete/dismiss queue
5. Polish → coverage, YAGNI, quickstart, `npm test` / `npm run e2e`

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then: Developer A finishes US1 UI; B starts US2 complete/dismiss; C starts US3 cache/queue (after GET shape exists)

---

## Notes

- [P] = different files, no incomplete dependencies
- [USn] maps to spec user stories for traceability
- Commit after each task or logical group
- Stop at checkpoints to validate independently
- Avoid: new NgModules, GraphQL/tRPC, duplicated DTOs outside `libs/shared-types`, a second data lib, direct Perenual calls, implicit Nest constructor injection under tsx, mapping Moderate→days, auto-fill `harvestedOn`, importing the care-reminders barrel from Angular, enqueueing into `og-plantings-queue` or layout PUT
- Reuse `GardenMembershipGuard` (`params.id` = garden id); non-member 404; viewer 403 on POST
- Client sends `asOf` (household local `YYYY-MM-DD`); do not use server midnight as “today”
- Calendar add/remove MUST NOT appear as reminders
- Layout canvas MUST NOT host reminder editing
