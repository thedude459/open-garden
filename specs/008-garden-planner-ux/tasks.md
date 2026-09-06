# Tasks: Garden Planner UX

**Input**: Design documents from `/specs/008-garden-planner-ux/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: REQUIRED per constitution. Vitest (≥80% coverage CI gate). Playwright
E2E once UI + API are functional. TDD ordering is flexible.

**Organization**: Tasks are grouped by user story for independent implementation
and testing. T079–T081 were added after analysis (US1 empty-garden, US4
catalog-removed cue, US6 membership-loss cache).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]` … `[US6]`) — setup/foundational/polish omit it
- Include exact file paths in descriptions

## Path Conventions

Nx monorepo: `apps/api/`, `apps/web/`, `apps/web-e2e/`, `libs/garden-layout/`,
`libs/seasonal-plantings/`, `libs/care-reminders/`, `libs/shared-types/`,
`libs/plant-catalog-data/`

---

## Phase 1: Setup (Shared contracts & schema)

**Purpose**: Types and Drizzle columns every story needs

- [X] T001 Add `StartMethod`, `LayoutAreaDto`, `LayoutAreaPutDto`, extend `GardenLayoutDto` / `LayoutPutDto` / `LayoutPlantingDto` in `libs/shared-types/src/lib/layout.ts`
- [X] T002 [P] Add `startMethod` and `indoorStartedOn` to `PlantingDto` / `PlantingCreateDto` and add `TransplantListDto` in `libs/shared-types/src/lib/planting.ts`
- [X] T003 Extend Zod for layout areas and start-method invariants in `libs/shared-types/src/lib/layout.schemas.ts` and `libs/shared-types/src/lib/planting.schemas.ts`
- [X] T004 Add `gardenNonPlantingAreas` table and `gardenPlantings.startMethod` / `indoorStartedOn` columns in `libs/plant-catalog-data/src/lib/schema.ts`

---

## Phase 2: Foundational (Blocking prerequisites)

**Purpose**: Migration, persistence, shared draft, and routes. **No user story UI until this phase is done.**

**⚠️ CRITICAL**: User story work MUST NOT start until this phase is complete

- [X] T005 Add PostgreSQL migration `libs/plant-catalog-data/migrations/0008_planner_visualization.sql` (areas table, planting columns, default `direct_seed`; **delete unsized beds** with start-method cascade: delete in-bed `direct_seed` plantings, unassign+unplace `transplant` plantings, then DELETE those beds)
- [X] T006 Upsert/list non-planting areas on layout GET/PUT in `libs/garden-layout/src/lib/layout-service.ts` (omitted areas are not deleted; empty name 400; duplicate area name in garden 409; uniqueness among areas only)
- [X] T007 Enforce `startMethod` / `indoorStartedOn` on planting create in `libs/seasonal-plantings/src/lib/planting-service.ts`
- [X] T008 Change bed DELETE to delete in-bed `direct_seed` plantings and unassign+unplace `transplant` plantings in `libs/seasonal-plantings/src/lib/planting-service.ts`
- [X] T009 Add `DELETE /api/gardens/:id/areas/:areaId` (member AuthZ, 404 `Area not found`) in `apps/api/src/gardens/garden-layout.controller.ts` and wire `apps/api/src/gardens/gardens.module.ts`
- [X] T010 Return `areas` and planting `startMethod` / `indoorStartedOn` from GET/PUT layout in `apps/api/src/gardens/garden-layout.controller.ts`
- [X] T011 Accept `startMethod` on POST plantings in `apps/api/src/gardens/garden-plantings.controller.ts`
- [X] T012 Create shared **in-memory** planner draft service (dirty flag, hydrate `base` from layout cache or GET, discard on leave/reload, keep on Overview↔Bed↔Transplant navigation) in `apps/web/src/app/gardens/planner-draft.service.ts` — do **not** write IndexedDB from this service
- [X] T013 Add routes `/gardens/:id/layout`, `/gardens/:id/layout/beds/:bedId`, `/gardens/:id/transplants` in `apps/web/src/app/app.routes.ts` (reuse existing signed-in guard and membership 404; no new unauth page)
- [X] T014 Refuse POST `/beds` without length and width (400) in `apps/api/src/gardens/garden-beds.controller.ts`

