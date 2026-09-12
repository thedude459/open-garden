---
description: "Task list for garden view clarity"
---

# Tasks: Garden View Clarity

**Input**: Design documents from `/specs/014-garden-view-clarity/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/garden-ui.md, quickstart.md

**Tests**: REQUIRED. Vitest for `shortenPlantingMarkName` in `libs/garden-layout`. Playwright for map-first landing, configuration, quiet Bed View, one-click Overview, viewer read-only. Host `npm run e2e` stays the merge gate. No new `apps/api-e2e` tests (no API change). No new Nx lib, no migration, no ADR.

**Organization**: Tasks are grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]` … `[US3]`) — setup/foundational/polish omit it
- Include exact file paths in descriptions

## Path Conventions

`apps/web/src/app/app.routes.ts`, `apps/web/src/app/gardens/`, `apps/web/src/app/ui/place-marker.ts`, `libs/garden-layout/src/lib/planting-labels.ts`, `apps/web-e2e/src/`

---

## Phase 1: Setup

**Purpose**: Shared garden nav so later stories do not each invent a link list

- [X] T001 Create standalone `GardenNav` in `apps/web/src/app/gardens/garden-nav.ts` with links to Overview (`layout`), Plantings, Calendar, Reminders, Transplants, and Configuration (`configure`) per `specs/014-garden-view-clarity/contracts/garden-ui.md`. Do not wire it into pages yet

---

## Phase 2: Foundational (Routes + helpers)

**Purpose**: Configuration URL exists and Playwright can reach invite/settings after the landing moves. **No story validation until this phase is done.**

**⚠️ CRITICAL**: User story work MUST NOT start until this phase is complete

- [X] T002 Register `gardens/:id/configure` in `apps/web/src/app/app.routes.ts` loading `GardenDetailPage` (`authGuard`). Keep `gardens/:id` on the detail page until US1’s redirect
- [X] T003 [P] Add `showBedCaption` input defaulting to `true` on `apps/web/src/app/gardens/garden-plan-canvas.ts` (wrap the `Bed · {{ name }} · {{ size }}` `<text>`). Do not change Bed View yet
- [X] T004 Add `openConfiguration(page)` in `apps/web-e2e/src/planner-helpers.ts` (prefer the Configuration nav link; else `goto` `/gardens/:id/configure`). Point `inviteViewer` at it instead of `Back to garden`

**Checkpoint**: `/gardens/:id/configure` renders today’s settings/members/delete. Canvas Overview still shows bed name/size. Stories can change landing and labels without inventing the configure path.

---

## Phase 3: User Story 1 - Open A Garden, See The Garden (Priority: P1) 🎯 MVP

**Goal**: List (and garden home) open the visual garden. Configuration is not the first screen.

**Independent Test**: Create a garden, click it on `/gardens`. First screen is **Garden Overview** (including an empty garden). No **Garden settings**, member list, or **Delete garden** as the main body. A garden with beds still shows name and size on the Overview plan (T022).

### Implementation for User Story 1

- [X] T008 [US1] Change the garden row link in `apps/web/src/app/gardens/garden-list.page.ts` to `['/gardens', g.id, 'layout']`
- [X] T009 [US1] Point Place Marker garden home in `apps/web/src/app/ui/place-marker.ts` at `['/gardens', gardenId(), 'layout']`
- [X] T010 [US1] In `apps/web/src/app/app.routes.ts`, redirect `gardens/:id` → `gardens/:id/layout` (pathMatch full). Configuration remains `gardens/:id/configure` (T002)
- [X] T011 [US1] Mount `GardenNav` (T001) on `apps/web/src/app/gardens/garden-layout.page.ts`. Remove **Back to garden**. Keep `showBedCaption` (bed name/size on the drawing) and `overviewPlantingLabels` name×count. Set `[showPlantingMarks]="false"` so Overview does **not** draw in-bed planting circles or beside-mark names (FR-010)

### Tests for User Story 1 (REQUIRED) ✅

> After T008–T011. T005–T007 may run in parallel with each other.

- [X] T005 [P] [US1] Update `apps/web-e2e/src/garden-list.spec.ts`: after clicking a newly created garden (**no beds**), expect **Garden Overview** (empty guidance), not `You are owner` / name input. Rename and delete via `openConfiguration` (T004)
- [X] T006 [P] [US1] Update `apps/web-e2e/src/garden-site.spec.ts` to open Configuration before zone/frost fields
- [X] T007 [P] [US1] Update `apps/web-e2e/src/garden-share.spec.ts` and `apps/web-e2e/src/garden-offline.spec.ts` so invite/members run on Configuration, not the list landing

