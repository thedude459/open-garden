# Tasks: UI Feedback & Garden Usability Polish

**Input**: Design documents from `/specs/009-ui-feedback-polish/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: REQUIRED per constitution. Vitest (≥80% coverage CI gate) for
`libs/web-ui`. Playwright E2E once UI is functional. TDD ordering is flexible.
No API or migration tasks (FR-014).

**Organization**: Tasks are grouped by user story for independent implementation
and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]` … `[US4]`) — setup/foundational/polish omit it
- Include exact file paths in descriptions

## Path Conventions

Nx monorepo: `apps/web/`, `apps/web-e2e/`, `libs/web-ui/`, `apps/web/src/styles.css`

---

## Phase 1: Setup (Nx lib + tokens)

**Purpose**: Project wiring every story needs

- [X] T001 Create `libs/web-ui` by copying the Nx lib skeleton from `libs/care-reminders` (`project.json` with Vitest target, `tsconfig.json` / `tsconfig.lib.json`, `src/index.ts`, `src/lib/.gitkeep`; no domain code yet)
- [X] T002 [P] Add path `@open-garden/web-ui` in `tsconfig.base.json` and Vitest `include` + `coverage.include` + `resolve.alias` in `vitest.config.ts`
- [X] T003 [P] Add spacing (`--space-1`…`--space-6`), `--radius`, `--elev-1`, `--elev-2`, and `.card` (uses `--elev-1`) on `:root` in `apps/web/src/styles.css`

---

## Phase 2: Foundational (Notice, busy, buttons, host)

**Purpose**: Shared notice queue, busy lock, button ranks, and a single notice host. **No story page wiring until this phase is done.**

**⚠️ CRITICAL**: User story work MUST NOT start until this phase is complete

- [X] T004 Implement `createNoticeQueue` (success expires 4000 ms, error/miss persist, any kind replaces current, reject empty message) in `libs/web-ui/src/lib/notice-queue.ts` and export from `libs/web-ui/src/index.ts`
- [X] T005 [P] Implement `createBusyLock` (`tryBegin` / `end`, missing `end` is no-op) in `libs/web-ui/src/lib/busy-lock.ts` and export from `libs/web-ui/src/index.ts`
- [X] T006 Vitest: expire, replace (success→success and error→success), dismiss, reject empty in `libs/web-ui/src/lib/notice-queue.spec.ts`
- [X] T007 [P] Vitest: double `tryBegin` false; `end` clears in `libs/web-ui/src/lib/busy-lock.spec.ts`
- [X] T008 Add `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-destructive`, and `.btn[aria-busy="true"]` in `apps/web/src/styles.css`
- [X] T009 Standalone `NoticeHost` (`aria-label="Notification"`, `role="status"` success / `role="alert"` error|miss, **Dismiss** on persist) in `apps/web/src/app/ui/notice-host.ts`
- [X] T010 Wire `NoticeHost` in `apps/web/src/app/app.component.ts` and clear the queue on `Router` navigation so leftover notices never appear on the next screen
- [X] T011 Add `NoticeService` (wraps queue + busy helpers for pages) in `apps/web/src/app/ui/notice.service.ts`

**Checkpoint**: Lib tests pass. App shows a host. Stories can wire pages.

---

## Phase 3: User Story 1 - Immediate Action Feedback (Priority: P1) 🎯 MVP

**Goal**: First-class screens show busy on the triggering control immediately, block double-submit, confirm service success with a notice (unless navigated away or the item is gone), persist errors/misses until Dismiss, and treat valid map drops as Unsaved changes only.

**Independent Test**: Login, Create garden, Save layout, catalog search/add, Add transplant: busy then success or failure. Double Create garden / Save → one attempt. Offline mutate → persistent error, not stuck busy. Valid drop → Unsaved changes, no success notice. Miss → **Drop missed a bed** until Dismiss. Viewer has no mutate busy. Garden home Save garden / Delete garden: quickstart, not a separate Playwright file.

### Tests for User Story 1 (REQUIRED)

- [X] T012 [P] [US1] Playwright: login busy; Create garden busy + success notice; double Create garden is one garden; catalog search busy and add/favorite success notice in `apps/web-e2e/src/ui-feedback-auth.spec.ts`
- [X] T013 [P] [US1] Playwright: Save layout busy + success notice; offline Save persistent **Notification** + **Dismiss**; Add transplant busy + success notice; valid tray drop Unsaved changes and no success notice; miss **Drop missed a bed** stays until Dismiss and uses `role="alert"` in `apps/web-e2e/src/ui-feedback-planner.spec.ts`

