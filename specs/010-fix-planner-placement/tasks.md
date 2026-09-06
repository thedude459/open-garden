# Tasks: Fix Planner Placement

**Input**: Design documents from `/specs/010-fix-planner-placement/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: REQUIRED per constitution and FR-008. Vitest (≥80% coverage CI gate)
for `libs/garden-layout` origin/catalog-drop and `libs/plant-catalog` omit-spacing.
Playwright for stored bed origin and stored Bed View direct-seed. TDD ordering is
flexible. No new HTTP paths. No PostgreSQL migrations.

**Organization**: Tasks are grouped by user story for independent implementation
and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]` … `[US3]`) — setup/foundational/polish omit it
- Include exact file paths in descriptions

## Path Conventions

Nx monorepo: `apps/web/`, `apps/web-e2e/`, `libs/garden-layout/`, `libs/plant-catalog/`,
`libs/plant-catalog-data/`, `libs/shared-types/`

---

## Phase 1: Setup (shared contracts + stand-in)

**Purpose**: Additive catalog DTO and visual stand-in every planting story needs

- [X] T001 Add `spacingInches: number` to `PlantSummaryDto`; `PlantDetailDto extends Omit<PlantSummaryDto, 'spacingInches'>` with `spacingInches: number | null`; `FavoriteListItemDto.plant` uses `Omit<PlantSummaryDto, 'spacingInches'> & { spacingInches: number | null; status: PlantStatus }` in `libs/shared-types/src/lib/plant.ts`. Do **not** add a list query field. List mapping is `toSummary` in T009 (list items always have a number)
- [X] T002 [P] Add CSS plant-type stand-in (`.plant-stand-in` keyed by `plantType`) in `apps/web/src/styles.css` (no image URLs)

---

## Phase 2: Foundational (mapping, reject helper, catalog admission)

**Purpose**: Library math and catalog omit-null-spacing. **No story page wiring until this phase is done.**

**⚠️ CRITICAL**: User story work MUST NOT start until this phase is complete

- [X] T003 Implement `originFromCenter(dropX, dropY, length, width)` and `originFromGrabOffset(originX, originY, startX, startY, currentX, currentY)` in `libs/garden-layout/src/lib/origin.ts` and export from `libs/garden-layout/src/index.ts`
- [X] T004 [P] Implement `catalogDropOutcome` (`ok` | `miss` | `spacing` | `fit`) using `evaluateLayout` / `placementFits` for a hypothetical `direct_seed` at drop center in the **open** bed in `libs/garden-layout/src/lib/catalog-drop.ts` and export from `libs/garden-layout/src/index.ts`
- [X] T005 Vitest: first-place origin is drop minus half size; grab-offset does not center-snap in `libs/garden-layout/src/lib/origin.spec.ts`
- [X] T006 [P] Vitest: miss outside open bed; spacing too close; fit fail; ok on a clear spot in `libs/garden-layout/src/lib/catalog-drop.spec.ts`
- [X] T007 Add `includePlantings` (default `true`) to `hitTestPlan` in `libs/garden-layout/src/lib/hit-test.ts` so Overview can skip planting hits
- [X] T008 [P] Filter `plants.spacing_inches IS NOT NULL` in `PlantRepository.list` in `libs/plant-catalog-data/src/lib/plant-repository.ts` (GET-by-id unchanged)
- [X] T009 Map `spacingInches` in `toSummary`; skip miss-fill upserts when `spacingInches == null` in `libs/plant-catalog/src/lib/catalog-service.ts`
- [X] T010 [P] Skip provider items with `spacingInches == null` in `libs/plant-catalog/src/lib/catalog-sync-service.ts` (do not delete leftover rows; do not guess spacing)
- [X] T011 Vitest: list omits null spacing; miss-fill does not upsert no-spacing provider hits; `getById` still returns a leftover null-spacing row in `libs/plant-catalog/src/lib/catalog-service.spec.ts` and `libs/plant-catalog/src/lib/plant-detail-service.spec.ts`
- [X] T012 [P] Vitest: sync skips null spacing in `libs/plant-catalog/src/lib/catalog-sync-service.spec.ts`
- [X] T013 [P] Vitest: `includePlantings: false` hits the bed, not the mark, in `libs/garden-layout/src/lib/hit-test.spec.ts`
- [X] T014 Remove exports of `clientToPlanWithPanScale` and lib `viewportCenterPlan` from `libs/garden-layout/src/index.ts` (keep `planToLocal`; apps MUST NOT import `viewport-center.ts`). Placement mapping is only `GardenPlanCanvas.clientToPlan` / `viewportCenterPlan()` (SVG CTM) in `apps/web/src/app/gardens/garden-plan-canvas.ts`