**Checkpoint**: Schema, REST shape, and draft/routing skeleton exist. Stories can proceed.

---

## Phase 3: User Story 1 - See the Whole Garden on Overview (Priority: P1) 🎯 MVP

**Goal**: Members open Garden Overview and see every sized bed, every non-planting area, and planting **name/count** labels — no in-bed marks and no planting edits.

**Independent Test**: Garden with several sized beds (one empty), plantings, and one area: Overview shows all rectangles to scale; occupied beds show names/counts; empty beds show; viewer read-only; non-member not-found.

### Tests for User Story 1 (REQUIRED)

- [X] T015 [P] [US1] Vitest: planting name/count labels (no marks) in `libs/garden-layout/src/lib/overview-labels.spec.ts`
- [X] T016 [P] [US1] Vitest: `drawableBeds` never includes `geometry: null` (defense after `0008` deletes leftovers) in `libs/garden-layout/src/lib/drawable-beds.spec.ts`
- [X] T017 [P] [US1] Playwright: Overview shows beds, areas, labels, no planting drag in `apps/web-e2e/src/planner-overview.spec.ts` (extend `apps/web-e2e/src/planner-helpers.ts`)

### Implementation for User Story 1

- [X] T018 [P] [US1] Implement `overviewPlantingLabels` (name + count per bed) in `libs/garden-layout/src/lib/overview-labels.ts` and export from `libs/garden-layout/src/index.ts`
- [X] T019 [US1] Draw sized beds, areas (distinct fill), and labels — **not** planting marks — in `apps/web/src/app/gardens/garden-plan-canvas.ts`
- [X] T020 [US1] Load layout via `apps/web/src/app/gardens/layout-api.service.ts` into the draft and render Overview in `apps/web/src/app/gardens/garden-layout.page.ts` (heading Garden Overview; region `Garden plan`)
- [X] T021 [US1] Hide create/drag/Save for viewers; non-member already 404 — keep AuthZ on GET layout in `apps/api/src/gardens/garden-layout.controller.ts`
- [X] T022 [US1] Make `apps/web/src/app/gardens/garden-layout-cache.service.ts` the **only** IndexedDB writer for last successful layout GET (never an unsaved draft)
- [X] T079 [P] [US1] Playwright: garden with transplants and no sized beds — Overview empty (or areas only); tray fills once a bed exists — in `apps/web-e2e/src/planner-overview.spec.ts`

**Checkpoint**: Overview is a readable map. No planting editor on this view.

---

## Phase 4: User Story 2 - Arrange Beds and Non-Planting Areas (Priority: P1)

**Goal**: Create (size required), move, resize, rotate beds; create/move/resize areas (draft until Save); confirmed immediate area and bed delete; click bed opens Bed View; new rectangles appear in the visible viewport.

**Independent Test**: Create bed with size → appears in view; move/resize/rotate; add area, Save; confirm-delete area (immediate); select bed → Bed View not a size form; confirm-delete bed; viewer cannot mutate.

### Tests for User Story 2 (REQUIRED)

- [X] T023 [P] [US2] Vitest: `viewportCenterPlan` in `libs/garden-layout/src/lib/viewport-center.spec.ts`
- [X] T024 [P] [US2] Vitest: Overview hit-test (area handle → area → bed handle → bed → pan) and click-vs-drag open-bed in `libs/garden-layout/src/lib/hit-test.spec.ts`
- [X] T025 [P] [US2] Vitest: bed DELETE start-method cascade in `libs/seasonal-plantings/src/lib/planting-service.spec.ts`
- [X] T026 [P] [US2] Playwright: Create bed, area CRUD, select-to-open, viewer cannot mutate in `apps/web-e2e/src/planner-beds.spec.ts`

