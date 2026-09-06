# Tasks: Load Performance

**Input**: Design documents from `/specs/011-load-performance/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED (constitution + FR-008 / SC-006). Vitest (≥80% coverage CI gate)
for count batching, layout join-once, and miss-fill `upsertMany`. DB-backed
`apps/api-e2e` for assembly &lt;1s.
Playwright for data-request counts and 2s interactive budgets. TDD order is
flexible. No new HTTP paths. No PostgreSQL migrations.

**Organization**: Tasks are grouped by user story for independent implementation
and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]` … `[US4]`) — setup/foundational/polish omit it
- Include exact file paths in descriptions

## Path Conventions

Nx monorepo: `apps/api/`, `apps/web/`, `apps/web-e2e/`, `apps/api-e2e/`,
`libs/gardens/`, `libs/garden-layout/`, `libs/plant-catalog/`,
`libs/plant-catalog-data/`, `libs/shared-types/`

---

## Phase 1: Setup (shared contracts)

**Purpose**: Additive DTO fields every story’s compile path needs

- [x] T001 Add `bedCount: number` and `placementCount: number` to `GardenSummaryDto` in `libs/shared-types/src/lib/garden.ts` (inherited by `GardenDetailDto`). Integers ≥ 0; do not omit
- [x] T002 [P] Add `illustrationUrl: string | null` to `PlantSummaryDto` in `libs/shared-types/src/lib/plant.ts` (`PlantDetailDto` omits only `spacingInches` and therefore includes it). Favorites nested plants may carry the field; do not change favorites UI

---

## Phase 2: Foundational (batch helpers, memory stubs)

**Purpose**: Repository batch APIs and in-memory stubs. **No story page wiring until this phase is done.**

**⚠️ CRITICAL**: User story work MUST NOT start until this phase is complete

- [x] T003 Implement `countsForGardenIds(ids: string[]): Promise<Map<string, { bedCount: number; placementCount: number }>>` on `GardenRepository` in `libs/plant-catalog-data/src/lib/garden-repository.ts`: one `GROUP BY garden_id` for `garden_beds` and one for **placed** `garden_plantings` (`bed_id` and layout x/y all non-null). Scope `IN (ids)` only. Missing ids → `0`/`0`. Empty `ids` → empty map, no query
- [x] T004 [P] Implement `upsertManyByVarietyKey(inputs: PlantUpsertInput[])` as one multi-row `INSERT … ON CONFLICT` on `PlantRepository` in `libs/plant-catalog-data/src/lib/plant-repository.ts`. Empty array is a no-op. Keep existing `upsertByVarietyKey` for other callers
- [x] T005 Add `countsForGardenIds` to the in-memory garden repo in `libs/gardens/src/lib/test-memory.ts` (count beds/placed plantings if the memory store has them; otherwise `0`/`0` per id) so `GardenService` tests compile when list/get start calling it
- [x] T006 [P] Extend catalog Vitest mocks with `upsertManyByVarietyKey: vi.fn()` in `libs/plant-catalog/src/lib/catalog-service.spec.ts` (implementation wiring is US3)

**Checkpoint**: Batch helpers exist. Stories can map DTOs, UI, logs, and tests without new Nx projects or migrations.

---

## Phase 3: User Story 1 - Garden List Stays Fast as the Household Grows (Priority: P1) 🎯 MVP

**Goal**: `GET /api/gardens` returns accurate `bedCount` / `placementCount` from a **constant** number of lookups for the page. List UI shows counts including `0`. Viewer sees the same counts. Assembly of 20 gardens &lt; 1s and not ~20× a 1-garden list. List interactive ≤ 2s. No per-garden count GET.

**Independent Test**: Member of 20 gardens opens Gardens: each row shows correct bed and placement counts (zeros included). Network: one list request, not one extra per garden. Viewer of a shared garden sees the same counts. 20-garden assembly &lt; 1s and not linearly slower than 1 garden. List usable within 2s.

### Tests for User Story 1 (REQUIRED) ✅

