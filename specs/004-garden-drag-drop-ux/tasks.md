---
description: "Task list for Intuitive Garden Planting Experience feature implementation"
---

# Tasks: Intuitive Garden Planting Experience

**Input**: Design documents from `/specs/004-garden-drag-drop-ux/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks grouped by user story for independent implementation and testing.

**Note**: Features 002 (Garden Layout) and 003 (Visual Planner) MUST be complete before
starting. This task list is a UX polish pass — no database migrations, no new placement
APIs. Extends `PlannerShell`, `VisualCanvas`, and `globals.css` in the existing Next.js
monolith.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US3; mobile tasks tagged [US1] as planting extension)

**Task ID note**: T028 is intentionally placed in Phase 2 (Foundational) for early
ValidationFeedback humanization; US3 phase uses T026, T027, T029, T030 (T028 not repeated).

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Placement mode scaffold, toast infrastructure, semantic design token foundation

- [X] T001 Create PlacementMode types and state transition helpers in lib/planner/placement-mode.ts per specs/004-garden-drag-drop-ux/data-model.md
- [X] T002 [P] Extend lib/planner/types.ts with PlacementModeState, ToastNotification, and ArmedContext types per data-model.md
- [X] T003 [P] Create Toast and ToastProvider components in components/ui/Toast.tsx and components/ui/ToastProvider.tsx per specs/004-garden-drag-drop-ux/contracts/design-system.md
- [X] T004 Wrap app/layout.tsx with ToastProvider and export useToast hook from components/ui/ToastProvider.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Humanized validation messages and shared placement utilities — MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Implement violation and warning message mapper (including BOUNDARY and SPACING templates) in lib/garden/messages.ts per specs/004-garden-drag-drop-ux/research.md §4 and FR-016
- [X] T028 Update ValidationFeedback to use lib/garden/messages.ts and hide raw violation codes in components/garden/ValidationFeedback.tsx per FR-016 (depends on T005)
- [X] T006 [P] Add unit tests for formatViolation and formatWarning in tests/unit/garden-messages.test.ts (depends on T005)
- [X] T007 Add unit tests for placement mode transitions (idle/armed/dragging, Escape cancel) in tests/unit/placement-mode.test.ts (depends on T001)
- [X] T008 Add semantic design token aliases (--color-primary, --color-on-secondary, --color-focus-ring, etc.) to app/globals.css per specs/004-garden-drag-drop-ux/contracts/design-system.md (scaffold only; full contrast pass in US2)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Drag-and-Drop Planting in Beds (Priority: P1) 🎯 MVP

**Goal**: Drag-and-drop and click-to-place planting with auto-save; no coordinate forms; transplant via canvas

**Independent Test**: Open garden with a bed; drag three plants onto bed, reposition one, click-to-place a fourth; confirm auto-save toasts and no X/Y fields — per specs/004-garden-drag-drop-ux/quickstart.md §1–2, §4, §6

### Implementation for User Story 1

- [X] T009 [US1] Refactor PlannerShell to use placement mode state machine replacing ad-hoc pendingPlantId in components/planner/PlannerShell.tsx per specs/004-garden-drag-drop-ux/contracts/planting-interaction.md
- [X] T010 [US1] Implement shared placeAtPoint flow (validate → POST placement → toast → idle) with last_saved_garden snapshot and offline revert in components/planner/PlannerShell.tsx
- [X] T011 [US1] Add onGardenClick handler and armed-mode crosshair cursor to components/planner/VisualCanvas.tsx; wire from PlannerShell when mode is armed
- [X] T012 [US1] Update PlantLibrary to arm plant on click (selected state, onPlantSelect payload) in components/planner/PlantLibrary.tsx
- [X] T013 [US1] Wire drag-and-drop and click-to-place through placeAtPoint; emit success toasts ("{name} added", "Plant moved") via useToast in components/planner/PlannerShell.tsx
- [X] T013a [US1] Verify and preserve spacing footprint during drag (drop_preview) and at rest on placed sprites in components/planner/VisualCanvas.tsx and components/planner/sprites/PlantSprite.tsx per FR-005; fix regressions from placeAtPoint refactor
- [X] T014 [US1] Remove position_x/position_y and structure origin_x/origin_y readouts from components/planner/PropertyPanel.tsx; show plant common name, bed name, spacing circle label, and structure name + size only per FR-012
- [X] T015 [US1] Add armed-plant hint and cancel (Escape) handling with aria-live announcement in components/planner/PlannerShell.tsx and components/planner/PropertyPanel.tsx
- [X] T016 [US1] Replace IndoorStartsPanel transplant coordinate form with canvas arm + click/drop flow in components/garden/IndoorStartsPanel.tsx and components/planner/PlannerShell.tsx per FR-017
- [X] T017 [P] [US1] Add error toast and canvas revert on failed placement POST in components/planner/PlannerShell.tsx per quickstart.md §8

**Checkpoint**: User Story 1 fully functional on desktop/tablet — drag, click-to-place, auto-save, no coordinate UI, transplant via canvas, spacing footprints visible during drag and at rest (FR-005)

---

## Phase 4: User Story 2 — Readable, Professional Application Design (Priority: P2)

**Goal**: WCAG 2.1 AA contrast and cohesive design system across all app screens

**Independent Test**: Visit home, auth, catalog, garden list/new, and garden planner routes; all buttons pass contrast check; planner regions labeled; focus rings visible — per quickstart.md §9

### Implementation for User Story 2

- [X] T018 [US2] Finalize semantic token values with WCAG AA contrast pairs in app/globals.css per specs/004-garden-drag-drop-ux/contracts/design-system.md
- [X] T019 [P] [US2] Update .btn, .btn.secondary, .input, .card, .badge, and focus-visible styles in app/globals.css
- [X] T020 [P] [US2] Fix planner toolbar secondary button contrast in app/globals.css (.planner-toolbar .btn.secondary)
- [X] T021 [P] [US2] Apply design system classes to auth screens in app/(auth)/login/page.tsx and app/(auth)/register/page.tsx
- [X] T022 [P] [US2] Apply design system classes to catalog screens in app/(catalog)/plants/page.tsx, app/(catalog)/plants/[id]/page.tsx, and app/(catalog)/layout.tsx
- [X] T023 [P] [US2] Apply design system classes to garden list and new garden in app/(garden)/gardens/page.tsx, app/(garden)/gardens/new/page.tsx, and app/(garden)/layout.tsx
- [X] T023a [P] [US2] Apply design system and contrast fixes to garden planner page header in app/(garden)/gardens/[gardenId]/page.tsx
- [X] T023b [P] [US2] Apply design tokens to planner chrome (PlannerToolbar, panel headings, tab buttons) in components/planner/PlannerToolbar.tsx, components/planner/PlannerShell.tsx, and app/globals.css (.planner-* rules)
- [X] T023c [US2] Add visible region labels and aria landmarks for plant library, canvas, and details panels in components/planner/PlannerShell.tsx per FR-010 (depends on T023b; e.g., aria-label="Plant library", "Garden canvas", "Item details"; visible headings on desktop panels)
- [X] T024 [US2] Apply design system to home and root layout in app/page.tsx and app/layout.tsx
- [X] T025 [P] [US2] Add automated contrast token audit in tests/unit/design-tokens-contrast.test.ts per SC-003

**Checkpoint**: User Story 2 complete — full-app visual refresh with passing contrast tests; planner page and labeled regions verified

---

## Phase 5: User Story 3 — Clear Guidance and Feedback During Planning (Priority: P3)

**Goal**: Empty-bed hints, drop-target highlighting, and motion-safe invalid-drop feedback (save confirmations delivered in US1 via FR-015)

**Independent Test**: Empty bed shows hint; dragging or armed mode highlights bed; invalid drop shows plant-name message without raw codes — per quickstart.md §3, §5

### Implementation for User Story 3

- [X] T026 [US3] Render empty-bed SVG hint text ("Drag or tap to add plants") in components/planner/VisualCanvas.tsx per FR-013
- [X] T027 [US3] Add bed-drop-target highlight class when dragging or armed over valid bed in components/planner/VisualCanvas.tsx per FR-014
- [X] T029 [US3] Ensure invalid drop shake respects prefers-reduced-motion in components/planner/PlannerShell.tsx and components/planner/VisualCanvas.tsx
- [X] T030 [US3] Add gardening-specific edge-case copy for first-plant and empty-canvas hints in lib/garden/messages.ts (extends T005)

**Checkpoint**: User Story 3 complete — guided planting with discoverable hints and readable feedback

---

## Phase 6: Mobile Click-to-Place (FR-018)

**Goal**: Phone users place plants via select + tap; drag remains desktop/tablet only

**Independent Test**: iPhone viewport — tap plant, tap bed, plant saves; drag disabled — per quickstart.md §7

### Implementation for Mobile Click-to-Place

- [X] T031 [US1] Add collapsible plant library search sheet to components/planner/MobilePlannerView.tsx
- [X] T032 [US1] Wire mobile plant tap to arm placement mode and canvas tap to placeAtPoint in components/planner/MobilePlannerView.tsx and components/planner/PlannerShell.tsx
- [X] T033 [US1] Pass placement mode and onGardenClick to VisualCanvas in mobile layout with dragEnabled={false} in components/planner/MobilePlannerView.tsx
- [X] T034 [P] [US1] Add mobile cancel control and armed-state hint in mobile sheet in components/planner/MobilePlannerView.tsx

**Checkpoint**: Mobile click-to-place works; SC-008 flows testable

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: E2E validation, documentation, and quickstart sign-off

- [X] T035 [P] Add E2E drag-and-drop and click-to-place auto-save tests in tests/e2e/planting-interaction.spec.ts per quickstart.md §1–2
- [X] T036 [P] Add E2E mobile click-to-place test in tests/e2e/mobile-click-place.spec.ts per quickstart.md §7
- [X] T037 [P] Add axe contrast smoke test on core routes in tests/e2e/accessibility-contrast.spec.ts per SC-003
- [ ] T038 Run specs/004-garden-drag-drop-ux/quickstart.md manual checklist and fix any blocking gaps
- [X] T039 [P] Update specs/004-garden-drag-drop-ux/contracts/planting-interaction.md if implementation diverges from planned API wiring
- [X] T040 [P] Add placement save latency assertion (p95 < 500ms over 20 iterations) in tests/e2e/planting-interaction.spec.ts or extend scripts/bench-planner-canvas.ts per plan.md Performance Goals (not an MVP blocker)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — MVP core
- **US2 (Phase 4)**: Depends on Phase 2 — can parallelize with US1 after T008 token scaffold
- **US3 (Phase 5)**: Depends on US1 (T009–T010 placement flow); humanized validation in Foundational (T028)
- **Mobile (Phase 6)**: Depends on US1 placeAtPoint (T010)
- **Polish (Phase 7)**: Depends on US1–US3 and Mobile phases

### User Story Dependencies

| Story | Depends on | Independent test |
|-------|------------|------------------|
| US1 P1 | Foundational | Drag/click plant, auto-save, no coordinates |
| US2 P2 | Foundational (T008 scaffold) | Contrast on all routes |
| US3 P3 | US1 | Hints, highlights, motion-safe feedback |
| Mobile | US1 placeAtPoint | Phone tap-to-place |

### Parallel Opportunities

- Phase 1: T002, T003 in parallel after T001
- Phase 2: T006, T008 in parallel after T005; T028 after T005; T007 after T001
- Phase 4 (US2): T019–T023, T023a, T023b, T025 in parallel after T018; T023c after T023b (same file: PlannerShell.tsx)
- Phase 7: T035, T036, T037, T039, T040 in parallel

### Parallel Example: User Story 2

```bash
# After T018 lands, launch route styling in parallel:
Task T021: auth screens
Task T022: catalog screens
Task T023: garden list/new screens
Task T023a: garden planner page
Task T023b: planner chrome tokens
Task T023c: planner region labels (after T023b)
Task T025: contrast unit test
```

### Parallel Example: User Story 1 (after T010)

```bash
# UI panel updates parallel to canvas work:
Task T014: PropertyPanel coordinate removal
Task T012: PlantLibrary arm state
Task T017: offline revert handling
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart.md §1–2, §4, §6
5. Demo drag/click planting without coordinates

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP planting UX
3. US2 → full-app professional look (can start in parallel after T008)
4. US3 → guidance polish
5. Mobile → phone click-to-place
6. Polish → E2E and sign-off

### Suggested MVP Scope

**Phases 1–3 only** (T001–T017, T013a) deliver the user's primary ask: drag-and-drop and
click-to-place planting without coordinates, with auto-save confirmations and humanized validation (T028 in Phase 2).

---

## Notes

- No Drizzle migrations or new API routes required for v1
- AreaEditor bed/path forms retain origin X/Y fields (deferred per clarification)
- Thumbnail save remains explicit toolbar action (003 behavior); placement auto-save does not regenerate thumbnail
- Constitution II: all placement paths MUST call validate-placement before POST — do not skip in placeAtPoint
- Task count: **44 tasks** (Setup 4, Foundational 5, US1 10, US2 11, US3 4, Mobile 4, Polish 6)