### Implementation for User Story 2

- [X] T027 [P] [US2] Implement `viewportCenterPlan` in `libs/garden-layout/src/lib/viewport-center.ts` and export from `libs/garden-layout/src/index.ts`
- [X] T028 [US2] Extend `hitTestPlan` / `classifyGesture` for areas and Overview `open-bed` vs `move-bed` in `libs/garden-layout/src/lib/hit-test.ts`
- [X] T029 [US2] Pointer Events: pan empty space; move/resize bed and area; rotate 90°; flags on gesture end in `apps/web/src/app/gardens/garden-plan-canvas.ts`
- [X] T030 [US2] **Create bed** (name, length, width required; refuse otherwise) placing rectangle at viewport center on the draft; **Unsaved changes**; Save POST beds then PUT in `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T031 [US2] **Create non-planting area** at viewport center on the draft (unique name among areas); Save PUT `areas` (400 empty / 409 duplicate); confirmed **Delete area** calls DELETE immediately in `apps/web/src/app/gardens/layout-api.service.ts` and `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T032 [US2] Click/tap bed with no drag navigates to `/gardens/:id/layout/beds/:bedId` (not a size inspector) in `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T033 [US2] Confirmed bed delete remains immediate DELETE; rely on T008 cascade; numeric length/width/origin for **already sized** beds that does **not** use select-to-open; **no** Needs size leftover UI in `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T034 [US2] Compensating DELETE of POSTed new beds if PUT fails in `apps/web/src/app/gardens/planner-draft.service.ts`
- [X] T035 [US2] Offline mutations show online-required and MUST NOT change the draft in `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T036 [US2] HTTP coverage for area DELETE 401/403/404 and PUT area empty-name 400 / duplicate-name 409 in `apps/web-e2e/src/garden-layout-api.spec.ts`

**Checkpoint**: Overview is the geometry editor. Select bed is ready for US4.

---

## Phase 5: User Story 3 - Manage Indoor Transplants (Priority: P1)

**Goal**: Transplant View creates/full-deletes indoor starts (immediate planting records). They fill the Bed View tray. Indoor water/fertilizer via `deriveIndoorReminders`. Direct seed never appears here.

**Independent Test**: Add transplant → tray, not on a bed; indoor tasks when catalog has intervals; delete → gone from tray; viewer read-only; non-member 404.

### Tests for User Story 3 (REQUIRED)

- [X] T037 [P] [US3] Vitest: `deriveIndoorReminders` (unplaced transplant only; omit null interval; skip direct seed and placed transplants) in `libs/care-reminders/src/lib/derive-indoor.spec.ts`
- [X] T038 [P] [US3] Vitest: transplant create requires `indoorStartedOn`; direct_seed forbids it in `libs/seasonal-plantings/src/lib/planting-service.spec.ts`
- [X] T039 [P] [US3] Playwright: Transplant View add/delete, viewer cannot mutate, indoor items in `apps/web-e2e/src/planner-transplants.spec.ts`

### Implementation for User Story 3

- [X] T040 [P] [US3] Implement `deriveIndoorReminders` in `libs/care-reminders/src/lib/derive-indoor.ts` and export from `libs/care-reminders/src/index.ts`
- [X] T041 [US3] GET `/api/gardens/:id/transplants` (unplaced transplants + indoor reminders) in `apps/api/src/gardens/garden-plantings.controller.ts` (or a dedicated controller) and `apps/api/src/gardens/gardens.module.ts`
- [X] T042 [US3] Keep garden reminders GET on `planted_on` only (do not mix indoor items) in `libs/care-reminders/src/lib/derive.ts`
- [X] T043 [US3] Angular Transplant View page (list, Add transplant from catalog, Delete, indoor complete/dismiss via existing reminders API) in `apps/web/src/app/gardens/garden-transplants.page.ts`
- [X] T044 [US3] `Transplants` navigation from Overview and plantings API helpers in `apps/web/src/app/gardens/plantings-api.service.ts` and `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T045 [US3] Rename `apps/web/src/app/gardens/unplaced-tray.ts` to `apps/web/src/app/gardens/planting-tray.ts` and filter to `startMethod === 'transplant' && placement === null`
- [X] T046 [US3] Indoor complete/dismiss reuse POST reminders in `apps/web/src/app/gardens/reminders-api.service.ts` from Transplant View
- [X] T047 [US3] Viewer read-only Transplant View; owner/collaborator mutate; 404 non-member in `apps/web/src/app/gardens/garden-transplants.page.ts` and GET transplants AuthZ in `apps/api/src/gardens/garden-plantings.controller.ts`