- [x] T007 [P] [US1] Vitest: list maps counts; empty garden is `0`/`0`; viewer list includes the shared garden’s counts; `countsForGardenIds` is called **once** with the page ids (20-id vs 1-id: same call count) in `libs/gardens/src/lib/garden-service.spec.ts`
- [x] T008 [P] [US1] DB-backed check in `apps/api-e2e/src/gardens-load.spec.ts`: assemble a 20-garden list payload in **&lt; 1000ms** and not on the order of 20× a 1-garden assembly; record `garden.list.assembly_ms` (fail if ≥ 1000ms). Keep N+1 call-count in Vitest (T007).
- [x] T009 [P] [US1] Playwright: seed 20 gardens; open Gardens; each row shows bed and placement counts (including `0`); a garden link is clickable within **2s**; intercept data requests — MUST NOT `GET` layout or garden-by-id per row for counts — in `apps/web-e2e/src/garden-list-load.spec.ts`

### Implementation for User Story 1

- [x] T010 [US1] After `listForUser`, call `countsForGardenIds` once with the page’s garden ids and map `bedCount` / `placementCount` on list **and** get-by-id (single-id list, same helper) in `libs/gardens/src/lib/garden-service.ts`. Membership isolation unchanged (404 for non-members)
- [x] T011 [US1] Show bed count and placement count on each row (including `0`) in `apps/web/src/app/gardens/garden-list.page.ts`. Empty list unchanged
- [x] T011b [US1] In `apps/web/src/app/gardens/garden-list.page.ts` (and list mapping if needed), treat absent `bedCount`/`placementCount` on cached rows as `0`. Do not throw when reading pre-011 IndexedDB list/detail in `apps/web/src/app/gardens/garden-cache.service.ts`
- [x] T012 [P] [US1] Log payload-assembly duration as `garden.list.assembly_ms` at info on `GET` list in `apps/api/src/gardens/gardens.controller.ts` (assembly only, not full HTTP)

**Checkpoint**: MVP — garden list counts are correct, batched, budgeted, and visible.

---

## Phase 4: User Story 2 - Overview and Bed View Stay Fast with Many Plantings (Priority: P1)

**Goal**: Layout GET stays **one** `listAllForLayout` join for spacing; canopy via `plantingFootprintRadius` in memory (no canopy column, no per-planting `getById`). Overview and Bed View load layout + garden detail **in parallel**. 100-placement assembly &lt; 1s. Interactive ≤ 2s. Viewer still cannot mutate.

**Independent Test**: Open Overview and Bed View for a garden with 100+ placements. Marks use spacing/canopy as today. No sequential per-planting plant fetch. Detail assembly &lt; 1s. Pan/zoom or bed select within 2s. Viewer read-only.

### Tests for User Story 2 (REQUIRED) ✅

- [x] T013 [P] [US2] Vitest: `LayoutService.get` / snapshot calls `listAllForLayout` **once** and does **not** call plant `getById` in a loop; canopy is `plantingFootprintRadius` over joined rows in `libs/garden-layout/src/lib/layout-service.spec.ts`
- [x] T014 [P] [US2] DB-backed check in `apps/api-e2e/src/layout-load.spec.ts`: assemble layout for **100** placements in **&lt; 1000ms**; record `garden.layout.assembly_ms`; fail if ≥ 1000ms. Join-once stays Vitest (T013).
- [x] T015 [P] [US2] Playwright: seed 100 placed plantings; Overview and Bed View interactive (pan/zoom or select) within **2s**; intercept data requests — no `GET /api/plants/:id` per placement; pictures MUST NOT block — in `apps/web-e2e/src/planner-load.spec.ts`

### Implementation for User Story 2

- [x] T016 [US2] Confirm `listAllForLayout` join already selects `spacingInches` in `libs/plant-catalog-data/src/lib/planting-repository.ts` and snapshot `Promise.all`s beds/plantings/areas in `libs/garden-layout/src/lib/layout-service.ts`. Remove any leftover per-id plant fetch on GET. Do **not** change PUT row loops
- [x] T017 [US2] Load with `Promise.all` (`planner.load` + `gardensApi.detail`) instead of sequential awaits in `apps/web/src/app/gardens/garden-layout.page.ts` and `apps/web/src/app/gardens/garden-bed-view.page.ts`. Do not fold name/zone into layout GET
- [x] T018 [P] [US2] Log `garden.layout.assembly_ms` at info on layout GET in `apps/api/src/gardens/garden-layout.controller.ts`

**Checkpoint**: Overview/Bed View load is join + derive + parallel HTTP, locked by tests.

---

## Phase 5: User Story 3 - Plant Search Results Appear Complete Without Per-Result Fetches (Priority: P2)

**Goal**: `GET /api/plants` items include `illustrationUrl` (`null` today). Client uses `<img>` when set, else existing `.plant-stand-in`. Miss-fill uses **one** `upsertManyByVarietyKey`. Data-request count does not grow with result count. Interactive ≤ 2s. Picture-file GETs allowed.