### Implementation for User Story 1

- [X] T014 [US1] Wrap login/register submit with busy key `login` and error notice (success = navigate, no leftover notice) in `apps/web/src/app/auth/login.page.ts`
- [X] T015 [P] [US1] Wrap **Create garden** with busy key `create-garden`, success notice if still on the list, error notice on failure in `apps/web/src/app/gardens/garden-list.page.ts`
- [X] T016 [US1] Wrap garden home **Save garden**, invite, and confirmed **Delete garden** with busy + notices; skip success notice on confirmed delete that removes the garden; error notice on failure in `apps/web/src/app/gardens/garden-detail.page.ts`
- [X] T017 [US1] Wrap **Save layout**, **Create bed**, **Create non-planting area**, confirmed delete bed/area with busy + notices; skip success notice on confirmed delete that removes the item; offline-required via error notice without stuck busy in `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T018 [US1] Wrap **Save layout**, **Direct seed** add, confirmed remove in `apps/web/src/app/gardens/garden-bed-view.page.ts`; post `miss` **Drop missed a bed** through `NoticeService` (persist) instead of a silent or auto-clearing status only
- [X] T019 [P] [US1] Wrap Add/Delete transplant and indoor complete/dismiss with busy + notices in `apps/web/src/app/gardens/garden-transplants.page.ts`
- [X] T020 [P] [US1] Wrap catalog search, add favorite, and on-demand/no-match link path with busy + notices in `apps/web/src/app/plants/plant-list.page.ts` and `apps/web/src/app/plants/plant-detail.page.ts`
- [X] T021 [US1] Valid Overview/Bed map place or move MUST NOT post a success notice (Unsaved changes only) in `apps/web/src/app/gardens/garden-layout.page.ts` and `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T022 [US1] Apply `.btn` ranks so `aria-busy` is visible; do not disable the whole toolbar or canvas in `apps/web/src/app/auth/login.page.ts`, `apps/web/src/app/gardens/garden-list.page.ts`, `apps/web/src/app/gardens/garden-detail.page.ts`, `apps/web/src/app/gardens/garden-layout.page.ts`, `apps/web/src/app/gardens/garden-bed-view.page.ts`, `apps/web/src/app/gardens/garden-transplants.page.ts`, `apps/web/src/app/plants/plant-list.page.ts`, and `apps/web/src/app/plants/plant-detail.page.ts`

**Checkpoint**: MVP — waiting actions announce themselves. Plantings/calendar/reminders not audited.

---

## Phase 4: User Story 2 - Know Where You Are in the Garden (Priority: P1)

**Goal**: Place marker (garden > level / bed name); beds vs areas not by color alone; labeled **Open bed {name}** plus click-without-drag still opens Bed View; drag still moves; Back to overview unchanged (does not discard draft).

**Independent Test**: Overview shows You are here, Bed and Area labels, Open bed control, click opens Bed View, drag moves. Bed View crumb is garden > bed; Back to overview works. Viewer: same navigation, cannot move beds.

### Tests for User Story 2 (REQUIRED)

- [X] T023 [P] [US2] Playwright: `You are here` on Overview/Bed/Transplants; keyboard **Open bed {name}** (Tab + Enter) opens Bed View; click-without-drag opens; drag does not navigate; `[data-kind="bed"]` / `[data-kind="area"]` and visible Bed/Area text; at 390px width **Open bed** and **Back to overview** remain visible in `apps/web-e2e/src/ui-place-marker.spec.ts`

### Implementation for User Story 2

