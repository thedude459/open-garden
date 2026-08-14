---
description: "Task list for Plant Database feature implementation"
---

# Tasks: Plant Database

**Input**: Design documents from `/specs/001-plant-database/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED per constitution. Vitest unit tests (≥80% coverage CI gate);
TDD ordering flexible. Integration + Playwright E2E required once UI + API work
for each story before the feature is complete.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Nx monorepo**: `apps/api/`, `apps/api-e2e/`, `apps/web/`, `apps/web-e2e/`,
  `libs/shared-types/`, `libs/plant-catalog/`, `libs/plant-provider/`,
  `libs/plant-favorites/`, `libs/plant-catalog-data/`, `libs/auth/`,
  `docs/adr/`, `docker-compose.yml`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize Nx workspace skeleton and tooling for Plant Database

- [x] T001 Create Nx monorepo workspace with TypeScript strict mode and apps/libs layout per `specs/001-plant-database/plan.md`
- [x] T002 [P] Add `docker-compose.yml` with PostgreSQL 16+ service and documented env vars (no secrets in repo)
- [x] T003 [P] Configure Vitest workspace defaults and coverage threshold ≥80% in `vitest.workspace.ts` (or Nx project configs)
- [x] T004 [P] Scaffold `libs/shared-types` library with empty public API at `libs/shared-types/src/index.ts`
- [x] T005 [P] Scaffold Angular standalone PWA app at `apps/web` and NestJS API app at `apps/api`
- [x] T006 [P] Scaffold Playwright e2e project at `apps/web-e2e`
- [x] T007 [P] Configure ESLint/Prettier for strict TypeScript (`no-explicit-any` as error) across workspace

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Auth, persistence, provider port, shared contracts — MUST complete before any user story

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [x] T008 Implement shared plant DTO/enum types from `specs/001-plant-database/contracts/shared-types.ts.md` in `libs/shared-types/src/lib/plant.ts`
- [x] T009 [P] Write ADR for Drizzle ORM choice in `docs/adr/0001-orm-drizzle.md`
- [x] T010 [P] Write ADR for session auth in `docs/adr/0002-auth-sessions.md`
- [x] T011 [P] Write ADR for plant provider port in `docs/adr/0003-plant-provider-port.md`
- [x] T012 Create Drizzle schema for User, Session, Plant, Favorite, CatalogSyncRun in `libs/plant-catalog-data/src/lib/schema.ts` per `data-model.md`
- [x] T013 Add initial Drizzle migration SQL under `libs/plant-catalog-data/migrations/` and migrate script target
- [x] T014 Implement plant repository helpers (upsert by `variety_key`, getById, paged query stubs) in `libs/plant-catalog-data/src/lib/plant-repository.ts`
- [x] T015 Implement `PlantDataProvider` port interfaces in `libs/plant-provider/src/lib/plant-data-provider.ts` per `contracts/rest-api.md`
- [x] T016 [P] Implement `FixturePlantProvider` with deterministic garden varieties in `libs/plant-provider/src/lib/fixture-plant-provider.ts`
- [x] T017 Implement variety_key normalization + de-dupe mapping in `libs/plant-catalog/src/lib/variety-key.ts`
- [x] T018 Implement minimal session auth (register/login/logout + HTTP-only cookie) in `libs/auth` and wire guards in `apps/api/src/auth/`
- [x] T019 Add NestJS auth guard requiring authenticated user on protected routes in `apps/api/src/auth/session.guard.ts`
- [x] T020 Wire PostgreSQL connection + Drizzle client provider in `apps/api/src/database/`
- [x] T021 Add secure error filter (no secret leakage) and request validation pipes in `apps/api/src/common/`
- [x] T022 [P] Vitest unit tests for variety_key and FixturePlantProvider in `libs/plant-catalog/src/lib/variety-key.spec.ts` and `libs/plant-provider/src/lib/fixture-plant-provider.spec.ts`

**Checkpoint**: Foundation ready — user stories can proceed

---

## Phase 3: User Story 1 - Search and Browse the Plant Catalog (Priority: P1) 🎯 MVP

**Goal**: Signed-in users browse a paged default catalog, search by name, and open plant detail served from local PostgreSQL; hybrid miss-fill on empty name search; PWA caches catalog for offline read.

**Independent Test**: Sign in via login UI, open catalog with no query (paged list), search by name, open detail; go offline and still read cached catalog; already-synced plants work without live provider.

### Tests for User Story 1 (REQUIRED)

- [x] T023 [P] [US1] Vitest unit tests for catalog query/detail services in `libs/plant-catalog/src/lib/catalog-service.spec.ts`
- [x] T024 [P] [US1] API integration tests for `GET /api/plants` and `GET /api/plants/:id` (auth + pagination + empty) in `apps/api-e2e/src/plants.spec.ts`
- [x] T025 [P] [US1] Playwright E2E: login, browse default page, search, open detail in `apps/web-e2e/src/plant-catalog.spec.ts`
- [x] T026 [P] [US1] Playwright E2E: after browse/detail online, go offline and confirm cached catalog still readable in `apps/web-e2e/src/plant-catalog-offline.spec.ts`

### Implementation for User Story 1

- [x] T027 [P] [US1] Implement catalog list/search domain service (local DB first) in `libs/plant-catalog/src/lib/catalog-service.ts`
- [x] T028 [P] [US1] Implement plant detail domain service in `libs/plant-catalog/src/lib/plant-detail-service.ts`
- [x] T029 [US1] Implement sync/upsert service (fixture provider → Plant rows) in `libs/plant-catalog/src/lib/catalog-sync-service.ts`
- [x] T030 [US1] Implement on-demand miss-fill path (search with `q`, zero local hits → provider → upsert → re-query) in `libs/plant-catalog/src/lib/catalog-service.ts`
- [x] T031 [US1] Expose `GET /api/plants` and `GET /api/plants/:id` controllers mapping shared-types DTOs in `apps/api/src/plants/plants.controller.ts`
- [x] T032 [US1] Add admin/operator sync endpoint `POST /api/admin/plants/sync` (admin role) in `apps/api/src/plants/plants-sync.controller.ts`
- [x] T033 [US1] Add NestJS CLI/nx target to seed via fixture provider in `apps/api/src/plants/sync-cli.ts`
- [x] T034 [P] [US1] Implement standalone login page (session cookies) in `apps/web/src/app/auth/login.page.ts`
- [x] T035 [P] [US1] Implement auth API client (login/logout/register as needed) in `apps/web/src/app/auth/auth-api.service.ts`
- [x] T036 [US1] Add auth route guards / login redirect for catalog routes in `apps/web/src/app/auth/`
- [x] T037 [US1] Enable Angular PWA / service worker for `apps/web` so previously loaded assets and plant GET responses can work offline
- [x] T038 [US1] Implement IndexedDB (or Cache API) catalog cache for last list pages + opened plant details in `apps/web/src/app/plants/plant-catalog-cache.service.ts` (offline zone/type filters apply client-side to cached sets only; uncached filter queries show clear empty/unavailable—no silent live API failure)
- [x] T039 [US1] Implement Angular plants API client using shared-types with offline read-through cache in `apps/web/src/app/plants/plants-api.service.ts`
- [x] T040 [P] [US1] Implement Angular plant catalog list page (paged, no NgModules) in `apps/web/src/app/plants/plant-list.page.ts`
- [x] T041 [P] [US1] Implement Angular plant detail page showing required attributes + unavailable nulls in `apps/web/src/app/plants/plant-detail.page.ts`

**Checkpoint**: US1 MVP — browse/search/detail + login + offline catalog cache for authenticated users

---

## Phase 4: User Story 2 - Filter by Growing Zone and Plant Type (Priority: P2)

**Goal**: Zone and plant-type filters work alone or with name search; empty filter combos show clear empty state.

**Independent Test**: Open catalog, filter by type only and zone only without name; combine with search; impossible filters → empty state.

### Tests for User Story 2 (REQUIRED)

- [x] T042 [P] [US2] Vitest unit tests for zone-range inclusion and plantType filtering in `libs/plant-catalog/src/lib/catalog-filters.spec.ts`
- [x] T043 [P] [US2] API integration tests for `zone` and `plantType` query params in `apps/api-e2e/src/plants-filters.spec.ts`
- [x] T044 [P] [US2] Playwright E2E for filter-only and combined filter+search in `apps/web-e2e/src/plant-filters.spec.ts`

### Implementation for User Story 2

- [x] T045 [US2] Extend plant repository paged query with zone and plantType predicates in `libs/plant-catalog-data/src/lib/plant-repository.ts`
- [x] T046 [US2] Extend catalog service query DTO validation (zone 1–13, PlantType enum) in `libs/plant-catalog/src/lib/catalog-service.ts`
- [x] T047 [US2] Wire filter query params on `GET /api/plants` in `apps/api/src/plants/plants.controller.ts`
- [x] T048 [US2] Add filter controls (zone, plant type) to plant list UI in `apps/web/src/app/plants/plant-list.page.ts`
- [x] T049 [US2] Ensure filters alone (no `q`) never trigger provider miss-fill in `libs/plant-catalog/src/lib/catalog-service.ts`

**Checkpoint**: US1 + US2 — browse/search/filter complete

---

## Phase 5: User Story 3 - Personal Plant Favorites (Priority: P3)

**Goal**: Authenticated users add/view/remove private favorites; offline queue-and-sync; no cross-user leakage.

**Independent Test**: User A favorites a plant, sees it, removes it; User B never sees A’s list; offline add/remove syncs on reconnect.

### Tests for User Story 3 (REQUIRED)

- [x] T050 [P] [US3] Vitest unit tests for idempotent add/remove and ownership rules in `libs/plant-favorites/src/lib/favorites-service.spec.ts`
- [x] T051 [P] [US3] API integration tests for favorites isolation (User A vs B) and idempotent PUT/DELETE in `apps/api-e2e/src/favorites.spec.ts`
- [x] T052 [P] [US3] Playwright E2E for favorite add/remove and offline pending→sync in `apps/web-e2e/src/plant-favorites.spec.ts`

### Implementation for User Story 3

- [x] T053 [P] [US3] Implement favorites domain service (session user scoping, idempotent ops) in `libs/plant-favorites/src/lib/favorites-service.ts`
- [x] T054 [P] [US3] Implement favorites repository (UNIQUE user_id+plant_id) in `libs/plant-catalog-data/src/lib/favorite-repository.ts`
- [x] T055 [US3] Expose `GET /api/favorites`, `PUT /api/favorites/:plantId`, `DELETE /api/favorites/:plantId` in `apps/api/src/favorites/favorites.controller.ts`
- [x] T056 [US3] Include `isFavorite` on plant detail DTO for current user in `apps/api/src/plants/plants.controller.ts`
- [x] T057 [P] [US3] Implement Angular favorites list page in `apps/web/src/app/favorites/favorites-list.page.ts`
- [x] T058 [US3] Add favorite toggle on plant detail in `apps/web/src/app/plants/plant-detail.page.ts`
- [x] T059 [US3] Implement IndexedDB offline favorites queue + merge view in `apps/web/src/app/favorites/favorites-offline.queue.ts`
- [x] T060 [US3] Implement online drain/sync of pending mutations with clientMutationId in `apps/web/src/app/favorites/favorites-sync.service.ts`
- [x] T061 [US3] Show pending/unavailable indicators on favorites UI in `apps/web/src/app/favorites/favorites-list.page.ts`

**Checkpoint**: All three user stories independently demonstrable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, docs, provider adapter, CI gates

- [x] T062 [P] Implement Perenual `HttpPlantProvider` adapter (env-based API key, no hardcoded secrets) in `libs/plant-provider/src/lib/perenual-plant-provider.ts`
- [x] T063 [P] Unit tests for Perenual mapper/error handling with mocked HTTP in `libs/plant-provider/src/lib/perenual-plant-provider.spec.ts`
- [x] T064 Add CI coverage gate (≥80%) + SCA/SAST/secrets-scan configs under `.github/workflows/` (or repo CI equivalent)
- [x] T065 [P] Document operator sync + local verify steps aligned with `specs/001-plant-database/quickstart.md` in `README.md`
- [x] T066 Run full quickstart.md validation (Compose, migrate, fixture sync, login, US1–US3 smoke, offline catalog, performance gates) and confirm ≥80% unit coverage for all `plant-*` libs and touched apps
- [x] T067 YAGNI pass: remove unused abstractions; confirm no planting schedule/layout/care-reminder surfaces in `apps/web` or `apps/api`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP (includes login + PWA catalog cache)
- **US2 (Phase 4)**: Depends on Foundational; builds on US1 catalog list API/UI
- **US3 (Phase 5)**: Depends on Foundational + plant detail identity from US1
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on US2/US3
- **US2 (P2)**: After Foundational; practically extends US1 list endpoint/UI
- **US3 (P3)**: After Foundational; needs plant IDs from catalog (US1 data path)

### Within Each User Story

- Tests required; ordering vs implementation flexible
- Shared contracts / library public interface before app wiring
- Library/service before REST endpoints before Angular UI
- Login + PWA cache before claiming offline catalog done
- Authorization and migrations with the story that needs them

### Parallel Opportunities

- Phase 1: T002–T007 after T001
- Phase 2: T009–T011 ADRs parallel; T016 parallel with port; T022 after variety_key + fixture
- US1: T023–T026 tests parallel; T027–T028 parallel; T034–T035 parallel; T040–T041 parallel
- US2: T042–T044 parallel
- US3: T050–T052 parallel; T053–T054 parallel
- Polish: T062–T063 and T065 parallel

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Vitest unit tests in libs/plant-catalog/src/lib/catalog-service.spec.ts"
Task: "API integration tests in apps/api-e2e/src/plants.spec.ts"
Task: "Playwright catalog E2E in apps/web-e2e/src/plant-catalog.spec.ts"
Task: "Playwright offline catalog E2E in apps/web-e2e/src/plant-catalog-offline.spec.ts"

# Auth UI in parallel:
Task: "Login page in apps/web/src/app/auth/login.page.ts"
Task: "Auth API client in apps/web/src/app/auth/auth-api.service.ts"

# Catalog UI in parallel after API client + cache:
Task: "Plant list page in apps/web/src/app/plants/plant-list.page.ts"
Task: "Plant detail page in apps/web/src/app/plants/plant-detail.page.ts"
```

---

## Parallel Example: User Story 3

```bash
Task: "Favorites domain service in libs/plant-favorites/src/lib/favorites-service.ts"
Task: "Favorites repository in libs/plant-catalog-data/src/lib/favorite-repository.ts"
Task: "Favorites list page in apps/web/src/app/favorites/favorites-list.page.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1 (login, browse/search/detail, PWA cache, tests)
4. **STOP and VALIDATE** via quickstart US1 checks (including offline catalog)
5. Demo MVP catalog

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP catalog + offline read
3. US2 → filters
4. US3 → favorites + offline sync
5. Polish → Perenual adapter, CI, docs

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then: Developer A finishes US1 polish; B starts US2 filters; C starts US3 favorites domain (after plant IDs exist)

---

## Notes

- [P] = different files, no incomplete dependencies
- [USn] maps to spec user stories for traceability
- Commit after each task or logical group
- Stop at checkpoints to validate independently
- Avoid: direct vendor calls outside `libs/plant-provider`, new NgModules, GraphQL/tRPC, duplicated DTOs outside `libs/shared-types`, scheduled sync in v1
- Post-analyze remediation applied: PWA/offline catalog, login UI, web-e2e, operator-only sync, collapsed coverage gates
