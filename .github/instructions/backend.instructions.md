---
description: "Use when editing FastAPI routes, Python backend files, garden models, crop templates, planting tasks, schemas, SQLAlchemy models, startup DDL, or API behavior in backend/app. Covers model-schema-route alignment and migration-safe changes."
name: "Garden Backend"
applyTo: "backend/app/**/*.py"
---

# Backend Guidelines

- Keep backend changes aligned across `backend/app/models.py`, `backend/app/schemas.py`, routers under `backend/app/routers/`, and app wiring in `backend/app/main.py`.
- Follow existing style: SQLAlchemy 2 `Mapped[...]` models, Pydantic v2 schemas with `ConfigDict(from_attributes=True)`, and FastAPI dependency injection with `Depends(...)`.
- Prefer modular API design:
	- Keep route handlers in domain routers (`backend/app/routers/*.py`).
	- Keep business logic in service modules (`backend/app/services/*.py`).
	- Keep cross-cutting infrastructure in `backend/app/core/` (`auth`, `dependencies`, `exceptions`, `logging_utils`, `rate_limit`).
	- Keep computation engines in `backend/app/engines/` (`climate`, `layout`, `timeline`) alongside existing packages (`ai_coach/`, `planning_engine/`, `sensors/`).
	- Keep `main.py` focused on app bootstrap, middleware, lifespan, and router registration.
- Keep route handlers thin. Validate input, delegate to services, and return response models. Avoid embedding long business workflows in route functions.
- Reuse ownership dependencies from `backend/app/dependencies.py` for garden/bed/placement/task authorization checks instead of duplicating query + 404/403 blocks.
- Use rate limiting utilities from `backend/app/rate_limit.py` (`enforce_rate_limit`, `global_rate_limit_hit`) rather than duplicating bucket logic.
- Use `asynccontextmanager` lifespan (not deprecated `@app.on_event`) for startup/shutdown logic.
- Use explicit exception handling for integrations (for example `httpx.RequestError`, `httpx.HTTPStatusError`, `ValueError`). Avoid broad `except Exception` unless re-raising with context and logging.
- Use structured logging (see `backend/app/logging_utils.py`); avoid `print(...)` for operational events.
- Use UTC-aware datetimes for persisted timestamps (`DateTime(timezone=True)` + UTC defaults).
- Enforce invariants at the database layer with constraints/indexes (for example unique placement coordinates), then translate `IntegrityError` to clear API errors.
- Every persisted model/schema change must include an Alembic migration in `backend/alembic/versions/`. Do not rely on implicit startup DDL as the primary migration path.
- Keep startup behavior deployment-safe:
	- Production should rely on Alembic-managed schema evolution.
	- Any startup fallback behavior must be deterministic, minimal, and compatible with local dev.
- For background jobs and sync workflows, store state durably (database-backed) rather than process-local globals so status survives restarts and multi-worker setups.
- If crop template behavior changes, update `backend/app/seed.py` and preserve compatibility with existing placements, plantings, and generated tasks.
- Prefer root-cause fixes for API mismatches instead of frontend-only workarounds.
- New routers must be registered in `backend/app/routers/__init__.py` and included in `backend/app/main.py`.
- Testing expectations for backend changes:
	- Add or update targeted backend tests in `backend/tests/` for ownership checks, service logic, and route behavior.
	- For endpoint changes, cover at least one success path and one auth/validation failure path.