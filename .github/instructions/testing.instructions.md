---
description: "Use when testing, validating, smoke checking, rebuilding containers, verifying API behavior, or confirming frontend/backend changes in this Dockerized garden app. Covers rebuild workflow and practical smoke-test expectations when no formal test suite exists."
name: "Garden Testing"
applyTo: "backend/app/**/*.py, frontend/src/**/*.{ts,tsx,css}, scripts/**/*.sh"
---

# Testing Guidelines

- This repo has an automated backend unit test suite. Backend changes should include or update unit tests when behavior changes.
- Backend coverage policy: keep total backend coverage at `>= 90%` (matching `pytest.ini` / CI gate). Do not merge backend feature work that drops this threshold.
- Frontend coverage policy: keep total frontend unit-test coverage at `>= 90%` and enforce it via CI coverage thresholds. Do not go below `80%` as a minimum floor in local validation or CI.
- Every backend module with executable business logic should have unit tests in `backend/tests/`.
- If a backend module is added under `backend/app/`, add a corresponding test module (or extend an existing focused module) in the same PR.
- When adding a new backend feature (router endpoint, service behavior, engine logic, auth/ownership path), add focused tests for success, expected failures, and important edge cases.
- Avoid increasing `.coveragerc` omissions to make coverage pass. New omissions require clear technical justification (bootstrap-only wiring, generated code, or declarative schema/model definitions with no meaningful branching).
- When an omission is necessary, add a brief inline reason in `.coveragerc` and prefer adding tests over excluding files.
- Default full-stack validation flow is:
  1. `cp .env.example .env` if `.env` does not exist.
  2. `./scripts/rebuild.sh` for changes that affect backend, frontend, Docker config, or startup behavior.
  3. `./scripts/up.sh` only when a faster restart is sufficient and a no-cache rebuild is unnecessary.
- After rebuild, verify the stack is reachable before deeper checks:
  - Web UI: `http://localhost:5173`
  - API health: `GET /health`
  - API docs: `http://localhost:8000/docs`
- For backend feature changes, prefer direct API smoke tests with authenticated `curl` calls instead of only checking the UI.
- For backend feature changes, run backend tests locally (`pytest backend/tests -q`) and ensure coverage remains `>= 90%` before finishing.
- For any backend code change, add or update backend unit tests in `backend/tests/` for the touched behavior.
- For new backend features, add integration tests where needed to validate end-to-end behavior.
- For any backend code change, check backend unit-test coverage output and confirm it remains compliant with project thresholds.
- For frontend feature changes, confirm both rendering and the backing API flow when applicable. Do not treat a successful build alone as behavior verification.
- For any frontend code change, run `npm run build` in `frontend/` before finishing.
- For frontend feature changes, add/update unit tests and run the active phase coverage command from `frontend/COVERAGE_ROADMAP.md` (`npm run test:unit:coverage`, `:phase1`, `:phase2`, or `:full`) before finishing.
- For any frontend code change, check the active coverage output and confirm thresholds remain compliant.
- For any new frontend feature, add or update at least one E2E Playwright test in `frontend/tests/` covering the primary happy path.
- When you create temporary smoke-test data such as gardens, beds, crops, or plantings, clean it up before finishing unless the user asked to keep it.
- If a change touches crop templates, planting generation, or ownership-sensitive routes, include at least one smoke test that exercises the changed behavior end to end.
- CI should continue to publish backend coverage in the job summary and artifacts (`backend/coverage.xml`, `backend/htmlcov/`) for review.
- If you could not rebuild or verify behavior, say so explicitly in the final response.

## Frontend unit test requirements per area

### Custom hooks (`features/*/hooks/`)
Every custom hook file must have a co-located `.test.ts(x)` file covering:
- All distinct state transitions (each meaningful `setState` call path)
- Validation logic: blank/invalid inputs produce the correct error message; valid inputs clear errors
- Submit handlers: blocked with errors on invalid input; delegate to the action callback on valid input
- All filter/derived state values (`useMemo`) at the boundary conditions that change output
- Any `useEffect` side effects toggled by prop/state changes
- Callbacks that do nothing when a guard condition is not met (e.g. null ID, null pending state)

### Planner overlay and engine hooks
- `usePlannerOverlayState`: test each `setOverlayPreset` value produces mutual exclusion; test `sunHour` initialisation from `gardenSunPath`; test derived grid dimensions
- `usePlannerRotationPreview`: test `requestRotatePreview` computes swapped dimensions and `fitsCurrent`/`hasBedOverlap` flags; test `confirmRotate` calls `onRotateBed` and clears state; test cancel path via `setPendingRotation(null)`

### Pure computation engines (`features/planner/engine/`)
When adding or modifying an engine function (`shadeMap`, `sunModel`, `growthSim`, `plannerGeometry`, `plannerUtils`), add tests for:
- Null/empty inputs return safe defaults (guard clauses)
- Output values are clamped within their documented range (0–1 for intensities/shade, non-negative for dimensions)
- Placements or beds that reference IDs not in the corresponding map are silently skipped rather than crashing

### Presentational components with conditional branches
When a component has conditional rendering based on props (e.g. `editingCropId`, `direct_sow`, `syncStatus`):
- Test the heading/button label change between add-mode and edit-mode
- Test each field error prop renders the expected error element
- Test each conditional field appearance/disappearance (e.g. weeks-to-transplant hidden when `direct_sow=true`)
- Test `onClick` callbacks on interactive elements (Edit, Delete, Cancel buttons) are invoked with the expected argument
- Test disabled states on buttons during async operations

### Calendar agenda state
- `useCalendarAgendaState` tests must cover all three `taskDoneFilter` states and verify non-task events are never filtered out
- `hasTasks` must be tested for true (task present) and false (no tasks, planting-only, empty) cases
- Every `handleXFieldBlur` must be tested for blank → error and non-blank → cleared-error transitions
- Both submit handlers must be tested: invalid input blocks the action callback; valid input calls it

## E2E test requirements (Playwright)

The E2E suite lives in `frontend/tests/`. When adding a significant new planner or calendar workflow, add a matching spec file:
- **Planner bed lifecycle**: create bed → verify it appears → delete it → verify removal. File: `planner-bed-placement.spec.ts`
- **Planner placement lifecycle**: place a crop in a bed via UI → verify placement chip → remove it → verify chip disappears
- **Calendar task lifecycle** (covered in `calendar-workflow.spec.ts`): add task, filter, complete, delete
- **Crop library lifecycle** (covered in `crop-library.spec.ts`): create, edit-rehydrate
- Any new core product surface (auth screens, seasonal plan panel, sensor CRUD, garden deletion) needs at least one E2E happy-path test before the feature is considered complete
- Any new frontend feature should include at least one E2E happy-path test; new core product surfaces (auth screens, seasonal plan panel, sensor CRUD, garden deletion) are mandatory.