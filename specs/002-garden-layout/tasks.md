---
description: "Task list for Garden Layout & Planting feature implementation"
---

# Tasks: Garden Layout & Planting

**Input**: Design documents from `/specs/002-garden-layout/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks grouped by user story for independent implementation and testing.

**Note**: Feature 001 (Plant Database) is already implemented. This task list extends the existing Next.js monolith — no greenfield project setup required.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US6)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Garden module scaffolding and route protection

- [X] T001 Create lib/garden/types.ts and lib/garden/enums.ts with GardenDetail, GardenArea, PlantPlacement, IndoorStart, ValidationResult types; USDA 12-value soil_type enum (SOIL_TYPE_GROUPS, SOIL_CANVAS_ABBREV) and bed_sun_exposure enum (SUN_CANVAS_ABBREV) per specs/002-garden-layout/data-model.md
- [X] T002 [P] Extend middleware.ts to protect /gardens routes and /api/gardens API (401 JSON / redirect to login) per FR-019; update matcher config for `/gardens/:path*` and `/api/gardens/:path*`
- [X] T003 [P] Create auth-gated garden layout shell in app/(garden)/layout.tsx with navigation to catalog and gardens

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, geometry, versioning, and garden service layer — MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Define Drizzle schema for gardens, garden_areas (rotation_degrees default 0, nullable soil_type and sun_exposure), plant_placements, indoor_starts, and bed_planting_history with all enums in lib/db/schema/gardens.ts per specs/002-garden-layout/data-model.md
- [X] T005 Export gardens schema from lib/db/schema/index.ts and generate migration in lib/db/migrations/
- [X] T006 [P] Implement AABB and OBB geometry helpers (isWithinBounds, areasOverlap, isPointInBed, getRotatedCorners, obbOverlaps) in lib/garden/geometry.ts per research.md §3 and §10
- [X] T007 [P] Implement spacing unit conversion and radius resolver (cm → feet/meters) in lib/garden/spacing.ts
- [X] T008 [P] Implement optimistic concurrency helpers (checkVersion, bumpVersion, ConflictError) in lib/garden/version.ts
- [X] T009 Implement base garden service (getGardenDetail, assertGardenOwner, withGardenTransaction) in lib/garden/service.ts
- [X] T010 Define Zod request/response schemas for garden API bodies in lib/garden/schemas.ts per specs/002-garden-layout/contracts/garden-api.md — include nullable 12-value soil_type and sun_exposure enums; rotation_degrees validation (0 only until US6 enables rotation)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Create a Garden with Dimensions (Priority: P1) 🎯 MVP

**Goal**: Signed-in users create gardens with name, length, width, and measurement unit

**Independent Test**: Sign in, create a 30×20 ft garden named "Backyard", verify it appears in garden list with correct dimensions; unauthenticated users blocked

### Implementation for User Story 1

- [X] T011 [US1] Implement listGardens and createGarden with dimension validation (> 0) in lib/garden/service.ts
- [X] T012 [US1] Implement GET (list) and POST /api/gardens in app/api/gardens/route.ts per specs/002-garden-layout/contracts/garden-api.md; validate bodies with lib/garden/schemas.ts
- [X] T013 [US1] Implement GET /api/gardens/[gardenId] (read-only GardenDetail) in app/api/gardens/[gardenId]/route.ts per garden-api contract — required before US2 layout editor
- [X] T014 [P] [US1] Create GardenForm component with name, length, width, unit fields in components/garden/GardenForm.tsx
- [X] T015 [P] [US1] Create GardenList component showing garden summaries in components/garden/GardenList.tsx
- [X] T016 [US1] Implement garden list page in app/(garden)/gardens/page.tsx and create page in app/(garden)/gardens/new/page.tsx
- [X] T017 [US1] Add "Gardens" navigation link in app/(catalog)/layout.tsx and app/(garden)/layout.tsx
- [X] T018 [US1] Add read-only garden list/detail IndexedDB cache stub (load only; full sync in Phase 9) in lib/offline/garden-cache-types.ts

**Checkpoint**: User Story 1 fully functional — create and list gardens independently

---

## Phase 4: User Story 2 — Define Plantable Beds and Non-Plantable Paths (Priority: P2)

**Goal**: Axis-aligned beds and paths with overlap/boundary validation; optional USDA soil and sun exposure; abbreviated canvas labels when set; no rotation UI (US6)

**Independent Test**: Add bed + path; verify soil/sun canvas labels when set; clear to unset removes labels; rotation control absent; overlap/boundary blocked; API rejects non-zero rotation_degrees with 422

### Implementation for User Story 2

- [X] T019 [US2] Implement validateAreaGeometry (AABB boundary + overlap only) in lib/garden/validation.ts — OBB extension in US6 T048
- [X] T020 [US2] Implement createArea, updateArea, deleteArea with version bump, soil/sun null-clear, and reject non-zero rotation_degrees (422) in lib/garden/service.ts
- [X] T021 [US2] Implement POST /api/gardens/[gardenId]/areas and PUT/DELETE /areas/[areaId] in app/api/gardens/[gardenId]/areas/route.ts and app/api/gardens/[gardenId]/areas/[areaId]/route.ts per garden-api contract; validate enums and rotation guard with lib/garden/schemas.ts
- [X] T022 [P] [US2] Create LayoutCanvas SVG shell with proportional scaling in components/garden/LayoutCanvas.tsx
- [X] T023 [P] [US2] Create AreaLayer (bed/path rendering, abbreviated soil and sun canvas labels via SOIL_CANVAS_ABBREV and SUN_CANVAS_ABBREV; SC-006: distinct bed vs path fill/stroke styling) and AreaEditor (create-only: draw rectangles, grouped USDA soil selector, flat sun selector, clear-to-unset; no rotate control) in components/garden/AreaLayer.tsx and components/garden/AreaEditor.tsx
- [X] T024 [US2] Implement layout editor page in app/(garden)/gardens/[gardenId]/page.tsx with bed/path creation (read-only existing areas; edit mode deferred to US4)

**Checkpoint**: User Stories 1 AND 2 work independently — axis-aligned layout with soil/sun metadata

---

## Phase 5: User Story 3 — Place Plants with Spacing and Compatibility Validation (Priority: P3)

**Goal**: Garden-wide spacing/incompatibility hard blocks; bed planting history on direct seed; validate-placement dry-run with violations[]; soil/sun ignored for validation

**Independent Test**: Place tomato → history row created; spacing/incompatibility blocked in preview and save; validate-placement returns violations[]; placement succeeds regardless of bed soil/sun

### Implementation for User Story 3

- [X] T025 [US3] Implement garden-wide spacing and incompatibility validation using lib/catalog/query.ts in lib/garden/validation.ts per specs/002-garden-layout/research.md
- [X] T026 [US3] Implement resolvePlantSpacing for canonical and provisional plants in lib/garden/spacing.ts
- [X] T027 [US3] Implement createDirectSeed (append bed_planting_history; FR-014: record planting_method, planted_on; rotation_group nullable until T046 catalog seed — warnings skip when identity unknown), deletePlacement (retain history), and user_garden_plant_refs auto-upsert in lib/garden/service.ts per FR-022
- [X] T028 [US3] Implement POST /api/gardens/[gardenId]/placements and POST /api/gardens/[gardenId]/validate-placement (violations[] hard blocks; warnings[] empty until US5/US6) in app/api/gardens/[gardenId]/placements/route.ts and app/api/gardens/[gardenId]/validate-placement/route.ts per FR-017a
- [X] T029 [US3] Implement DELETE /api/gardens/[gardenId]/placements/[placementId] in app/api/gardens/[gardenId]/placements/[placementId]/route.ts with expected_version and version bump
- [X] T030 [US3] Add remove-plant action in components/garden/PlantPlacementPanel.tsx and app/(garden)/gardens/[gardenId]/page.tsx
- [X] T031 [P] [US3] Create PlacementLayer showing plant footprints (spacing radius circles) in components/garden/PlacementLayer.tsx
- [X] T032 [P] [US3] Create ValidationFeedback component for spacing/incompatibility violations[] in components/garden/ValidationFeedback.tsx
- [X] T033 [US3] Create PlantPlacementPanel with catalog plant picker in components/garden/PlantPlacementPanel.tsx
- [X] T034 [US3] Integrate click-to-place flow with live validate-placement preview (violations only) into app/(garden)/gardens/[gardenId]/page.tsx

**Checkpoint**: User Story 3 fully functional — validated planting with history accumulation

---

## Phase 6: User Story 4 — Edit Garden and Bed Layout via UI (Priority: P4)

**Goal**: Edit garden metadata and axis-aligned areas; change/clear soil and sun; stale-version conflicts; placement eviction on shrink

**Independent Test**: Rename garden, resize bed, clear soil/sun labels; two-tab 409 conflict; shrink garden until conflict list; delete garden with confirmation

### Implementation for User Story 4

- [X] T035 [US4] Implement layout shrink conflict detection (affectedPlacementIds) in lib/garden/validation.ts
- [X] T036 [US4] Extend updateGarden, updateArea, deleteArea with placement eviction checks, FR-012 resolution, and rotation_degrees=0 guard in lib/garden/service.ts
- [X] T037 [US4] Extend app/api/gardens/[gardenId]/route.ts with PUT and DELETE (409 Conflict) — GET in T013
- [X] T038 [P] [US4] Create ConflictDialog for stale-version review/discard/overwrite in components/garden/ConflictDialog.tsx
- [X] T039 [US4] Extend AreaEditor for edit mode (resize, reposition, delete, change/clear soil and sun) plus garden metadata edit and delete confirmations in components/garden/AreaEditor.tsx, components/garden/GardenList.tsx, and app/(garden)/gardens/[gardenId]/page.tsx

**Checkpoint**: User Story 4 fully functional — editable layouts with concurrency safeguards

---

## Phase 7: User Story 5 — Start Indoors or Direct Seed into a Bed (Priority: P5)

**Goal**: Indoor start vs direct seed; transplant creates placement + history; climate CLIMATE_DATE warnings in save and validate-placement dry-run

**Independent Test**: Direct seed and transplant both create history; indoor start off bed until transplant; out-of-window date shows warning in preview and save but allows save; reassign after bed delete

### Implementation for User Story 5

- [X] T040 [US5] Implement climate advisory warnings reusing lib/catalog/climate-filter.ts in lib/garden/climate-warnings.ts
- [X] T041 [US5] Implement createIndoorStart, cancelIndoorStart, reassignIndoorStart, and transplantIndoorStart (creates placement + bed_planting_history, marks complete; FR-014: transplant lifecycle status) in lib/garden/service.ts
- [X] T042 [US5] Implement POST /api/gardens/[gardenId]/indoor-starts, PATCH and DELETE /indoor-starts/[startId], and POST transplant in app/api/gardens/[gardenId]/indoor-starts/route.ts, app/api/gardens/[gardenId]/indoor-starts/[startId]/route.ts, and app/api/gardens/[gardenId]/indoor-starts/[startId]/transplant/route.ts; validate with lib/garden/schemas.ts
- [X] T043 [P] [US5] Create IndoorStartsPanel listing active starts with transplant and reassign-target-bed actions in components/garden/IndoorStartsPanel.tsx
- [X] T044 [US5] Extend PlantPlacementPanel with planting method selection (indoor start vs direct seed) and catalog method rules (FR-016) in components/garden/PlantPlacementPanel.tsx
- [X] T045 [US5] Integrate indoor start, transplant, reassign, and climate warning display (validate-placement warnings[] + save) into app/(garden)/gardens/[gardenId]/page.tsx and components/garden/ValidationFeedback.tsx

**Checkpoint**: User Stories 1–5 independently functional — full planting workflow with climate advisories

---

## Phase 8: User Story 6 — Bed Rotation: Geometry and Crop History (Priority: P6)

**Goal**: 90° geometric rotation with OBB validation; crop rotation CROP_ROTATION warnings using history from US3/US5; enable non-zero rotation_degrees in API

**Independent Test**: Rotate bed 90°; OBB overlap/boundary blocked; re-place same rotation group → advisory warning in preview and save; history retained after delete

### Implementation for User Story 6

- [ ] T046 [P] [US6] Extend Feature 001 catalog: botanical_family on canonical_plants, plant_rotation_metadata table, getRotationMetadata() in lib/catalog/query.ts, and seed rotation groups in scripts/seed-reference-data.ts per data-model.md
- [ ] T047 [US6] Implement crop rotation identity resolution and lookback check in lib/garden/rotation.ts per research.md §11
- [ ] T048 [US6] Extend validateAreaGeometry for OBB overlap/boundary when rotation_degrees ≠ 0; remove non-zero rotation API guard in lib/garden/validation.ts and lib/garden/service.ts
- [ ] T049 [US6] Add CROP_ROTATION warnings to validate-placement, createDirectSeed, and transplantIndoorStart responses in lib/garden/service.ts and placement/indoor-start API routes
- [ ] T050 [P] [US6] Add rotate control (90° cycle) and SVG transform for beds/paths in components/garden/AreaEditor.tsx and components/garden/AreaLayer.tsx
- [ ] T051 [P] [US6] Create RotationFeedback component for advisory crop rotation warnings in components/garden/RotationFeedback.tsx
- [ ] T052 [US6] Integrate rotation UI and rotation warnings into layout editor and PlantPlacementPanel in app/(garden)/gardens/[gardenId]/page.tsx and components/garden/PlantPlacementPanel.tsx
- [ ] T053 [P] [US6] Add Vitest unit tests for OBB geometry and crop rotation lookback in tests/unit/garden-geometry.test.ts (OBB/rotation describe blocks only; T054 covers AABB) and tests/unit/garden-rotation.test.ts

**Checkpoint**: User Story 6 fully functional — geometric rotation and crop rotation guidance

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Offline cache, tests, performance validation, and quickstart verification

- [ ] T054 [P] Add Vitest unit tests for AABB geometry helpers in tests/unit/garden-geometry.test.ts (AABB-only describe blocks; T053 covers OBB/rotation)
- [ ] T055 [P] Add Vitest unit tests for spacing and incompatibility validation in tests/unit/garden-validation.test.ts
- [ ] T056 [P] Add Vitest unit tests for USDA soil and sun enum groups and canvas abbreviations in tests/unit/garden-enums.test.ts
- [ ] T057 [P] Add validation preview latency benchmarks in tests/unit/garden-validation.test.ts or scripts/bench-validation.ts; add npm run bench:validation to package.json: (a) SC-002 — validate-placement p95 ≤200ms for ≤100 placements; (b) SC-008 — CROP_ROTATION warning path p95 ≤2s with seeded bed history (50+ prior placements on target bed)
- [ ] T058 Add Playwright E2E test covering create garden → bed with soil/sun labels → plant + history → climate warning preview → transplant → rotate bed → crop rotation warning in tests/e2e/garden-layout.spec.ts
- [ ] T059 Extend cache manifest and bundle routes for garden_ids and GardenDetail snapshots in app/api/users/me/cache/manifest/route.ts and app/api/users/me/cache/bundle/route.ts per specs/002-garden-layout/contracts/offline-garden-cache.md
- [ ] T060 [P] Extend offline types and sync queue for garden mutations in lib/offline/garden-cache-types.ts and lib/offline/garden-sync-queue.ts
- [ ] T061 [P] Extend public/sw.js to serve cached garden detail when offline per offline-garden-cache contract
- [ ] T062 Run full quickstart.md validation checklist and fix any gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Stories (Phase 3–8)**: All depend on Foundational completion
  - Sequential priority: US1 → US2 → US3 → US4 → US5 → US6
  - US1 is independently shippable as MVP
- **Polish (Phase 9)**: Depends on US1–US6 for full release; T059–T061 required before production (offline edge cases)

### User Story Dependencies

| Story | Depends On | Independent Test |
|-------|------------|------------------|
| US1 (P1) | Foundational | Create/list garden |
| US2 (P2) | US1, T013 | Axis-aligned bed/path; soil/sun labels; no rotation |
| US3 (P3) | US2 | Placement validation; history on direct seed; dry-run violations |
| US4 (P4) | US2, US3 | Edit layout; clear soil/sun; 409 conflicts |
| US5 (P5) | US2, US3 | Indoor start/transplant; climate warnings in preview |
| US6 (P6) | US2–US5, T046 | Rotate bed; OBB validation; crop rotation warnings |

### Parallel Opportunities

- **Phase 1**: T002, T003 after T001
- **Phase 2**: T006, T007, T008 after T005; T010 after T001
- **Per story**: [P] UI tasks parallel after service/API tasks for that story
- **Phase 8 (US6)**: T046, T050, T051, T053 parallel after T047–T049
- **Phase 9**: T054, T055, T056, T057, T060, T061 parallel

---

## Parallel Example: User Story 2

```bash
# After T020 completes:
Task: "Create LayoutCanvas in components/garden/LayoutCanvas.tsx"
Task: "Create AreaLayer and AreaEditor in components/garden/AreaLayer.tsx and components/garden/AreaEditor.tsx"
```

---

## Parallel Example: User Story 3

```bash
# After T028 completes:
Task: "Create PlacementLayer in components/garden/PlacementLayer.tsx"
Task: "Create ValidationFeedback in components/garden/ValidationFeedback.tsx"
```

---

## Parallel Example: User Story 6

```bash
# After T049 completes:
Task: "Add rotate control in components/garden/AreaEditor.tsx and components/garden/AreaLayer.tsx"
Task: "Create RotationFeedback in components/garden/RotationFeedback.tsx"
Task: "Add OBB and rotation tests in tests/unit/garden-geometry.test.ts and tests/unit/garden-rotation.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 → Phase 2 → Phase 3 (T001–T018)
2. **STOP and VALIDATE**: Create garden, verify list, auth gate

