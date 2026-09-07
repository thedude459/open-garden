---
description: "Task list for streamline e2e tests"
---

# Tasks: Streamline End-to-End Tests

**Input**: Design documents from `/specs/012-e2e-test-streamline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, ADR 0014

**Tests**: This feature *is* the e2e suites. Vitest for new helpers (`live-http`, skip/`E2E_LIVE`). Playwright remains the browser suite. TDD order is flexible. No product migrations. No new Nx lib. Product coverage ≥80% unchanged.

**Organization**: Tasks are grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (`[US1]` … `[US4]`) — setup/foundational/polish omit it
- Include exact file paths in descriptions

## Path Conventions

Nx monorepo: `apps/web-e2e/`, `apps/api-e2e/`, `scripts/ci/e2e.sh`, `docs/adr/0014-e2e-test-streamline.md`

---

## Phase 1: Setup

**Purpose**: Record the speed baseline every later story measures against

- [X] T001 Record the current gated `e2e` job wall-clock (app start + all checks) on the standard CI runner into `specs/012-e2e-test-streamline/baseline.md` (duration, runner class, commit SHA, date). Do not claim SC-001 until this exists

---

## Phase 2: Foundational (helpers + first-try config)

**Purpose**: Shared session/HTTP helpers and Playwright failure config. **No story file rewrites until this phase is done.**

**⚠️ CRITICAL**: User story work MUST NOT start until this phase is complete

- [X] T002 Implement `signedInContext` / `signedInPage` in `apps/web-e2e/src/session.ts`: unique email, `context.request.post('/api/auth/register')` on `:4200` so `og_session` is on the page origin, then `newPage()`. Extra users = extra contexts. Do not walk the registration screen
- [X] T003 [P] Implement `apps/api-e2e/src/live-http.ts`: skip all live cases unless `E2E_LIVE=1`; `POST http://localhost:3000/api/auth/register`; persist `og_session`; `fetch` helper that sends `Cookie`. Unique email per call
- [X] T004 Vitest in `apps/api-e2e/src/live-http.spec.ts`: without `E2E_LIVE` the live describe skips; cookie helper parses `og_session` from a `Set-Cookie` header (no live server required for this file)
- [X] T005 Set `retries: 0`, `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'` in `apps/web-e2e/playwright.config.ts`. Leave the `pipeline` project in place until US3 (T020)

**Checkpoint**: Helpers compile. Playwright will fail first-try and keep traces. Stories can switch files without inventing session code.

---

## Phase 3: User Story 1 - Fast Session and Production Serve (Priority: P1) 🎯 MVP

**Goal**: Non-auth checks skip the registration screen (unique API session). Gated job serves **production** web. Single UI check &lt; 2 minutes with the app already up. Duplicated local `register` helpers gone from UI files.

**Independent Test**: With API+web already running, one UI spec (not login) finishes in under two minutes including session (T013). `e2e.sh` starts `nx serve web --configuration=production`. No UI file still defines a local page `register` that fills the registration form. Full gated 40% / 15-minute bars are SC-001 / SC-002 at feature completion (T032), not this checkpoint.

### Tests for User Story 1 (REQUIRED) ✅

- [X] T006 [P] [US1] Point `newUser` / `register` consumers at `signedInPage` in `apps/web-e2e/src/planner-helpers.ts`. Keep a `registerViaUi` (or equivalent) **only** for auth-screen checks. `newUser` MUST NOT open `/login`

### Implementation for User Story 1

- [X] T007 [US1] Change `scripts/ci/e2e.sh` to `npx nx serve web --configuration=production --host=0.0.0.0 --port=4200`. Keep `/api` proxy. Ready check stays HTTP codes (web 200, plants 401 on `:3000` and `:4200/api/plants`), not a guessed sleep-then-assume
- [X] T008 [P] [US1] Replace local UI `register` with `signedInPage` in `apps/web-e2e/src/garden-list.spec.ts`, `garden-site.spec.ts`, `garden-share.spec.ts`, `garden-share-catalog.spec.ts`, `garden-offline.spec.ts`
- [X] T009 [P] [US1] Same in `apps/web-e2e/src/plantings-beds.spec.ts`, `plantings-record.spec.ts`, `plantings-offline.spec.ts`, `calendar-view.spec.ts`, `calendar-plants.spec.ts`, `calendar-offline.spec.ts`, `reminders-list.spec.ts`, `reminders-complete.spec.ts`, `reminders-offline.spec.ts`
- [X] T010 [P] [US1] Same in `apps/web-e2e/src/layout-beds.spec.ts` (drop local `register`; keep `openOverview`). Planner files already using `newUser` pick up T006
- [X] T011 [P] [US1] Replace `gardener@example.com` UI login with `signedInPage` in `apps/web-e2e/src/plant-catalog.spec.ts`, `plant-catalog-offline.spec.ts`, `plant-favorites.spec.ts`, `plant-filters.spec.ts`, `pipeline-catalog.spec.ts`, and the gardener-cannot-open case in `pipeline-admin.spec.ts`. **Keep** login-screen fills in `ui-feedback-auth.spec.ts` (`gardener@example.com`) and the admin-identity case in `pipeline-admin.spec.ts` (`admin@example.com`)
- [X] T012 [US1] Delete leftover local `register` functions from UI specs after T008–T011. Grep `apps/web-e2e/src` for `Need an account?` — only auth-screen tests may remain
- [X] T013 [US1] With API and production web already running, run one non-auth spec (for example `apps/web-e2e/src/ui-visual-smoke.spec.ts`) and record elapsed time in the task notes or `baseline.md`; MUST be under 120 seconds including session (SC-005)

