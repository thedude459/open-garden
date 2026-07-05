---
description: "Task list for Visual Garden Planner Experience feature implementation"
---

# Tasks: Visual Garden Planner Experience

**Input**: Design documents from `/specs/003-visual-planner-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks grouped by user story for independent implementation and testing.

**Note**: Feature 002 (Garden Layout) MUST be substantially complete before starting.
This task list extends the existing Next.js monolith with visual planner UI, illustration
assets, zone types, structures, and templates — no greenfield setup.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US5)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Planner module scaffolding, asset directories, and design tokens

- [X] T001 Create lib/planner/types.ts with VisualGardenDetail, GardenStructure, IllustrationRef, CanvasLayerItem types per specs/003-visual-planner-ui/data-model.md
- [X] T002 [P] Create public/planner/ directory tree (plants/, structures/, categories/, templates/, thumbnails/) per specs/003-visual-planner-ui/contracts/illustration-assets.md
- [X] T003 [P] Add planner CSS design tokens (--planner-toolbar-bg, --planner-canvas-bg, etc.) in app/globals.css per specs/003-visual-planner-ui/contracts/planner-ui.md
- [X] T004 [P] Add public/planner/thumbnails/ to .gitignore and document ATTRIBUTION.md placeholder in public/planner/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, illustration resolver, auto-upgrade migration, extended garden types — MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Define Drizzle schema for garden_zone_type enum; extend gardens with zone_type, thumbnail_key, visual_version in lib/db/schema/gardens.ts per data-model.md
- [X] T006 Define plant_illustrations, illustration_category_defaults, structure_types, garden_structures, plan_templates in lib/db/schema/planner.ts per data-model.md
- [X] T007 Extend plant_placements with rootstock_id, z_index, locked in lib/db/schema/gardens.ts; export planner schema from lib/db/schema/index.ts and generate migration in lib/db/migrations/
- [X] T008 [P] Implement resolvePlantIllustration and resolveStructureIllustration with category fallbacks (never empty URL) in lib/planner/illustrations.ts per contracts/illustration-assets.md
- [X] T009 [P] Implement z-order sort and layer batch helpers in lib/planner/layers.ts
- [X] T010 [P] Implement auto-upgrade projection for visual_version=0 gardens in lib/planner/migration.ts per research.md §6 and FR-013
- [X] T011 Extend lib/garden/types.ts and lib/garden/enums.ts with zone_type, structures[], illustration_url, z_index, locked on placements
- [X] T012 Extend Zod schemas with zone_type, structure bodies, layer patch, thumbnail POST in lib/garden/schemas.ts per specs/003-visual-planner-ui/contracts/planner-api.md
- [X] T013 Extend getGardenDetail and listGardens to resolve illustration URLs and include structures in lib/garden/service.ts
- [X] T014 Create scripts/seed-planner-assets.ts seeding category defaults, structure_types (~30), plan_templates (6), and top-200 plant_illustrations mappings
- [X] T015 [P] Add category fallback SVG assets in public/planner/categories/ (vegetable, herb, fruit, tree, flower, default)
- [X] T016 [P] Add launch structure SVG assets in public/planner/structures/ (greenhouse, raised_bed, terracotta_pot, trellis, path, etc.)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Visual Layout Planning with Plant Images (Priority: P1) 🎯 MVP

**Goal**: Illustrated plant picker, drag-and-drop canvas, visual spacing footprints; auto-upgrade existing gardens on open

**Independent Test**: Create plan with two beds, drag three illustrated plants onto canvas, reposition one, confirm layout readable without detail panels; canvas pan/zoom via VisualCanvas (toolbar +/- in US5); open pre-visual garden and see default illustrations

### Implementation for User Story 1

- [X] T017 [P] [US1] Create PlantSprite with SVG image, footprint circle, and selection halo in components/planner/sprites/PlantSprite.tsx
- [X] T018 [P] [US1] Create VisualCanvas with proportional scaling, sprite layer, and CSS zoom/pan transform in components/planner/VisualCanvas.tsx (reuse layoutScale from components/garden/LayoutCanvas.tsx; canvas-level pan/zoom; toolbar buttons wired in T051)
- [X] T019 [P] [US1] Create PlantLibrary with illustrated catalog grid and drag source in components/planner/PlantLibrary.tsx
- [X] T020 [US1] Implement pointer-driven drag-and-drop plant placement and reposition on VisualCanvas preserving lib/garden/validation.ts checks
- [X] T021 [US1] Add visual drop feedback (valid/invalid tint, spacing violation ring) in components/planner/VisualCanvas.tsx and components/garden/ValidationFeedback.tsx
- [X] T022 [US1] Implement GET /api/planner/plants/[plantId]/illustration in app/api/planner/plants/[plantId]/illustration/route.ts
- [X] T023 [US1] Create PlannerShell scaffold (library + canvas + ValidationFeedback slot) in components/planner/PlannerShell.tsx
- [X] T023a [US1] Integrate AreaEditor bed/path draw, resize, and delete into PlannerShell (port from components/garden/AreaEditor.tsx)
- [X] T023b [US1] Integrate IndoorStartsPanel (create, cancel, reassign, transplant) into PlannerShell left panel
- [X] T023c [US1] Integrate GardenSettingsPanel and ConflictDialog into PlannerShell toolbar/settings flow
- [X] T023d [US1] Create PropertyPanel stub (selection, dates, climate warnings, validation display) in components/planner/PropertyPanel.tsx; wire PlantLibrary placement flow (replaces PlantPlacementPanel split)
- [X] T024 [US1] Switch app/(garden)/gardens/[gardenId]/page.tsx to PlannerShell only after T023a–T023d pass quickstart §002 Feature Parity; wire auto-upgrade on load via lib/planner/migration.ts
- [X] T025 [US1] Extend illustrated bed/path rendering in VisualCanvas (retain AreaLayer styling or bed sprites) replacing wireframe-only LayoutCanvas usage
- [X] T026 [P] [US1] Add unit tests for illustration resolver fallbacks in tests/unit/planner-illustrations.test.ts
- [X] T027 [P] [US1] Add unit tests for garden-coordinate drag projection in tests/unit/planner-canvas.test.ts

**Checkpoint**: User Story 1 fully functional — illustrated drag-and-drop planting, 002 workflow parity, auto-upgrade (T024 gated on quickstart §002 Feature Parity)

---

## Phase 4: User Story 2 — Plan Different Growing-Area Types (Priority: P2)

**Goal**: vegetable_garden, orchard, container_patio zone types; orchard canopy hard-block validation; zone-specific library filters

**Independent Test**: Create one plan per zone type; orchard tree spacing blocks invalid placement; garden list shows zone_type badge (thumbnail preview verified in US5 checkpoint)

### Implementation for User Story 2

- [X] T028 [US2] Extend createGarden and updateGarden with zone_type and zone-change conflict handling in lib/garden/service.ts
- [X] T029 [US2] Extend POST and PATCH /api/gardens with zone_type and zone_change_conflicts 422 in app/api/gardens/route.ts and app/api/gardens/[gardenId]/route.ts
- [X] T030 [US2] Implement orchard tree canopy spacing and rootstock hard-block validation in lib/garden/validation.ts using lib/catalog/query.ts rootstocks per FR-014
- [X] T031 [US2] Extend createDirectSeed and validatePlacementDryRun to accept rootstock_id and apply orchard rules when zone_type is orchard in lib/garden/service.ts
- [X] T031a [US2] Implement getOrchardAdvisories(plantId, rootstockId?) in lib/garden/orchard-advisories.ts using lib/catalog/query.ts companions and guild-category catalog filter per FR-014a
- [X] T031b [US2] Surface orchard companion/understory suggestions in ValidationFeedback and PropertyPanel when orchard tree selected or placed
- [X] T031c [P] [US2] Add unit tests for orchard advisory resolution in tests/unit/garden-orchard-advisories.test.ts
- [X] T032 [US2] Extend PlantSprite canopy radius from rootstock spacing for orchard placements in components/planner/sprites/PlantSprite.tsx
- [X] T033 [P] [US2] Extend PropertyPanel with rootstock selector and orchard canopy details when zone_type is orchard (depends on T023d)
- [X] T034 [US2] Filter PlantLibrary and structure lists by zone_type in components/planner/PlantLibrary.tsx
- [X] T035 [US2] Add zone_type selector to GardenForm and zone badge to GardenList/GardenCard in components/garden/GardenForm.tsx and components/garden/GardenCard.tsx (zone badge only; T054 adds thumbnail display)
- [X] T037 [P] [US2] Add unit tests for orchard tree spacing hard blocks in tests/unit/garden-orchard-validation.test.ts

**Checkpoint**: User Stories 1 AND 2 work — three zone types with orchard validation

---

## Phase 5: User Story 3 — Structures and Objects with Visual Library (Priority: P3)

**Goal**: Structure library, canvas placement, z-index layering, lock/unlock

**Independent Test**: Add greenhouse, trellis, path; reorder layers; lock item prevents drag

### Implementation for User Story 3

- [X] T036 [US3] Seed container_patio structure types (pots, planters) in scripts/seed-planner-assets.ts (depends on T014)
- [X] T038 [US3] Implement createStructure, updateStructure, deleteStructure, and batchLayerUpdate in lib/garden/service.ts
- [X] T039 [US3] Implement POST/PUT/DELETE /api/gardens/[gardenId]/structures routes and PATCH /api/gardens/[gardenId]/layers per specs/003-visual-planner-ui/contracts/planner-api.md
- [X] T040 [US3] Implement GET /api/planner/structures with zone_type filter in app/api/planner/structures/route.ts
- [X] T041 [P] [US3] Create StructureSprite with illustration and resize handles in components/planner/sprites/StructureSprite.tsx
- [X] T042 [P] [US3] Create StructureLibrary with category groups and preview images in components/planner/StructureLibrary.tsx
- [X] T043 [P] [US3] Create LayerPanel with send back/forward and lock toggle in components/planner/LayerPanel.tsx
- [X] T044 [US3] Integrate structure drag-place, move, and layer rendering into components/planner/VisualCanvas.tsx and components/planner/PlannerShell.tsx

**Checkpoint**: User Stories 1–3 work — full illustrated layout with structures and layers

---

## Phase 6: User Story 4 — Start from Visual Templates (Priority: P4)

**Goal**: Template gallery with 6 starter layouts (2 per zone type); instantiate on garden create

**Independent Test**: Select Beginner Vegetable template; canvas loads illustrated layout; modify and save (thumbnail verified in US5 checkpoint)

### Implementation for User Story 4

- [X] T045 [US4] Implement instantiateFromTemplate and listTemplates in lib/planner/templates.ts and lib/garden/service.ts
- [X] T046 [US4] Implement GET /api/planner/templates in app/api/planner/templates/route.ts
- [X] T047 [US4] Extend POST /api/gardens to accept template_id and instantiate layout snapshot in app/api/gardens/route.ts
- [X] T048 [P] [US4] Create TemplateGallery with preview cards in components/planner/TemplateGallery.tsx
- [X] T049 [US4] Integrate template selection into app/(garden)/gardens/new/page.tsx and components/garden/GardenForm.tsx
- [X] T049a [US4] Show zone-specific empty-state hint on blank canvas in PlannerShell when no areas/placements exist (e.g., "Add beds or choose a template")
- [X] T050 [P] [US4] Add template preview WebP assets in public/planner/templates/ and seed 6 plan_templates rows in scripts/seed-planner-assets.ts

**Checkpoint**: User Stories 1–4 work — templates accelerate new plan creation

---

## Phase 7: User Story 5 — Polished Planner Chrome and Plan Overview (Priority: P5)

**Goal**: Full planner toolbar/panels, thumbnails on save, mobile view+light-edits mode

**Independent Test**: 15-minute planning session with zoom/pan; phone viewport allows view, date edit, delete but not drag

### Implementation for User Story 5

- [X] T051 [US5] Complete PlannerShell with toolbar (zoom +/-, save, plan name, zone badge) and three-panel layout in components/planner/PlannerShell.tsx per contracts/planner-ui.md (toolbar zoom +/- wired to VisualCanvas transform from T018)
- [X] T052 [P] [US5] Complete PropertyPanel: structure details, delete action, mobile bottom-sheet variant, keyboard focus per contracts/planner-ui.md
- [X] T053 [US5] Implement client thumbnail capture and POST handler in lib/planner/thumbnail.ts and app/api/gardens/[gardenId]/thumbnail/route.ts
- [X] T054 [US5] Extend GardenList/GardenCard with thumbnail_url display and save-triggered capture (builds on T035 zone badge)
- [X] T055 [US5] Create MobilePlannerView with read-only canvas pan and bottom-sheet light edits in components/planner/MobilePlannerView.tsx per FR-017
- [X] T056 [US5] Add usePlannerViewport hook (768px breakpoint) disabling drag in components/planner/usePlannerViewport.ts and PlannerShell.tsx
- [X] T056a [US5] Add aria-labels to PlantSprite and StructureSprite; expose selected item name to screen readers
- [X] T056b [US5] Implement keyboard navigation in PlannerShell (Tab between panels, Enter select, Escape deselect) per contracts/planner-ui.md
- [X] T056c [US5] Respect prefers-reduced-motion for drop shake and invalid-drop animations in VisualCanvas
- [X] T057 [US5] Apply planner theming polish (earthy palette, panel chrome) across components/planner/ and retire wireframe-only styles from components/garden/LayoutEditor.tsx

**Checkpoint**: All five user stories independently functional with polished chrome; US5 satisfies FR-009 and moved US2 thumbnail scenario

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Tests, rotation compatibility, performance, documentation

- [X] T058 [P] Add unit tests for layer sort and auto-upgrade migration in tests/unit/planner-layers.test.ts and tests/unit/planner-migration.test.ts
- [X] T059 [P] Add E2E visual planner flows (drag plant, template, mobile view) in tests/e2e/visual-planner.spec.ts per specs/003-visual-planner-ui/quickstart.md
- [X] T060 Add E2E auto-upgrade test for pre-visual garden opening with illustrations in tests/e2e/visual-planner-upgrade.spec.ts
- [X] T061 [P] Render rotated plant/structure sprites when garden_areas.rotation_degrees ≠ 0 in PlantSprite.tsx and StructureSprite.tsx. **Prerequisite:** 002 US6 `rotation_degrees` column must exist; OBB validation need not be complete—visual-only rotation acceptable. If rotation_degrees is always 0, render unrotated (no-op).
- [X] T062 Add npm run bench:planner-canvas targeting SC-003a (<100ms p95 drag latency with 50 sprites) in scripts/bench-planner-canvas.ts
- [X] T063 Run quickstart.md manual validation checklist (including a11y §8 and Visual Polish Checklist) and fix gaps
- [X] T064 [P] Update README.md with visual planner overview and seed-planner-assets command

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on US1 (VisualCanvas + placement flow)
- **US3 (Phase 5)**: Depends on US1 (VisualCanvas); parallel with US2 after US1
- **US4 (Phase 6)**: Depends on Foundational + US2 zone_type (templates per type)
- **US5 (Phase 7)**: Depends on US1–US4 (full planner to polish)
- **Polish (Phase 8)**: Depends on US5 completion

### User Story Dependencies

| Story | Depends on | Independent test |
|-------|------------|------------------|
| US1 P1 | Phase 2 | Illustrated drag-drop + auto-upgrade |
| US2 P2 | US1 | Three zone types + orchard hard blocks + advisories |
| US3 P3 | US1 | Structures + layers |
| US4 P4 | Phase 2, US2 | Template gallery instantiate |
| US5 P5 | US1–US4 | Chrome, thumbnails, mobile |

### Within Each User Story

- Schema/service before API routes
- API before UI components that consume them
- Sprites before VisualCanvas integration
- US3: T036 after T014 seed script; before T038 service methods
- Story checkpoint before next priority

### External Dependencies

- **T061 ↔ 002 US6**: Sprite rotation requires `garden_areas.rotation_degrees` schema
  field from Feature 002. Coordinate timing or skip visual rotation until field is populated.

### Parallel Opportunities

- Phase 1: T002, T003, T004 parallel
- Phase 2: T008–T010, T015, T016 parallel after T007
- US1: T017–T019, T026–T027 parallel
- US2: T031c, T033, T037 parallel (T033 depends on T023d)
- US3: T041–T043 parallel
- US4: T048, T049a, T050 parallel
- US5: T052, T056a–T056c parallel with T051
- Polish: T058–T059, T061–T062, T064 parallel

---

## Parallel Example: User Story 1

```bash
# After T016 completes:
Task: "Create PlantSprite in components/planner/sprites/PlantSprite.tsx"
Task: "Create VisualCanvas in components/planner/VisualCanvas.tsx"
Task: "Create PlantLibrary in components/planner/PlantLibrary.tsx"
```

---

## Parallel Example: User Story 3

```bash
# After T040 completes:
Task: "Create StructureSprite in components/planner/sprites/StructureSprite.tsx"
Task: "Create StructureLibrary in components/planner/StructureLibrary.tsx"
Task: "Create LayerPanel in components/planner/LayerPanel.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 → Phase 2 → Phase 3 (T001–T027, including T023a–T023d before T024 page swap)
2. **STOP and VALIDATE**: Illustrated drag-drop; 002 feature parity checklist; open legacy garden with auto-upgrade