- [X] T024 [P] [US2] Standalone `PlaceMarker` (`nav` `aria-label="You are here"`) in `apps/web/src/app/ui/place-marker.ts`
- [X] T025 [US2] Render place marker **{garden} > Garden Overview**, rail control **Open bed {name}**, keep click-without-drag → Bed View and drag → move in `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T026 [P] [US2] Render place marker **{garden} > {bedName}**; keep **Back to overview** in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T027 [P] [US2] Render place marker **{garden} > Transplants** in `apps/web/src/app/gardens/garden-transplants.page.ts`
- [X] T028 [US2] Set `[attr.data-kind]="'bed'|'area'"`, hatch pattern on areas, visible **Bed** / **Area** words, hover/focus Open bed cue on frames in `apps/web/src/app/gardens/garden-plan-canvas.ts`
- [X] T029 [US2] Area hatch + bed/area focus outline in `apps/web/src/styles.css` (do not rely on fill color alone)

**Checkpoint**: Gardeners can tell the level, open a bed on purpose, and tell beds from areas.

---

## Phase 5: User Story 3 - Empty States That Point to the Next Step (Priority: P2)

**Goal**: Zero gardens, zero beds, zero plantings, and catalog no-match use one empty-state language with role-appropriate next steps. Empty Bed View: **Direct seed** and **Transplants** equal rank.

**Independent Test**: New user gardens list has Create garden in empty-state. Empty Overview has Create bed (viewer: copy only). Empty Bed View has both Direct seed and Transplants equally (viewer: copy only). Catalog no-match uses the same empty-state pattern.

### Tests for User Story 3 (REQUIRED)

- [X] T030 [P] [US3] Playwright: empty gardens list next step **Create garden**; empty Overview **Create bed**; empty Bed View **Direct seed** and **Transplants** both present; viewer empty Overview has 0 Create bed in `apps/web-e2e/src/ui-empty-states.spec.ts`

### Implementation for User Story 3

- [X] T031 [P] [US3] Standalone `EmptyState` (title, body, action slot) plus `.empty-state` in `apps/web/src/app/ui/empty-state.ts` and `apps/web/src/styles.css`
- [X] T032 [US3] Gardens list zero items: EmptyState wrapping **Create garden** (not muted-only); if offline, empty-state body uses the existing online-required wording so the next step does not look like it will work in `apps/web/src/app/gardens/garden-list.page.ts`
- [X] T033 [US3] Overview zero beds: EmptyState + **Create bed** for editors; viewer explanation only; if offline, empty-state body uses the existing online-required wording so the next step does not look like it will work in `apps/web/src/app/gardens/garden-layout.page.ts`
- [X] T034 [US3] Empty Bed View: EmptyState with **Direct seed** and **Transplants** as two `.btn-secondary` (same rank); viewer copy only; if offline, empty-state body uses the existing online-required wording so the next step does not look like it will work in `apps/web/src/app/gardens/garden-bed-view.page.ts`
- [X] T035 [P] [US3] Catalog no matches: EmptyState (what happened + try another name) in `apps/web/src/app/plants/plant-list.page.ts`

**Checkpoint**: First-time paths have a next step.

---

## Phase 6: User Story 4 - One Visual Language Across Screens (Priority: P2)

**Goal**: Audited screens share spacing, card elevation, and three button ranks; loading/empty/error look like one family. Planner two-view rules unchanged.

**Independent Test**: Walk gardens list, overview, bed view, catalog, auth: one rhythm, `.btn-*` ranks, shared empty/loading/error. No obvious one-off padding/shadows on those screens.

### Tests for User Story 4 (REQUIRED)

- [X] T036 [P] [US4] Playwright smoke: primary **Create garden** / **Save layout** / **Login** still named and visible after class changes in `apps/web-e2e/src/ui-visual-smoke.spec.ts` (names, not CSS; SC-007 remains manual per contracts/ui.md)

### Implementation for User Story 4

- [X] T037 [P] [US4] Apply `.card` / `--elev-1` and `.btn-*` on list rows and forms in `apps/web/src/app/gardens/garden-list.page.ts` and `apps/web/src/app/auth/login.page.ts`
- [X] T038 [P] [US4] Apply token spacing and button ranks on catalog list/detail in `apps/web/src/app/plants/plant-list.page.ts` and `apps/web/src/app/plants/plant-detail.page.ts`
- [X] T039 [US4] Apply token spacing, `.planner-rail` gaps, and button ranks on Overview and Bed View without changing 008 gestures in `apps/web/src/app/gardens/garden-layout.page.ts`, `apps/web/src/app/gardens/garden-bed-view.page.ts`, and `apps/web/src/styles.css`
- [X] T040 [US4] Align loading (`Loading…`), `.error`, and `.empty-state` so they share type/spacing in `apps/web/src/styles.css`; replace remaining ad hoc inline styles on audited screens if any
- [X] T041 [P] [US4] Plantings/calendar/reminders: only add `.btn` classes if those templates already use raw `<button>` and pick up tokens for free — no action-by-action busy audit — in `apps/web/src/app/gardens/garden-plantings.page.ts`, `apps/web/src/app/gardens/garden-calendar.page.ts`, `apps/web/src/app/gardens/garden-reminders.page.ts`

**Checkpoint**: Audited screens look like one product.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Docs, coverage, YAGNI

- [X] T042 [P] ADR 0011 (notice queue, tokens, no backend) in `docs/adr/0011-ui-feedback-tokens.md`
- [X] T043 [P] Point README / planner notes at busy + place marker behavior in `README.md`
- [X] T044 Confirm Vitest coverage ≥80% including `libs/web-ui` (`npm test`)
- [X] T045 YAGNI: no toast vendor in `package.json`, no extra Nx apps, no REST/DTO changes under `apps/api` or `libs/shared-types`; remove unused helpers under `apps/web/src/app/ui/` and `libs/web-ui/src/lib/`
- [X] T046 Run `specs/009-ui-feedback-polish/quickstart.md` (automated `npm test` + `npm run e2e`; note manual SC-001/004/005/006/007 and garden-home Save garden / Delete garden busy+notice)
- [X] T047 Confirm 008 Playwright names still pass (`Save layout`, `Back to overview`, `Drop missed a bed`, `Create bed`) — full `npm run e2e`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User stories (Phase 3+)**: All depend on Foundational
  - US1 (P1) is MVP; US2 (P1) can follow or parallel after foundation
  - US3 and US4 (P2) after foundation; US3 EmptyState can reuse US4 `.empty-state` CSS from T031
- **Polish (Phase 7)**: After desired stories

### User Story Dependencies

- **User Story 1 (P1)**: After Phase 2 only
- **User Story 2 (P1)**: After Phase 2; does not require US1 notices to be on every page, but Overview/Bed files overlap with US1 — sequential US1 then US2 is safer for those files
- **User Story 3 (P2)**: After Phase 2; Overview/Bed files overlap with US1/US2 — do after US2 if one implementer
- **User Story 4 (P2)**: After Phase 2; restyles the same pages — last among US1–US4 if one implementer

### Within Each User Story

- Tests required; order vs implementation is flexible
- Lib/public UI pieces before page wiring
- Playwright when the story UI exists
- Story complete before the next if sharing the same page files

### Parallel Opportunities

- T002 and T003 after T001
- T005 and T007 with T004/T006 (different files)
- T012 and T013 once US1 UI exists
- T024, T026, T027 after T025 starts (place-marker file first)
- T031 and T035 after EmptyState exists
- T037, T038, T041 in parallel during US4

---

## Parallel Example: User Story 1

```bash
# After T014–T021 UI exists:
Task: "Playwright auth/create garden/catalog in apps/web-e2e/src/ui-feedback-auth.spec.ts"
Task: "Playwright planner save/offline/transplant/miss in apps/web-e2e/src/ui-feedback-planner.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational (CRITICAL)
3. Phase 3 User Story 1
4. **STOP and VALIDATE**: busy + notices on first-class screens
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational
2. US1 → demo (MVP)
3. US2 → navigation polish
4. US3 → empty states
5. US4 → visual audit
6. Polish → ADR, coverage, e2e

### Parallel Team Strategy

1. Together: Setup + Foundational
2. Then: A = US1 pages, B = PlaceMarker + canvas (US2) after US1 releases `garden-layout.page.ts` / `garden-plan-canvas.ts`, or one person sequential US1→US2 on those files

---

## Notes

- [P] = different files, no incomplete-task dependencies
- No `apps/api` or migration tasks
- Do not add `libs/garden-planner`
- Keep 008 Open bed click-without-drag and drag-to-move
- Plantings/calendar/reminders: CSS inherit only (T041)
- Commit after each task or logical group
- Stop at checkpoints to validate the story independently

## Phase 8: Convergence

- [X] T048 Restore **Create garden** as the EmptyState action slot on a zero-garden list (form inside `og-empty-state`, not only a sibling above it) in `apps/web/src/app/gardens/garden-list.page.ts` per FR-011 / T032 (contradicts)
- [X] T049 Wrap garden-home membership service actions (set role, transfer ownership, remove member, leave) with busy + success/error notices in `apps/web/src/app/gardens/garden-detail.page.ts` per FR-001 / FR-003 (partial)