**Checkpoint**: MVP — list → map. Settings still work at Configuration. Viewer sees the same landing (authz unchanged).

---

## Phase 4: User Story 2 - Plant In A Bed Without Label Clutter (Priority: P1)

**Goal**: Bed View shows a truncated common name **on** each mark. No bed name/size on the drawing. Select a mark → full name in one off-plan status line.

**Independent Test**: Bed with two nearby same-name plantings: marks stay readable; plan text is not `Bed · … × … ft`; selecting a mark shows the full name off the SVG; clicking empty plan clears it. Empty bed has no size caption. Viewer sees the same marks and cannot drag.

### Implementation for User Story 2

- [X] T014 [US2] Implement `shortenPlantingMarkName(commonName, radiusInches)` in `libs/garden-layout/src/lib/planting-labels.ts` and export it from `libs/garden-layout/src/index.ts`
- [X] T015 [US2] In `apps/web/src/app/gardens/garden-plan-canvas.ts`: when `showPlantingMarks` is true, draw truncated name **on** the circle (`shortenPlantingMarkName`). Do **not** call `layoutPlantingLabels`. Do **not** use `allowPlantingDrag` as the label-mode switch. Honor `showBedCaption` (T003). On click-not-drag of a planting, emit/select that planting (reuse `isClickNotDrag`; do not break drag-to-move). Click empty plan emits a clear-selection
- [X] T016 [US2] In `apps/web/src/app/gardens/garden-bed-view.page.ts`: `[showBedCaption]="false"` and `[showPlantingMarks]="true"`; keep bed **name** in heading / Place Marker `current`; **do not** show size. Bind selected planting to one off-plan `role="status"` line with the **full** common name. Clicking another mark switches the line. **Clicking empty plan** clears selection and the line. Viewers keep `canEdit` false

### Tests for User Story 2 (REQUIRED) ✅

- [X] T012 [US2] Vitest in `libs/garden-layout/src/lib/planting-labels.spec.ts` for `shortenPlantingMarkName`: short names unchanged; long names are a **prefix** that fits `2 * r` using existing `CHAR_W` (~3.1); empty/tiny `r` does not throw (empty or one character). Keep existing `layoutPlantingLabels` cases. Same file as T014 — do not parallel with T014
- [X] T013 [US2] Playwright `apps/web-e2e/src/planner-bed-labels.spec.ts`: (1) two close plantings of one common name — on-mark prefix, **no** beside-mark full names, **no** `Bed ·` size caption; click a mark → `role="status"` shows the full common name; click empty plan → status clears; viewer cannot move marks. (2) empty bed: no `Bed ·` caption and no empty name stack

**Checkpoint**: Overview still has `Bed · name · size` and name×count. Bed View is quiet. `layoutPlantingLabels` may remain in the lib unused by Bed View.

---

## Phase 5: User Story 3 - Configuration Lives Next Door (Priority: P2)

**Goal**: Configuration is a first-class garden destination. From any other garden page, Overview is **one** click. Sharing/delete stay on configure with today’s roles.

**Independent Test**: Overview → Configuration → change a setting an owner is allowed to change, save, return to the map in one click. Collaborator can save garden facts. Viewer can open configuration read-only.

### Implementation for User Story 3

- [X] T019 [US3] Mount `GardenNav` on `apps/web/src/app/gardens/garden-detail.page.ts`, `garden-plantings.page.ts`, `garden-calendar.page.ts`, `garden-reminders.page.ts`, and `garden-transplants.page.ts`. Remove **Back to garden** links. Bed View keeps **Back to overview** only (no need to duplicate the full nav)
- [X] T020 [US3] Retitle the configure screen in `apps/web/src/app/gardens/garden-detail.page.ts` so gardeners see **Configuration** (keep the settings form, members, invite, leave, delete, confirm-delete). Do not change owner vs collaborator vs viewer template rules
- [X] T021 [US3] Replace remaining `Back to garden` clicks in `apps/web-e2e/src/` with `openConfiguration` or **Garden Overview** as appropriate: `planner-beds.spec.ts`, `layout-place.spec.ts`, `layout-offline.spec.ts`, `calendar-view.spec.ts`, `calendar-offline.spec.ts`, `reminders-list.spec.ts`, `reminders-complete.spec.ts`, `reminders-offline.spec.ts`, `plantings-beds.spec.ts`, `plantings-record.spec.ts`, `plantings-offline.spec.ts`

### Tests for User Story 3 (REQUIRED) ✅

> After T019–T021. T017–T018 may run in parallel with each other.