### Incremental Delivery

1. US1 → illustrated visual planner MVP
2. US2 → zone types + orchard validation
3. US3 → structures + layers
4. US4 → template gallery
5. US5 → polished chrome + mobile + thumbnails
6. Phase 8 → E2E + perf + docs

### Suggested MVP Scope

**User Story 1 only** (T001–T027, including T023a–T023d; T024 gated on 002 parity checklist).

---

## Notes

- All placement validation MUST reuse lib/garden/validation.ts and lib/catalog/query.ts (Principle I/II)
- Illustrations: curated only; resolvePlantIllustration MUST never return empty (SC-004)
- Auto-upgrade on open: no legacy editor fork (FR-013); visual_version bumped on first save
- Phone (<768px): view + light edits only; no drag-and-drop (FR-017)
- Orchard: hard-block tree spacing when catalog data exists; advisory companion/guild suggestions via T031a–T031b (FR-014, FR-014a)
- Structures: garden_structures table separate from garden_areas beds/paths
- Thumbnails: client capture POST to /api/gardens/:id/thumbnail on save
- Feature 002 rotation_degrees: T061 renders rotated sprites when field populated (see External Dependencies)
- Every mutating API call MUST use expected_version (inherits FR-020 from 002)
- Run npm run seed:planner-assets after T014 before manual testing
- Run npm run db:migrate after T007 before implementation