**Checkpoint**: MVP — unique API sessions + production serve + SC-005. Full 40%/15-minute bars wait until HTTP move + pipeline project removal (US3) and polish measurement (T032).

---

## Phase 4: User Story 2 - Failures Mean Real Bugs (Priority: P1)

**Goal**: Checks wait on observable outcomes. No sleep-then-assert. Unique users everywhere except login or admin-identity screens (FR-005). First-try fail already configured (T005).

**Independent Test**: Grep `apps/web-e2e` and live `api-e2e` HTTP helpers: no `waitForTimeout`; no `setTimeout` used to give the app time (route-injected delay in `ui-feedback-auth.spec.ts` is allowed). Shared `gardener@example.com` / `admin@example.com` only when the behavior under test is that login or admin-identity screen (FR-005). Three consecutive full gated greens are SC-003 at feature completion (T032), not this checkpoint.

### Tests for User Story 2 (REQUIRED) ✅

- [X] T014 [US2] Replace 200ms sleep-poll in `apps/web-e2e/src/pipeline-helpers.ts` with a condition wait (`expect.poll` or deadline loop that re-checks pipeline idle). Keep `waitForPipelineIdleOnPage` for `pipeline-admin.spec.ts`. Do **not** edit `pipeline-merge.spec.ts` here (T019)

### Implementation for User Story 2

- [X] T015 [US2] Grep-remove remaining catch-up sleeps in `apps/web-e2e/src` (`new Promise((r) => setTimeout` except route mocks). Keep the 400ms delay on `page.route` in `ui-feedback-auth.spec.ts` (injected latency, not a wait after click). Create-garden / catalog cases there use `signedInPage` (T006). `test.setTimeout` ceilings may stay
- [X] T016 [US2] Owner+viewer/stranger checks call `signedInPage`/`signedInContext` twice with distinct emails (no global viewer). Touch `garden-share.spec.ts`, `planner-place.spec.ts`, `inviteViewer` in `planner-helpers.ts` as needed. Seeded `gardener@example.com` / `admin@example.com` only on login or admin-identity screens

**Checkpoint**: Isolation + waits match FR-003/FR-005. Three consecutive green runs are polish (T032) after the suite is fully layered.

---

## Phase 5: User Story 3 - The Suite Follows End-to-End Best Practices (Priority: P2)

**Goal**: HTTP-only checks live in `api-e2e` (`E2E_LIVE=1`). One Playwright Chromium project. Catalog-mutating checks isolate (unique names + `sourceOrder` restore) and run **with** gardener UI (`e2e.sh` starts live HTTP and Playwright together). Overlapping page journeys collapsed. Convention written.

**Independent Test**: `npm test` skips live HTTP. `E2E_LIVE=1 nx test api-e2e` hits `:3000`. Playwright config has no `pipeline` project and no `dependencies: ['chromium']`. `CONVENTION.md` exists. Gardener checks do not assert global `plants.totalCount`.

### Tests for User Story 3 (REQUIRED) ✅

- [X] T017 [P] [US3] After the moves, `apps/api-e2e/src/live-http.spec.ts` still skips without `E2E_LIVE`. Spot-check one moved file (e.g. unauthenticated 401) runs only when `E2E_LIVE=1`

### Implementation for User Story 3