- [X] T017 [P] [US3] In `apps/web-e2e/src/garden-share.spec.ts`: from Overview, Configuration shows name/notes/zone/frost **and** members/invite/delete; owner save persists; **Garden Overview** returns to the map in one click; collaborator can Save garden facts and cannot Invite/Delete; viewer opens list → map, Configuration read-only (no Save/Invite/Delete)
- [X] T018 [P] [US3] Playwright `apps/web-e2e/src/garden-nav-overview.spec.ts`: from plantings, calendar, reminders, and transplants, **Garden Overview** reaches the map in one click. Bed View already has **Back to overview** — keep it

**Checkpoint**: FR-003 / FR-007 / SC-003–SC-005. Sharing still owner-only where it was.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Leftover planner e2e and proof

- [X] T022 [P] Confirm `apps/web-e2e/src/ui-place-marker.spec.ts`: Overview plan still contains `Bed · North` (name and size); after **Open bed**, plan does **not** show that size caption; Place Marker still names the bed. Overview plan with an occupied bed shows name×count on the bed and **no** in-bed planting circles
- [X] T023 [P] Confirm `openOverview` in `apps/web-e2e/src/planner-helpers.ts` still works when the list already lands on Overview (nav link **Garden Overview** on layout)
- [X] T024 Run `specs/014-garden-view-clarity/quickstart.md` (or equivalent Playwright) for SC-001–SC-005. Confirm `npm test` coverage for `libs/garden-layout` stays ≥80%. No new migration, no ADR, do not change `scripts/ci/e2e.sh` onto Compose profile `app`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 — start immediately
- **Foundational (Phase 2)**: T002–T004 — blocks all stories
- **US1 (Phase 3)**: T008–T011 then T005–T007 — MVP (map-first). T005–T007 are `[P]` with each other after the UI exists; CI needs them in the same increment as the redirect
- **US2 (Phase 4)**: T014–T016 then T012–T013 — independent of US3; uses T003
- **US3 (Phase 5)**: T019–T021 then T017–T018 — needs T001, T002, US1 redirect
- **Polish (Phase 6)**: after US1–US3

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2. Does not need Bed View label work
- **User Story 2 (P1)**: After Phase 2. Can proceed in parallel with US1 if staffed (different files: `planting-labels.ts` / canvas / bed-view vs list / routes / layout nav). Canvas `garden-plan-canvas.ts` is shared with T003 — finish T003 first; US2 owns the remaining canvas edits
- **User Story 3 (P2)**: After US1 (configure path + layout nav exist). Independent of US2

### Within Each User Story

- Tests required; TDD order flexible
- No new shared-types or REST
- Playwright for a story in the same merge as that story’s routing/UI so host e2e stay green

### Parallel Opportunities

- T003 and T004 after T002
- T005, T006, T007 in parallel with each other **after** T008–T011
- T012 after T014 (same `planting-labels.ts` — not parallel)
- T017 and T018 after T019–T020
- T022 and T023 in polish

---

## Parallel Example: User Story 1

```text
T008–T011 list link, place marker, redirect, layout nav (`showPlantingMarks=false`)
# then in parallel:
T005 garden-list.spec.ts
T006 garden-site.spec.ts
T007 garden-share.spec.ts + garden-offline.spec.ts
```

## Parallel Example: User Story 2

```text
T014 implement shortenPlantingMarkName
T012 Vitest in the same file (after or with T014, not a second agent)
T015 canvas (on-mark when showPlantingMarks; never layoutPlantingLabels)
T016 bed-view (empty-plan clears status)
T013 planner-bed-labels.spec.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1–2 (nav component, configure route, helpers, caption flag)
2. Phase 3 US1 (list → map, redirect, e2e landing)
3. **STOP**: click a garden — see Overview, not settings

### Incremental Delivery

1. US1 → map-first landing
2. US2 → quiet Bed View
3. US3 → Configuration in garden nav everywhere; one-click Overview
4. Polish → place-marker + full e2e gate

### Parallel Team Strategy

- After Phase 2: A does US1 (routes/list/e2e landing), B does US2 (lib + canvas + bed-view). Merge US1 first if both touch e2e helpers. US3 after US1.

---

## Notes

- [P] = different files, no wait on incomplete sibling tasks
- Do not add `libs/garden-nav` or a nickname field
- Do not draw in-bed positions on Overview
- Delete garden still confirms
- `layoutPlantingLabels` is unused by the canvas after T015 (helper may stay in the lib)
- Overview `[showPlantingMarks]="false"`; Bed View `[showPlantingMarks]="true"` with on-mark text
- Deselect = click empty plan; another mark switches the status line
- Avoid: new NgModules, API/DTO churn, Compose CI switch, ADRs
