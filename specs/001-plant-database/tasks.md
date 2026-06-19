---
description: "Task list for Plant Database feature implementation"
---

# Tasks: Plant Database

**Input**: Design documents from `/specs/001-plant-database/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize Next.js project and dev tooling

- [x] T001 Create Next.js 15 App Router project with TypeScript at repository root per specs/001-plant-database/plan.md
- [x] T002 [P] Add docker-compose.yml with PostgreSQL 16 service for local development
- [x] T003 [P] Configure Drizzle ORM in drizzle.config.ts and lib/db/client.ts
- [x] T004 [P] Create .env.example with DATABASE_URL, TREFLE_API_TOKEN, PERENUAL_API_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET
- [x] T005 [P] Configure Vitest and Playwright test runners in package.json, vitest.config.ts, and playwright.config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, auth, ingestion pipeline, and reference data — MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Define Drizzle schema for users table in lib/db/schema/users.ts
- [x] T007 [P] Define Drizzle schema for canonical_plants and provider_plant_sources in lib/db/schema/plants.ts
- [x] T008 [P] Define Drizzle schema for plant_relationships and rootstock_options in lib/db/schema/reference.ts
- [x] T009 [P] Define Drizzle schema for user_locations, user_provisional_plants, user_recently_viewed, user_garden_plant_refs in lib/db/schema/user-data.ts
- [x] T010 [P] Define Drizzle schema for catalog_sync_runs in lib/db/schema/sync.ts
- [x] T011 Export combined schema from lib/db/schema/index.ts, enable pg_trgm extension, add GIN trigram indexes on canonical_plants.common_name in lib/db/migrations/, and generate initial migration
- [x] T012 Implement Auth.js credentials provider config in lib/auth/config.ts and app/api/auth/[...nextauth]/route.ts
- [x] T013 Implement user registration with bcrypt hashing in app/api/auth/register/route.ts
- [x] T014 Add Next.js middleware.ts protecting app/(catalog)/ and /api/plants routes (redirect unauthenticated to /login)
- [x] T015 [P] Create LoginForm and RegisterForm in components/auth/LoginForm.tsx and components/auth/RegisterForm.tsx
- [x] T016 [P] Create auth pages in app/(auth)/login/page.tsx and app/(auth)/register/page.tsx
- [x] T017 Implement Trefle API client in lib/ingestion/trefle-client.ts
- [x] T018 [P] Implement Perenual API client in lib/ingestion/perenual-client.ts
- [x] T019 Implement plant record normalizer mapping provider fields to canonical_plants in lib/ingestion/normalize.ts
- [x] T020 Implement organic fertilizer filter (deny-list + allow-list) in lib/ingestion/fertilizer-filter.ts with Vitest unit tests in tests/unit/fertilizer-filter.test.ts validating FR-017 (non-organic content stripped, organic guidance retained)
- [x] T021 Implement sync job orchestrator with catalog_sync_runs tracking in lib/ingestion/sync-job.ts
- [x] T022 Create CLI sync trigger in scripts/sync-plants.ts calling lib/ingestion/sync-job.ts
- [x] T023 Implement curated reference seed loader for companions and rootstocks in lib/reference/seed-companions.ts and scripts/seed-reference-data.ts
- [x] T024 Implement stub plant creation helper for missing relationship targets in lib/catalog/stub-plants.ts
- [x] T061 Implement shared programmatic catalog query module for downstream features (FR-015) in lib/catalog/query.ts — core getPlantById, getRelationships, getRootstocks against DB layer
- [x] T025 Create cron-protected internal sync endpoint in app/api/internal/sync/route.ts
- [x] T026 Add npm scripts db:migrate, seed:reference, sync:plants to package.json

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Search and Browse the Plant Catalog (Priority: P1) 🎯 MVP

**Goal**: Signed-in users search and browse the full server-side catalog online

**Independent Test**: Sign in, search "tomato" by common name, browse by category; unauthenticated users redirected to login

### Implementation for User Story 1

- [x] T027 [US1] Implement server-side plant search service with trigram matching, category browse, sun/spacing filters, and unified user provisional plant results in lib/catalog/search.ts
- [x] T028 [US1] Implement GET /api/plants/search route in app/api/plants/search/route.ts per specs/001-plant-database/contracts/plant-api.md
- [x] T029 [P] [US1] Create PlantSearch component with query input and filter controls in components/catalog/PlantSearch.tsx
- [x] T030 [P] [US1] Create PlantCard summary component in components/catalog/PlantCard.tsx
- [x] T031 [US1] Implement catalog search and browse page with pagination in app/(catalog)/plants/page.tsx
- [x] T032 [US1] Create catalog layout shell (navigation, no auth logic — middleware handles gating) in app/(catalog)/layout.tsx

**Checkpoint**: User Story 1 fully functional — search and browse work online for signed-in users

---

## Phase 4: User Story 2 — View Complete Plant Details (Priority: P2)

**Goal**: Signed-in users view full plant detail with structured fields, companion links, and rootstock data

**Independent Test**: Open any catalog plant detail; verify FR-004 fields, clickable companion/incompatible links, rootstock for trees

### Implementation for User Story 2

- [x] T033 [US2] Implement PlantDetail projection builder merging canonical, reference, and gap flags in lib/catalog/plant-detail.ts; wire projection into lib/catalog/query.ts (T061)
- [x] T034 [US2] Implement GET /api/plants/[id] route with recently-viewed upsert in app/api/plants/[id]/route.ts — delegate to lib/catalog/query.ts
- [x] T035 [P] [US2] Implement GET /api/plants/[id]/relationships route in app/api/plants/[id]/relationships/route.ts — delegate to lib/catalog/query.ts
- [x] T036 [P] [US2] Implement GET /api/plants/[id]/rootstocks route in app/api/plants/[id]/rootstocks/route.ts — delegate to lib/catalog/query.ts
- [x] T037 [US2] Create PlantDetail component with companion links, field-gap indicators, and provenance badge in components/catalog/PlantDetail.tsx
- [x] T038 [US2] Implement plant detail page in app/(catalog)/plants/[id]/page.tsx

**Checkpoint**: User Stories 1 AND 2 work independently — search → detail navigation with full structured data

---

## Phase 5: User Story 3 — Filter by Climate Compatibility (Priority: P3)

**Goal**: Signed-in users hard-exclude plants incompatible with their saved location frost dates and zone

**Independent Test**: Set postal code, enable climate filter, verify incompatible plants excluded from search; detail shows location-contextualized planting windows

### Implementation for User Story 3

- [x] T039 [US3] Implement geocoding and USDA zone / frost-date resolver in lib/catalog/geocode.ts
- [x] T040 [US3] Implement hard-exclude climate compatibility filter in lib/catalog/climate-filter.ts
- [x] T041 [US3] Implement GET and PUT /api/users/me/location in app/api/users/me/location/route.ts
- [x] T042 [US3] Integrate climate_filter query param into lib/catalog/search.ts and app/api/plants/search/route.ts
- [x] T043 [US3] Create ClimateFilter toggle and location capture modal in components/catalog/ClimateFilter.tsx
- [x] T044 [US3] Add location_context (recommended seed-start/transplant dates) to plant detail projection in lib/catalog/plant-detail.ts and PlantDetail component

**Checkpoint**: Climate filtering works end-to-end with persisted user location across sessions

---

## Phase 6: User Story 4 — Handle Plants Not in the External Catalog (Priority: P4)

**Goal**: Signed-in users create provisional plants, find them in search, and merge when canonical match appears

**Independent Test**: Search nonexistent plant, create provisional, find in search on second session; confirm field-merge link when match offered

### Implementation for User Story 4

- [x] T045 [US4] Implement provisional plant CRUD service in lib/catalog/provisionals.ts
- [x] T046 [US4] Implement GET/POST /api/users/me/provisionals in app/api/users/me/provisionals/route.ts
- [x] T047 [US4] Implement GET /api/users/me/provisionals/[id] in app/api/users/me/provisionals/[id]/route.ts
- [x] T048 [US4] Implement field-merge linker per FR-014a in lib/catalog/merge-provisional.ts
- [x] T049 [US4] Implement POST /api/users/me/provisionals/[id]/link in app/api/users/me/provisionals/[id]/link/route.ts
- [x] T050 [US4] Add post-sync provisional match scanner setting link_status=link_offered in lib/ingestion/sync-job.ts
- [x] T051 [US4] Create ProvisionalPlantForm component in components/catalog/ProvisionalPlantForm.tsx
- [x] T052 [US4] Integrate provisional creation empty-state flow into app/(catalog)/plants/page.tsx
- [x] T053 [US4] Create ProvisionalLinkOffer notification component in components/catalog/ProvisionalLinkOffer.tsx

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Garden pins (offline cache inputs), offline scoped cache, service worker, and validation

**Note**: T062–T063 MUST complete before T054–T058 — `user_garden_plant_refs` populate the offline cache manifest.

- [x] T062 [P] Implement POST/DELETE /api/users/me/garden-plants routes for user_garden_plant_refs in app/api/users/me/garden-plants/route.ts
- [x] T063 [P] Add PinForOfflineToggle component on plant detail page in components/catalog/PinForOfflineToggle.tsx
- [x] T059 [P] Define shared PlantDetail and API response types in lib/offline/cache-types.ts
- [x] T054 [P] Implement cache manifest and bundle builder in lib/offline/cache-manifest.ts (includes garden-pinned + recently viewed IDs)
- [x] T055 [P] Implement GET /api/users/me/cache/manifest in app/api/users/me/cache/manifest/route.ts
- [x] T056 [P] Implement GET /api/users/me/cache/bundle in app/api/users/me/cache/bundle/route.ts
- [x] T057 Implement service worker with IndexedDB scoped cache in public/sw.js per specs/001-plant-database/contracts/offline-cache.md
- [x] T058 Register service worker and offline banner UX in app/layout.tsx
- [x] T064 Add production cron schedule for daily plant sync in .github/workflows/sync-plants-cron.yml
- [x] T065 Add climate filter reference validation suite with test fixtures (SC-005) in tests/unit/climate-filter.test.ts
- [x] T066 Add server-side search performance smoke script validating SC-007 (<2s for 500 records) in scripts/perf-search.ts
- [x] T067 Add Playwright E2E suite covering quickstart.md scenarios including SC-001 search timing (<10s), US1 auth redirect, US2 detail fields, US3 climate filter, US4 provisional cross-session, SC-003 offline detail, and SC-004 relationships API in tests/e2e/plant-catalog.spec.ts
- [x] T060 Run quickstart.md validation checklist and fix any gaps in specs/001-plant-database/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Stories (Phase 3–6)**: All depend on Foundational completion
  - US1 (P1) → no dependency on other stories
  - US2 (P2) → integrates with US1 navigation but independently testable via direct URL
  - US3 (P3) → extends US1 search; independently testable via API
  - US4 (P4) → extends US1 search empty state; independently testable via API
- **Polish (Phase 7)**: Depends on US2 (recently viewed + detail page for T063) minimum; T062–T063 before T054–T058; full value after all stories

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 — no story dependencies
- **US2 (P2)**: Starts after Phase 2 — uses canonical_plants from sync; no US1 code dependency
- **US3 (P3)**: Starts after Phase 2 — extends search service from US1 (T027/T028 should be done first)
- **US4 (P4)**: Starts after Phase 2 — extends search from US1; merge uses plant-detail from US2

### Recommended Story Order

```text
Phase 2 → US1 → US2 → US3 → US4 → Phase 7
```

US2 and US4 can partially parallelize after US1 search API exists.

---

## Parallel Example: User Story 2

```bash
# Parallel API routes (different files):
T035: app/api/plants/[id]/relationships/route.ts
T036: app/api/plants/[id]/rootstocks/route.ts

# Then sequentially:
T033 → T034 → T037 → T038
```

---

## Parallel Example: Foundational Schema

```bash
# All schema files in parallel:
T007: lib/db/schema/plants.ts
T008: lib/db/schema/reference.ts
T009: lib/db/schema/user-data.ts
T010: lib/db/schema/sync.ts

# Then sequentially:
T011 (migration) → T012–T024 → T061 (query module) → T025–T026
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Sign in, search, browse — demo reference catalog
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Search/browse (MVP!)
3. Add US2 → Full plant detail with relationships
4. Add US3 → Climate-aware filtering
5. Add US4 → Provisional plants + merge linking
6. Add Phase 7 → Offline scoped cache

---

## Notes

- T061 (FR-015 query module) lives in Phase 2; US2 API routes (T034–T036) delegate to it
- T020 includes FR-017 unit tests; T065, T066, and T067 validate SC-005, SC-007, and SC-001 plus quickstart E2E scenarios
- Companions/rootstock come from curated seed data (lib/reference/seed-companions.ts), not provider sync
- Online search always hits Postgres; offline limited to scoped IndexedDB subset per plan.md
- Commit after each task or logical group