**Checkpoint**: Origin and catalog-drop tests pass. `GET /api/plants` cannot return unknown spacing. Stories can wire pages.

---

## Phase 3: User Story 1 - Beds and Areas Land Where Dropped (Priority: P1) 🎯 MVP

**Goal**: On Garden Overview, first-place puts the rectangle **center** in the visible view (current zoom/pan). Moving an existing bed/area keeps the **grabbed point** under the pointer. Save + reload matches what was shown. Overview has no plant panel. Viewer cannot place or move.

**Independent Test**: Zoom and pan away from garden origin; Create bed / Create area; center is in the visible viewport. Grab a corner and drag — no center-snap. Save; reload; GET layout origins match. Viewer has no Create bed. Overview has 0 catalog search controls.

### Tests for User Story 1 (REQUIRED)

- [X] T015 [P] [US1] Playwright: zoom/pan so garden origin is off-screen; **Create bed** and **Create non-planting area**; after **Save layout**, stored origin **center** equals the Overview viewport center used at create (not garden origin); then grab a **corner** and drag — stored origin follows grab-offset (not center-snap); reload matches; viewer cannot **Create bed**; Overview has 0 `Search plants` in `apps/web-e2e/src/planner-place.spec.ts`

### Implementation for User Story 1

- [X] T016 [US1] Create bed and Create area use `originFromCenter` on `canvas.viewportCenterPlan()`; remove `nextOrigin` garden-stack fallback that ignores the view in `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T017 [US1] Move-bed and move-area previews/commits use `originFromGrabOffset` (not center under pointer) in `apps/web/src/app/gardens/garden-plan-canvas.ts`
- [X] T018 [US1] Overview template has no `Plant panel` / `Search plants` markup in `apps/web/src/app/gardens/garden-layout.page.ts` (e2e coverage is T015)

**Checkpoint**: MVP — map placement is trustworthy. Direct seed still the old Add-at-center path until US2.

---

## Phase 4: User Story 2 - Search the Catalog in Bed View and Direct-Seed (Priority: P1)

**Goal**: Bed View plant panel matches Plants catalog search (name, type, climate). Climate filter defaults to this garden’s `hardinessZone` when set. Drag or arm-then-click onto the **open bed** creates `direct_seed` at the drop **center**. Remove **Add {name}**. Empty-bed **Direct seed** focuses the panel only. Overview **shows** planting marks but they are not draggable. After Save, the planting is on the stored plan and visible on Overview.

**Independent Test**: Open Bed View (not Plants page): search, filter type/zone, drag onto bed, see draft mark; Save; Overview shows the mark; Overview has no panel. Arm-then-click works. No `Add {name}`. Name miss uses the same empty / miss-fill path as Plants (**No plants match** if still empty). Viewer cannot Arm.

### Tests for User Story 2 (REQUIRED)

- [X] T019 [P] [US2] Playwright: Bed View `Plant panel` + `Search plants`; zone `<select>` defaults to the garden hardiness zone when set; filtering type/zone **excludes** non-matches; name search with 0 local hits uses server miss-fill (`GET /api/plants?q=`); if still empty, empty-state title **No plants match**; drag (and arm-click) onto open bed; after Save, layout GET has `direct_seed` placement; Overview shows a mark and has 0 `Search plants`; no `Add {commonName}`; viewer cannot Arm in `apps/web-e2e/src/planner-catalog-drop.spec.ts`
- [X] T035 [P] [US2] Vitest: leftover `spacingInches: null` planting still present after `evaluateLayout` (`unavailable`, not dropped) in `libs/garden-layout/src/lib/evaluate-layout.spec.ts`

### Implementation for User Story 2

- [X] T020 [US2] Split canvas `showPlantingMarks` (draw footprints) from `allowPlantingDrag`; Overview sets marks true and drag false; call `hitTestPlan` with `includePlantings: false` on Overview in `apps/web/src/app/gardens/garden-plan-canvas.ts` and `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T021 [US2] Replace name-only search + **Add {name}** with `Plant panel`: `Search plants`, type `<select>`, zone `<select>` (default `garden.hardinessZone` from `GardensApi.detail`, else unset), **Apply**, stand-in + common name + category + climate indicator when zone is set, `Arm {commonName}` (`aria-pressed`); `Bed plan` is keyboard-focusable (armed + Enter/Space places at visible Bed View viewport center) in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T022 [US2] Remove `addDirectSeed` center-place; empty-state **Direct seed** focuses the plant panel (MUST NOT place) in `apps/web/src/app/gardens/garden-bed-view.page.ts` (keep **Direct seed** visible for `apps/web-e2e/src/ui-empty-states.spec.ts`)
- [X] T023 [US2] On catalog drag or armed click/keyboard-place on `Bed plan`, map with `canvas.clientToPlan` (or viewport center for keyboard), run `catalogDropOutcome`. On `ok`: add draft `direct_seed` (`newDirectSeedIds`) with placement **center** at that plan point (not tray / indoor). On `miss` | `spacing` | `fit`: **do not** add a planting and **clear** `armedPlant` (notices for those outcomes are T027). Save still `apps/web/src/app/gardens/planner-save.ts` in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T024 [US2] Valid catalog place MUST NOT post a success notice (Unsaved changes only) in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T025 [P] [US2] Keep Plants catalog list compiling with `spacingInches` on summaries in `apps/web/src/app/plants/plant-list.page.ts` (empty title remains **No plants match**)