- [X] T018 [US3] Move request-only specs to live Vitest under `apps/api-e2e/src/`: `garden-api.spec.ts` → `garden-http.spec.ts`, `garden-layout-api.spec.ts` → `layout-http.spec.ts`, `garden-plantings-api.spec.ts` → `plantings-http.spec.ts`, `garden-calendar-api.spec.ts` → `calendar-http.spec.ts`, `care-reminders-api.spec.ts` → `reminders-http.spec.ts`. Use `live-http.ts`. Delete the Playwright originals
- [X] T019 [US3] After T014: move `pipeline-api.spec.ts` and `pipeline-merge.spec.ts` to `apps/api-e2e/src/pipeline-http.spec.ts`. Condition-wait for plants (no 200ms catch-up sleep). Restore `sourceOrder` to `['fixture']` in `finally`. Unique plant names (`Pipeline Bravo *`). Retry pipeline start only on 409. Delete the Playwright HTTP originals. **Keep** `apps/web-e2e/src/pipeline-helpers.ts` (`waitForPipelineIdleOnPage`) for `pipeline-admin.spec.ts`
- [X] T020 [US3] Remove the `pipeline` project and `testIgnore: /pipeline-/` from `apps/web-e2e/playwright.config.ts`. Single Chromium project, `fullyParallel: true`, CI `workers: 2`. Prove FR-004: `npx playwright test --config=apps/web-e2e/playwright.config.ts apps/web-e2e/src/ui-visual-smoke.spec.ts` still passes with the app up (no “file A before file B”)
- [X] T021 [US3] In `scripts/ci/e2e.sh`, after ready: start `E2E_LIVE=1 npx nx test api-e2e` **and** `npx nx e2e web-e2e` in parallel; fail the script if either fails
- [X] T022 [US3] Inventory every remaining `apps/web-e2e/src/*.spec.ts`: for each, keep, collapse into another file, or note “distinct action.” Write that keep/collapse table into `apps/web-e2e/CONVENTION.md` (create the file if needed). Collapse same-screen pairs including `pipeline-catalog.spec.ts` → `plant-catalog.spec.ts` when they assert the same catalog UI. Do not delete a file unless the inventory says it is a duplicate visible outcome
- [X] T023 [US3] From that inventory: keep **one** browser journey for create/resize/delete beds (`layout-beds.spec.ts` **or** `planner-beds.spec.ts`). Distinct planner actions (place, miss, pan, drag, viewer) stay. Do not treat `layout-place.spec.ts` vs `planner-place.spec.ts` as the same outcome without the inventory saying so
- [X] T024 [US3] Append convention rules to `apps/web-e2e/CONVENTION.md` per `specs/012-e2e-test-streamline/contracts/e2e.md` (waits, unique user, seeded login/admin exception, API session, HTTP vs browser, catalog isolation, keep `pipeline-helpers.ts` for UI idle). Do **not** replace or delete the T022 inventory table. Add a one-line pointer in `apps/api-e2e/project.json` description or a short `apps/api-e2e/README.md`

**Checkpoint**: Layering + concurrent pipeline HTTP + convention. Gardener UI no longer waits for a pipeline project.

---

## Phase 6: User Story 4 - Load and Offline Journeys Stay Honest (Priority: P3)

**Goal**: 20-garden / 100-placement / search load checks keep 2s interactive (and 1s assembly in existing `api-e2e`). Seed via API, not a UI loop. Offline/viewer journeys use unique sessions and condition waits.

**Independent Test**: `garden-list-load.spec.ts` and `planner-load.spec.ts` still fail if interactive &gt; 2s; `gardens-load.spec.ts` and `layout-load.spec.ts` still fail if assembly ≥ 1s. Setup does not click Create garden 20 times. Offline specs still pass without 90s as a substitute for waiting.

### Tests for User Story 4 (REQUIRED) ✅

- [X] T025 [P] [US4] Keep failing assertions in `apps/web-e2e/src/garden-list-load.spec.ts` (2s, no per-row layout GET), `apps/api-e2e/src/gardens-load.spec.ts` (1s assembly), and `apps/api-e2e/src/layout-load.spec.ts` (100-placement assembly &lt; 1s). Only change **how** fixtures are created, not the budgets

### Implementation for User Story 4

- [X] T026 [US4] Seed 20 gardens via `page.request.post('/api/gardens')` (or `signedInPage` then request) in `apps/web-e2e/src/garden-list-load.spec.ts` — no UI create loop
- [X] T027 [P] [US4] Seed 100 placements via API/layout PUT in `apps/web-e2e/src/planner-load.spec.ts` (reuse existing seed if already API; strip any UI-per-item loop)
- [X] T028 [P] [US4] `apps/web-e2e/src/plant-search-load.spec.ts` uses `signedInPage` (T006) and keeps request-count + 2s assertions
- [X] T029 [US4] Offline files (`layout-offline.spec.ts`, `garden-offline.spec.ts`, `plantings-offline.spec.ts`, `calendar-offline.spec.ts`, `reminders-offline.spec.ts`, `plant-catalog-offline.spec.ts`) use unique `signedInPage`/`newUser` and condition waits; `test.setTimeout` only as ceiling