**Checkpoint**: Tray has a source of records. Bed View (US4) can place them.

---

## Phase 6: User Story 4 - Manage Plantings in Bed View (Priority: P1)

**Goal**: Bed View places transplants from the tray, direct-seeds from the catalog, moves plantings in the bed, restores transplants to the tray, deletes direct seed on confirmed remove. No bed geometry or area editing. Shared draft + Save.

**Independent Test**: Place tray transplant, Save; direct-seed catalog plant; restore transplant; delete direct seed; no bed resize; Overview cannot place; viewer cannot drag.

### Tests for User Story 4 (REQUIRED)

- [X] T048 [P] [US4] Vitest: Bed View drop (tray → bed, transplant → tray restore, direct seed → tray no-op, miss-bed revert) in `libs/garden-layout/src/lib/drop.spec.ts`
- [X] T049 [P] [US4] Vitest: Save orchestration pending direct-seed creates/deletes (document in unit tests of draft helpers) in `apps/web/src/app/gardens/planner-draft.service.spec.ts`
- [X] T050 [P] [US4] Playwright: place/restore/direct-seed/remove, miss-bed shows **Drop missed a bed**, Save 422 leaves stored plan, viewer cannot drag in `apps/web-e2e/src/planner-drag.spec.ts`

### Implementation for User Story 4

- [X] T051 [US4] Extend `applyPlantingDrop` for restore vs refuse-direct-seed-on-tray in `libs/garden-layout/src/lib/drop.ts` and export from `libs/garden-layout/src/index.ts`
- [X] T052 [US4] Bed View standalone page: bed rectangle, marks, tray, Direct seed, Remove from bed, Back to overview, no bed/area geometry controls, no Unplace in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T053 [US4] Pointer Events in Bed View (follow pointer; flags on gesture end) in `apps/web/src/app/gardens/garden-plan-canvas.ts` or a bed-specific canvas helper
- [X] T054 [US4] Direct seed: catalog pick + draft planting (`newDirectSeedIds`) + placement; never in tray in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T055 [US4] Remove from bed: transplant restores to tray on draft; direct seed confirm → `pendingDirectSeedDeletes`; drop direct seed on tray does not delete; miss-bed sets status / `aria-live` **Drop missed a bed** in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T056 [US4] Save from Overview or Bed View: evaluate → POST beds → POST direct seeds → PUT layout → DELETE pending direct seeds; on PUT failure compensating DELETE of **new beds and new direct-seed plantings** in `apps/web/src/app/gardens/planner-draft.service.ts`
- [X] T057 [US4] Leave planner / reload discards layout draft; Transplant View records remain; other members see last save in `apps/web/src/app/gardens/planner-draft.service.ts`
- [X] T058 [US4] Viewer Bed View read-only (tray visible, no drag/direct-seed/remove) in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T059 [US4] Touch and pointer share the same drop outcomes (Pointer Events already); assert in `apps/web-e2e/src/planner-drag.spec.ts`
- [X] T080 [P] [US4] Show “removed from catalog” cue on Bed View planting names in `apps/web/src/app/gardens/garden-bed-view.page.ts`