**Checkpoint**: Direct seed from the panel works and persists. Overview is a map, not a planter.

---

## Phase 5: User Story 3 - Blocked Placements Explain Why (Priority: P2)

**Goal**: Invalid catalog-from-panel drops/arm-clicks are **rejected** with a specific notice and **no** planting. Arm does not stay ambiguous. Offline uses existing online-required. Moving an already-placed planting still uses 008 flag-and-keep.

**Independent Test**: Drag/arm-click off the open bed → **Drop missed a bed**, 0 plantings. Too close → **Too close to another plant**. Does not fit → **Does not fit in this bed**. Offline mutate → online-required, draft unchanged. Existing planting move still places + flags.

### Tests for User Story 3 (REQUIRED)

- [X] T026 [P] [US3] Playwright in `apps/web-e2e/src/planner-catalog-reject.spec.ts`: (1) catalog drop outside bed → **Drop missed a bed** (`Notification`) and 0 new plantings, arm cleared; (2) too close → **Too close to another plant**, 0 plantings; (3) spot that fails fit → **Does not fit in this bed**, 0 plantings; (4) offline catalog place → existing online-required notice, draft unchanged

### Implementation for User Story 3

- [X] T027 [US3] On `catalogDropOutcome` `miss` / `spacing` / `fit`, post `NoticeService` (**Drop missed a bed** / **Too close to another plant** / **Does not fit in this bed**). Do not add a planting and clear `armedPlant` (T023 already forbids placing; this task is the visible copy) in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T028 [US3] Keep `applyPlantingDrop` + `evaluateLayout` flags for **existing** planting/tray gestures (do not reject-and-revert those) in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T029 [US3] Offline catalog place or Create bed still uses existing online-required error notice without changing the draft in `apps/web/src/app/gardens/garden-bed-view.page.ts` and `apps/web/src/app/gardens/garden-layout.page.ts`

**Checkpoint**: Invalid catalog drops never look like success. 008 move-and-flag still works.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: ADR, coverage, e2e regression, YAGNI