**Independent Test**: Search with ≥10 results on Plants page and Bed View panel. Each row has stand-in (or img). No `GET /api/plants/:id` per row. Empty search still uses existing empty/miss-fill path. Usable within 2s.

### Tests for User Story 3 (REQUIRED) ✅

- [x] T019 [P] [US3] Vitest: `toSummary` / list items include `illustrationUrl: null`; list mapping does not fetch per id in `libs/plant-catalog/src/lib/catalog-service.spec.ts`
- [x] T020 [P] [US3] Vitest: empty-name miss-fill calls `upsertManyByVarietyKey` **once** (not `upsertByVarietyKey` in a loop); still skips null spacing; provider failure still empty in `libs/plant-catalog/src/lib/catalog-service.spec.ts`
- [x] T021 [P] [US3] Playwright: ≥10 results on Plants page and Bed View panel; stand-in or img; intercept data requests — count MUST NOT grow with results; `GET /api/plants/:id` per row forbidden; interactive within **2s**; ignore picture-file GETs — in `apps/web-e2e/src/plant-search-load.spec.ts`

### Implementation for User Story 3

- [x] T022 [US3] Set `illustrationUrl: null` in `toSummary` in `libs/plant-catalog/src/lib/catalog-service.ts` (and plant-detail mapping if it shares the summary shape). Do not add a column or provider image field
- [x] T023 [US3] Replace miss-fill `for … await upsertByVarietyKey` with one `upsertManyByVarietyKey` (skip null spacing, then re-`list`) in `libs/plant-catalog/src/lib/catalog-service.ts`
- [x] T024 [P] [US3] Render `<img [src]="p.illustrationUrl">` when `illustrationUrl` is a string, otherwise existing `.plant-stand-in` in `apps/web/src/app/plants/plant-list.page.ts` and `apps/web/src/app/gardens/garden-bed-view.page.ts`. Do not wait on img decode for interactivity
- [x] T025 [P] [US3] Log `plants.list.assembly_ms` at info on plant list GET in `apps/api/src/plants/plants.controller.ts`

**Checkpoint**: Search identity is on the result; miss-fill is one write; request count is constant.

---

## Phase 6: User Story 4 - Hot-Path Slowdowns Are Found Before Release (Priority: P3)

**Goal**: CI **fails** if list work grows per garden, detail work grows per placement, or search issues one extra data GET per result, or if 1s assembly / 2s interactive budgets miss. Timings for the three paths are in logs/test output. Leftover sequential per-row work on these hot **load** paths is batched (FR-007). Layout PUT loops stay out of scope.

**Independent Test**: Run the automated load checks. Temporarily restore a per-garden count query or per-result plant GET — tests MUST fail. Failure output or API logs show `garden.list`, `garden.layout`, and `plants.list` timings.

### Tests for User Story 4 (REQUIRED) ✅

- [x] T026 [US4] Ensure T007–T009, T013–T015, and T019–T021 **fail** on N+1 or budget miss (not timings-only). If any path is only logged, add a failing assertion in the corresponding `*.spec.ts`. Print or attach the three timings on failure

### Implementation for User Story 4

- [x] T027 [US4] On **load** only, assert there is no `await` inside a per-row loop in: `GardenService.list` / `get` (`libs/gardens/src/lib/garden-service.ts`), `LayoutService.get` (`libs/garden-layout/src/lib/layout-service.ts`), `CatalogService.list` (`libs/plant-catalog/src/lib/catalog-service.ts`), and `load()` in `apps/web/src/app/gardens/garden-list.page.ts`, `garden-layout.page.ts`, `garden-bed-view.page.ts`, `apps/web/src/app/plants/plant-list.page.ts`. Batch any leftover. Layout **PUT** loops are out of scope. Done when those functions have no per-row `await` on load.

**Checkpoint**: Regressions fail CI and are diagnosable. Hot-path load loops are gone.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: ADR already drafted; coverage, e2e, YAGNI, quickstart