**Checkpoint**: P1 complete: map, geometry, indoor starts, in-bed planting.

---

## Phase 7: User Story 5 - Plan by Looking at the Garden (Priority: P2)

**Goal**: Restrained diagram: named rectangles, distinct areas, readable marks in Bed View, tray labels, 12-inch grid in the bed, no cartoon art.

**Independent Test**: Identify beds/areas by name on Overview; read name/count labels; Bed View planting names; tray lists only future plantings; no cartoon vegetables.

### Tests for User Story 5 (REQUIRED)

- [X] T060 [P] [US5] Vitest: footprint radius `ceil(s/2)` vs unknown 6 in (not passed to evaluate) in `libs/garden-layout/src/lib/footprint.spec.ts`
- [X] T061 [P] [US5] Playwright: names, grid, distinct areas, no planting marks on Overview in `apps/web-e2e/src/planner-diagram.spec.ts`

### Implementation for User Story 5

- [X] T062 [US5] Light 12-inch grid inside the bed in Bed View only in `apps/web/src/app/gardens/garden-plan-canvas.ts` and `apps/web/src/styles.css`
- [X] T063 [US5] Area vs bed visual distinction and restrained colors (names primary) in `apps/web/src/app/gardens/garden-plan-canvas.ts`
- [X] T064 [US5] Tray item labels = planting names; Overview must not present tray drop onto the map in `apps/web/src/app/gardens/planting-tray.ts` and `apps/web/src/app/gardens/garden-layout.page.ts`

**Checkpoint**: Visual language matches FR-009.

---

## Phase 8: User Story 6 - The Plan Stays Responsive (Priority: P2)

**Goal**: Pan/zoom via transform; object-drag vs pan; `evaluateLayout` on gesture end; 10×50 garden usable.

**Independent Test**: On 10 beds / 50 plantings: Overview ready quickly; empty-space pan; zoom; bed drag; Bed View planting drag stays under pointer (manual for sub-frame; Playwright for pan vs move).

### Tests for User Story 6 (REQUIRED)

- [X] T065 [P] [US6] Vitest: client→plan inches with pan/scale in `libs/garden-layout/src/lib/plan-coords.spec.ts`
- [X] T066 [P] [US6] Playwright: empty-space pan vs bed move; **Zoom in**/pinch changes scale; viewer can pan/zoom but cannot move beds in `apps/web-e2e/src/planner-pan.spec.ts`

### Implementation for User Story 6

- [X] T067 [US6] Apply pan/zoom as CSS/SVG transform (not per-move viewBox rewrite); keep **Zoom in** / **Zoom out** and pinch in `apps/web/src/app/gardens/garden-plan-canvas.ts`
- [X] T068 [US6] Call `evaluateLayout` only on gesture end and before Save in `apps/web/src/app/gardens/planner-draft.service.ts`
- [X] T069 [US6] Confirm `specs/008-garden-planner-ux/quickstart.md` 10×50 fixture and the **manual 3-second** Overview-ready gate (not a Playwright timing assertion)
- [X] T070 [US6] Offline: last GET readable; mutations online-required within 5s in `apps/web-e2e/src/layout-offline.spec.ts` (extend for Overview/Bed/Transplant)
- [X] T081 [US6] Membership-loss stale cache: on reconnect GET 404/403 and UI MUST NOT Save or mutate in `apps/web-e2e/src/layout-offline.spec.ts` (same pattern as existing garden/layout cache)

**Checkpoint**: Performance and pan/zoom meet FR-010 / FR-011.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: AuthZ, docs, coverage, security, older layout e2e