- [X] T030 Write ADR 0012 (SVG CTM as sole screen mapping; Overview marks not editable; catalog-drop reject vs 008 flag-and-keep) in `docs/adr/0012-planner-placement.md`
- [X] T031 [P] Confirm Vitest coverage ≥80% for `libs/garden-layout` and `libs/plant-catalog` via `npm test`
- [X] T032 Run Playwright including 008/009 names (`Save layout`, `Back to overview`, `Drop missed a bed`, `Create bed`, `Direct seed`, `Notification`) via `npm run e2e`
- [X] T033 [P] YAGNI check: `PlantListQueryDto` has no `requireSpacing` in `libs/shared-types/src/lib/plant.ts`; `spacing_inches` stays nullable in `libs/plant-catalog-data/src/lib/schema.ts`; no new Nx lib under `libs/`
- [X] T034 Walk `specs/010-fix-planner-placement/quickstart.md` (zoom/pan place, Bed View search+drag, reject, catalog admission)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Start immediately
- **Foundational (Phase 2)**: Depends on T001 (summary DTO) for T009; BLOCKS all user stories
- **User Story 1 (Phase 3)**: After Phase 2 — Overview placement only
- **User Story 2 (Phase 4)**: After Phase 2; should follow US1 so Overview marks land on a correct map, but panel work does not require US1 Playwright to pass
- **User Story 3 (Phase 5)**: After US2 `catalogDropOutcome` wiring (T023); notices for reject
- **Polish (Phase 6)**: After desired stories

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational. Independent of catalog panel.
- **User Story 2 (P1)**: After Foundational. Uses T004 `catalogDropOutcome` (`ok` places; non-`ok` does not place). Overview marks depend on T020. T035 leftover planting.
- **User Story 3 (P2)**: After US2 place path exists so reject can assert 0 plantings.

### Within Each User Story

- Library helpers before Angular wiring
- Playwright may be written before or after UI (constitution)
- Do not change membership, Save/draft discard, or tray transplant miss copy

### Parallel Opportunities

- T001 and T002
- T003 and T004
- T005 and T006 after their impl files exist
- T008 and T010
- T011 and T012 after T009/T010
- T015 (Playwright spec) can be drafted in parallel with T016–T018
- T019 in parallel with T020–T024 once contracts are known
- T035 in parallel with T019
- T026 in parallel with T027 once copy is fixed

---

## Parallel Example: User Story 1

```bash
# After Phase 2:
Task: "Playwright planner-place.spec.ts"
Task: "originFromCenter in garden-layout.page.ts"
# Then grab-offset on canvas (touches garden-plan-canvas.ts — not parallel with T020)
```

---

## Parallel Example: User Story 2

```bash
Task: "Playwright planner-catalog-drop.spec.ts"
Task: "plant-list.page.ts compiles with spacingInches"
# Panel + canvas marks share garden-bed-view / garden-plan-canvas — sequential
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2
2. Phase 3: Overview first-place + grab-offset
3. **STOP and VALIDATE** T015 / quickstart Overview section
4. Then US2 panel (the reported Direct seed bug)

### Incremental Delivery

1. Setup + Foundational → mapping + catalog admission
2. US1 → trusted Overview map (MVP for the drop-origin bug)
3. US2 → Bed View catalog plant + Overview marks
4. US3 → reject notices
5. Polish ADR + coverage + full e2e

### Parallel Team Strategy

- After Phase 2: Developer A US1 (layout page + canvas move). Developer B catalog Vitest already done in Phase 2; then US2 bed-view panel (avoid simultaneous edits to `garden-plan-canvas.ts` — A finishes T017 first).

---

## Notes

- [P] tasks = different files, no incomplete-task dependencies
- Catalog-from-panel **reject**: T023 MUST NOT add a planting on non-`ok`; T027 adds the visible notice copy
- T035 leftover-planting Vitest can run in parallel with T019
- Keep 008 tray miss **Drop missed a bed**; keep 009 `NoticeService`
- `addFromCatalog` in `apps/web-e2e/src/planner-helpers.ts` is for plantings/calendar pages, **not** Bed View Add-plant
- Commit after each task or logical group
- Stop at checkpoints to validate independently