- [x] T028 Confirm ADR 0013 (batched list counts, layout join + derive canopy, `illustrationUrl` null, miss-fill upsertMany, failing gates + timings) in `docs/adr/0013-load-performance.md`
- [x] T029 [P] Confirm Vitest coverage ≥80% for touched libs (`libs/gardens`, `libs/garden-layout`, `libs/plant-catalog`) via `npm test`
- [x] T030 Run Playwright including new load specs via `npm run e2e`
- [x] T031 [P] YAGNI check: no `plants.illustration_url` column; no canopy column; no new Nx lib under `libs/`; no denormalized counters on `gardens`
- [x] T032 Walk `specs/011-load-performance/quickstart.md` (20-garden list, 100-placement Overview/Bed View, search stand-in, regression gate)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Start immediately (DTO fields)
- **Foundational (Phase 2)**: Depends on T001 for garden mapping types; T002 for catalog mapping types. BLOCKS all user stories
- **User Story 1 (Phase 3)**: After Phase 2 — garden list only
- **User Story 2 (Phase 4)**: After Phase 2 — independent of US1 (layout vs list)
- **User Story 3 (Phase 5)**: After Phase 2 — independent of US1/US2 except Bed View panel shares `garden-bed-view.page.ts` with US2 (finish T017 before T024 if both in flight)
- **User Story 4 (Phase 6)**: After US1–US3 tests exist (T026 asserts they fail on regression)
- **Polish (Phase 7)**: After desired stories

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational. Independent of layout/search
- **User Story 2 (P1)**: After Foundational. Independent of list counts. Shares Bed View file with US3 illustration markup
- **User Story 3 (P2)**: After Foundational. Catalog list independent; Bed View panel after T017 if US2 is in progress
- **User Story 4 (P3)**: After US1–US3 automated checks exist

### Within Each User Story

- Tests REQUIRED; order vs implementation is flexible (constitution)
- Shared contracts / repository helpers before service mapping before Angular
- Authorization unchanged; do not add new roles
- Unit coverage complete; Playwright when UI + API are ready
- Story complete before moving to next priority unless staffed in parallel

### Parallel Opportunities

- T001 and T002
- T003 and T004
- T005 and T006
- T007, T008, T009 can be drafted in parallel with T010–T012 (T011b with T011)
- T011 and T011b share `garden-list.page.ts` — do T011 then T011b (or one commit)
- T013, T014, T015 in parallel with T016–T018
- T019, T020, T021 in parallel with T022–T025
- After Phase 2: US1 and US2 in parallel; US3 after or with US2 if Bed View file ownership is split
- T029 and T031

---

## Parallel Example: User Story 1

```bash
# After Phase 2:
Task: "Vitest garden-service.spec.ts counts + call-once"
Task: "Playwright garden-list-load.spec.ts"
# Then map counts in garden-service.ts and garden-list.page.ts
```

---

## Parallel Example: User Story 2

```bash
Task: "Vitest layout-service.spec.ts join-once"
Task: "Playwright planner-load.spec.ts"
# Promise.all in garden-layout.page.ts and garden-bed-view.page.ts (same load pattern; can be one commit)
```

---

## Parallel Example: User Story 3

```bash
Task: "Vitest catalog-service.spec.ts illustrationUrl + upsertMany"
Task: "Playwright plant-search-load.spec.ts"
# Then catalog-service.ts, then plant-list.page.ts in parallel with bed-view stand-in if US2 T017 is done
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: 20-garden list counts, query-count, &lt;1s assembly, ≤2s interactive
5. Then US2 layout load, then US3 search, then US4 gate audit

### Incremental Delivery

1. Setup + Foundational → batch helpers ready
2. US1 → garden list counts (MVP)
3. US2 → Overview/Bed View load
4. US3 → search illustration + miss-fill batch
5. US4 → failing combined gate + leftover load-path audit
6. Polish ADR + coverage + full e2e + quickstart

### Parallel Team Strategy

- After Phase 2: Developer A US1 (garden-service + list page). Developer B US2 (layout tests + Promise.all). Developer C US3 catalog service (avoid `garden-bed-view.page.ts` until A/B finish T017)

---

## Notes

- [P] tasks = different files, no incomplete-task dependencies
- [USn] maps to spec user stories 1–4
- Counts are **new** on the list (batched aggregates; stale IndexedDB rows default counts to `0`)
- `illustrationUrl` is **null** in 011 until a later art feature; CSS stand-in stays
- 1s assembly gates are **api-e2e** (Postgres); Vitest covers N+1 call-count only
- Picture-file GETs are allowed; extra **data** GETs per row are not
- Layout PUT row loops are out of scope (save, not load)
- Commit after each task or logical group
- Stop at checkpoints to validate independently
- Avoid: new Nx libs, migrations, canopy column, denormalized counters, GraphQL