### Incremental Delivery

1. US1 → garden CRUD (MVP)
2. US2 → axis-aligned beds/paths + soil/sun canvas labels
3. US3 → validated planting + history accumulation
4. US4 → editable layouts + concurrency
5. US5 → indoor start/direct seed + climate preview warnings
6. US6 → geometric rotation + crop rotation warnings
7. Phase 9 → offline cache + E2E + benchmarks

### Release Gate

Phase 9 (T059–T061) required before production release for offline edge cases.

### Suggested MVP Scope

**User Story 1 only** (T001–T018).

---

## Notes

- All validation MUST use lib/catalog/query.ts for spacing, relationships, and rotation metadata (Principle I/II)
- Bed soil and sun are metadata only in v1 — no validation impact (FR-006)
- Canvas labels: SOIL_CANVAS_ABBREV and SUN_CANVAS_ABBREV from lib/garden/enums.ts (FR-018)
- Companion planting hints deferred — no advisory companion UI in v1
- History: append on direct seed (US3 T027) and transplant (US5 T041); retain on delete (FR-022); rotation_group nullable until T046 — US6 warnings skip when identity unknown
- T053/T054: same file (garden-geometry.test.ts), non-overlapping describe blocks — T053 OBB/rotation, T054 AABB
- validate-placement: violations[] US3; +CLIMATE_DATE US5; +CROP_ROTATION US6 (FR-017a)
- rotation_degrees: API rejects non-zero until US6 T048 removes guard
- US2 validateAreaGeometry uses AABB; US6 T048 adds OBB
- Every mutating API call MUST use expected_version (FR-020)
- US2 AreaEditor create-only; US4 extends edit mode