**Checkpoint**: 011 budgets still enforced; setup is cheap; offline still isolated.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Prove the speed/flake bars and docs

- [X] T030 Re-grep `apps/web-e2e` and `apps/api-e2e/src/*http*` for `waitForTimeout` and catch-up `setTimeout` as **proof** of T015 (no new edits unless T015 missed a hit); zero hits except documented route mocks
- [X] T031 [P] Confirm `docs/adr/0014-e2e-test-streamline.md` matches the shipped config (retries 0, production serve, parallel live HTTP, no pipeline project)
- [X] T032 Run `npm run e2e` three times on an unchanged healthy tree; all pass with retries 0. Then compare wall-clock to `baseline.md`: ≥40% faster **and** &lt; 15 minutes (FR-002). Record the new duration next to the baseline
- [X] T033 [P] Walk `specs/012-e2e-test-streamline/quickstart.md` (layering, isolation, single-check &lt; 2 min with app up)
- [X] T034 Confirm `npm test` still green with live HTTP skipped; product coverage ≥80% unchanged. No new secrets. YAGNI: no leftover duplicate `register` helpers

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 baseline — start immediately
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS** all user stories
- **US1 (Phase 3)**: After Phase 2 — MVP
- **US2 (Phase 4)**: After Phase 2; easiest after US1 session rewrite so greps are meaningful
- **US3 (Phase 5)**: After US1 file switches and T014. Pipeline project removal is the remaining speed lever for SC-001/SC-002
- **US4 (Phase 6)**: After US1 (`signedInPage` / `newUser`). Can parallel US2/US3 on different files (`*-load.spec.ts`, `*-offline.spec.ts`)
- **Polish**: After US1–US4

### User Story Dependencies

- **US1**: Foundation only. Delivers production serve + API sessions
- **US2**: Foundation; isolation/waits. Completeness of unique-user grep assumes US1 file switches
- **US3**: After T014 (pipeline-helpers wait) then T018–T024. HTTP moves should happen **after** US1 UI session rewrite. T019 MUST NOT delete `pipeline-helpers.ts`. Pipeline project removal is the remaining speed lever for SC-001/SC-002
- **US4**: Needs `signedInPage` (US1 T006)

### Parallel Opportunities

- T002 and T003 (different files)
- T008, T009, T010, T011 (different spec groups) after T006
- T018 after US1; T019 after T014 (same `pipeline-helpers.ts` otherwise)
- T022 then T024 (inventory table first; T024 appends rules and must not replace the table); T023 after T022
- T027, T028 after T006
- T031 and T033 during T032 if the suite is already green

---

## Parallel Example: User Story 1

```bash
# After T006 (planner-helpers):
Task: "T008 garden UI specs → signedInPage"
Task: "T009 plantings/calendar/reminders UI → signedInPage"
Task: "T010 layout-beds + planner newUser pickup"
Task: "T011 catalog/pipeline-admin unique users"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 baseline
2. Phase 2 helpers + retries 0
3. Phase 3: production serve + API sessions
4. **STOP**: T013 — one UI spec &lt; 2 min with app up; `e2e.sh` uses production serve. Do not claim SC-001/SC-002 yet.

### Incremental Delivery

1. Setup + Foundational
2. US1 → faster local/CI start + no UI register loop
3. US2 → no catch-up sleeps; unique users
4. US3 → HTTP in `api-e2e`; no pipeline project; parallel live+UI; convention
5. US4 → cheap load/offline setup
6. Polish → three greens + 40% / 15 min vs `baseline.md`

### Parallel Team Strategy

1. Together: T001–T005
2. Then: A = US1 file groups T008–T011, B = US2 waits T014–T015 on helpers (avoid same spec files A is rewriting)
3. After US1: A = US3 HTTP moves, B = US4 load/offline seeds
4. Together: T032 measurement

---

## Notes

- [P] = different files, no dependency on incomplete tasks
- Login-screen tests may keep `gardener@example.com`; admin-identity tests may keep `admin@example.com` (FR-005). Ordinary checks use unique users
- Do not add `@open-garden/e2e-harness`
- Do not add a second Postgres
- FR-015: product UI change only if a wait cannot attach to an existing visible name
- Full SC-001/SC-002 are polish (T032), not the US1 checkpoint; SC-005 is T013
- Suggested MVP: Phases 1–3 (through T013)
