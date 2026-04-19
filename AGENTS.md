# Project Guidelines

This file is always read by AI agents working in this repo. It mirrors `.github/copilot-instructions.md` so guidance stays consistent across tools. Scoped rules live in `.cursor/rules/` and shared skills in `.cursor/skills/` (symlinked to `.github/skills/`).

## Code Style

- Keep backend changes aligned across `backend/app/models.py`, `backend/app/schemas.py`, and the domain routers in `backend/app/routers/`.
- Follow existing backend patterns: SQLAlchemy 2 `Mapped[...]` models, Pydantic v2 schemas with `ConfigDict(from_attributes=True)`, and FastAPI dependency injection with `Depends(...)`.
- Follow existing frontend patterns: `frontend/src/App.tsx` as composition/orchestration, feature logic in `frontend/src/features/**`, shared app hooks in `frontend/src/features/app/hooks/`, and straightforward fetch-based API calls rather than adding a new state-management layer.
- Within each feature directory, use subdirectories by concern once a feature grows beyond ~8 files: `hooks/` for React hooks, `utils/` for pure helpers, and named component subdirs (e.g. `bed/`, `yard/`, `engine/`). The `app/`, `planner/`, and `calendar/` features are the reference model.
- Keep CSS changes consistent with `frontend/src/styles.css`: responsive grid/flex layouts, shared utility classes, and minimal visual churn outside the requested area.

## Architecture

- This is a Dockerized FastAPI + React + PostgreSQL app for garden planning.
- Backend API routes live in domain routers under `backend/app/routers/` (auth, crops, gardens, insights, planner, sensors, tasks, admin). `backend/app/main.py` contains only app bootstrap, middleware, lifespan, and health/weather endpoints.
- Cross-cutting infrastructure lives in `backend/app/core/`: `auth`, `dependencies`, `exceptions`, `logging_utils`, `rate_limit`.
- Computation engines live in `backend/app/engines/` (`climate`, `layout`, `timeline`) alongside domain packages (`ai_coach/`, `planning_engine/`, `sensors/`).
- Business logic and background jobs live in `backend/app/services/` (including `seed.py` for crop sync).
- Shared ownership authorization helpers live in `backend/app/core/dependencies.py`. Reuse these instead of duplicating query + 404/403 logic.
- Rate limiting utilities live in `backend/app/core/rate_limit.py`. Use `enforce_rate_limit` / `global_rate_limit_hit` rather than duplicating bucket logic.
- The frontend uses `frontend/src/App.tsx` as the top-level shell with tabs for calendar, planner, and weather/task workflows; implementation details should live in focused feature modules/hooks.
- Crop templates drive spacing, planting guidance, and auto-generated task creation. When changing crop data behavior, preserve compatibility with existing plantings, placements, and generated tasks.

## Backend Coding Practices

- Keep route handlers thin: validate input, delegate to services, return response models.
- Use `backend/app/services/` for stateful or reusable business logic.
- Use `backend/app/exceptions.py` typed exceptions for domain errors.
- Use `backend/app/logging_utils.py` structured logging; avoid bare `print()`.
- Use UTC-aware datetimes for persisted timestamps (`DateTime(timezone=True)` + UTC defaults).
- Every schema or model change must include an Alembic migration in `backend/alembic/versions/`.
- Do not catch broad `Exception` unless re-raising with context and logging.
- New routers should be registered in `backend/app/routers/__init__.py` and included in `main.py`.
- Use `asynccontextmanager` lifespan (not deprecated `@app.on_event`) for startup/shutdown logic.

## Build And Test

- First-time setup: `cp .env.example .env` from the repo root.
- Preferred full-stack rebuild: `./scripts/rebuild.sh`.
- Fast restart (no rebuild needed): `./scripts/up.sh`.
- Frontend-only build: `cd frontend && npm run build`. If npm warns about unknown `devdir` (some environments set `npm_config_devdir`), use `cd frontend && node ./scripts/run-frontend.mjs build` instead, or `frontend/scripts/npm-without-devdir.sh run build`.
- Backend tests live in `backend/tests/`. Run with `pytest backend/tests/` inside the Docker container.
- For behavior changes, prefer targeted smoke checks against the running app or API after rebuilding.
- When running the stack locally, bring it up with both compose files: `docker compose -f docker-compose.yml -f docker-compose.localdb.yml up -d` (otherwise `DATABASE_URL` is empty and the API fails to boot).

## Conventions

- The Docker scripts switch behavior based on `DATABASE_URL` in `.env`: empty means local Postgres via `docker-compose.localdb.yml`, set means external Postgres.
- If a backend schema field is added without Alembic, also update the startup DDL in `backend/app/main.py` so existing databases can start cleanly.
- If crop template fields change, update seed data in `backend/app/seed.py` and preserve existing user data where possible.
- Garden planning UX is a core product surface. Prefer improving the calendar/planner workflows over adding disconnected CRUD screens.
- Keep user-facing destructive actions explicit and confirmed in the UI.
- See `README.md` for deployment, backup, and local run details.
