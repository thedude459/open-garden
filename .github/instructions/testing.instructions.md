---
description: "Use when testing, validating, smoke checking, rebuilding containers, verifying API behavior, or confirming frontend/backend changes in this Dockerized garden app. Covers rebuild workflow and practical smoke-test expectations when no formal test suite exists."
name: "Garden Testing"
applyTo: "backend/app/**/*.py, frontend/src/**/*.{ts,tsx,css}, scripts/**/*.sh"
---

# Testing Guidelines

- This repo has an automated backend unit test suite. Backend changes should include or update unit tests when behavior changes.
- Backend coverage policy: keep total backend coverage at `>= 90%` (matching `pytest.ini` / CI gate). Do not merge backend feature work that drops this threshold.
- Frontend coverage policy: keep total frontend unit-test coverage at `>= 90%` and enforce it via CI coverage thresholds.
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
- For frontend feature changes, confirm both rendering and the backing API flow when applicable. Do not treat a successful build alone as behavior verification.
- For frontend feature changes, add/update unit tests and run frontend coverage locally (`npm run test:unit -- --coverage`) before finishing.
- When you create temporary smoke-test data such as gardens, beds, crops, or plantings, clean it up before finishing unless the user asked to keep it.
- If a change touches crop templates, planting generation, or ownership-sensitive routes, include at least one smoke test that exercises the changed behavior end to end.
- CI should continue to publish backend coverage in the job summary and artifacts (`backend/coverage.xml`, `backend/htmlcov/`) for review.
- If you could not rebuild or verify behavior, say so explicitly in the final response.