- [X] T071 [P] Confirm ADR `docs/adr/0010-two-view-planner.md` matches shipped routes and Save pipeline
- [X] T072 [P] Update README planner section if it still describes a single form-heavy layout in `README.md`
- [X] T073 Align older layout e2e (`apps/web-e2e/src/layout-beds.spec.ts`, `apps/web-e2e/src/layout-place.spec.ts`) with two-view + planting tray = transplants
- [X] T074 Confirm garden reminders GET still has no indoor-only items in `apps/web-e2e/src/reminders-list.spec.ts`
- [X] T075 Confirm Vitest coverage ≥80% for `libs/garden-layout`, `libs/seasonal-plantings`, `libs/care-reminders`, touched web files
- [X] T076 Security: validate area geometry and start-method enums in `libs/shared-types/src/lib/layout.schemas.ts` and `libs/shared-types/src/lib/planting.schemas.ts`; reuse `apps/api/src/gardens/garden-membership.guard.ts`
- [X] T077 Run `specs/008-garden-planner-ux/quickstart.md` locally (migrate 0008, Overview, Transplant, Bed View, offline)
- [X] T078 YAGNI pass against `specs/008-garden-planner-ux/plan.md`: no snap-to-grid, no area rotate, no `libs/garden-planner`, no cartoon assets

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1–US6**: Depend on Foundational. Preferred order: US1 → US2 → US3 → US4 (P1), then US5 → US6 (P2)
- **Polish**: After stories intended for the release

### User Story Dependencies

- **US1 (P1)**: After Foundational — Overview read
- **US2 (P1)**: After US1 (same canvas; adds gestures). Independently testable as geometry editor
- **US3 (P1)**: After Foundational; can parallel US1/US2 (different page). Tray needed before US4 place-from-tray
- **US4 (P1)**: After US2 (navigation) and US3 (tray contents). Core planting editor
- **US5 (P2)**: After US1–US4 visuals exist
- **US6 (P2)**: After US2/US4 gestures exist

### Within Each User Story

- Vitest alongside lib changes; Playwright when UI + API work
- Shared contracts / lib before Nest before Angular
- Story complete (tests + AuthZ) before calling it done

### Parallel Opportunities

- T001–T002; T015–T017; T023–T026; T037–T039; T048–T050; T060–T061; T065–T066; T071–T072
- After Foundational: US1 Overview and US3 Transplant View can proceed in parallel
- US5 visual CSS and US6 transform work can overlap once canvases exist

---

## Parallel Example: User Story 1

```bash
# After T014 (foundation):
Task: "Vitest overview labels in libs/garden-layout/src/lib/overview-labels.spec.ts"
Task: "Vitest drawableBeds excludes geometry-null in libs/garden-layout/src/lib/drawable-beds.spec.ts"
Task: "Implement overviewPlantingLabels in libs/garden-layout/src/lib/overview-labels.ts"
```

## Parallel Example: After Foundational

```bash
# Developer A — Overview (US1/US2)
Task: "Garden Overview canvas in apps/web/src/app/gardens/garden-layout.page.ts"

# Developer B — Transplants (US3)
Task: "deriveIndoorReminders + Transplant View page"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 US1 — readable Overview
4. **STOP and VALIDATE** Independent Test for US1

### Incremental Delivery

1. Setup + Foundational
2. US1 Overview map (MVP)
3. US2 arrange beds/areas
4. US3 Transplant View + tray
5. US4 Bed View plantings (full P1)
6. US5 diagram polish
7. US6 pan/zoom/performance
8. Polish + quickstart

### Parallel Team Strategy

1. Together: Setup + Foundational
2. Then: A → US1/US2, B → US3, then both → US4, then US5/US6

---

## Notes

- [P] = different files, no incomplete-task dependencies
- Commit after each task or logical group
- Do not add `libs/garden-planner` or NgModules
- Indoor reminders stay off the garden reminders GET
- Suggested MVP: **US1 only** (see the map). Suggested P1 slice: US1–US4
