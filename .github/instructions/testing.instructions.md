---
description: "Use when testing, validating, smoke checking, rebuilding containers, verifying API behavior, or confirming frontend/backend changes in this Dockerized garden app. Covers rebuild workflow and practical smoke-test expectations when no formal test suite exists."
name: "Garden Testing"
applyTo: "backend/app/**/*.py, frontend/src/**/*.{ts,tsx,css}, scripts/**/*.sh"
---

# Testing Guidelines

- There is no formal automated test suite in this repo yet. For behavior changes, prefer targeted smoke checks over claiming full test coverage.
- Default full-stack validation flow is:
  1. `cp .env.example .env` if `.env` does not exist.
  2. `./scripts/rebuild.sh` for changes that affect backend, frontend, Docker config, or startup behavior.
  3. `./scripts/up.sh` only when a faster restart is sufficient and a no-cache rebuild is unnecessary.
- After rebuild, verify the stack is reachable before deeper checks:
  - Web UI: `http://localhost:5173`
  - API health: `GET /health`
  - API docs: `http://localhost:8000/docs`
- For backend feature changes, prefer direct API smoke tests with authenticated `curl` calls instead of only checking the UI.
- For frontend feature changes, confirm both rendering and the backing API flow when applicable. Do not treat a successful build alone as behavior verification.
- When you create temporary smoke-test data such as gardens, beds, crops, or plantings, clean it up before finishing unless the user asked to keep it.
- If a change touches crop templates, planting generation, or ownership-sensitive routes, include at least one smoke test that exercises the changed behavior end to end.
- If you could not rebuild or verify behavior, say so explicitly in the final response.