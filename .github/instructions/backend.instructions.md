---
description: "Use when editing FastAPI routes, Python backend files, garden models, crop templates, planting tasks, schemas, SQLAlchemy models, startup DDL, or API behavior in backend/app. Covers model-schema-route alignment and migration-safe changes."
name: "Garden Backend"
applyTo: "backend/app/**/*.py"
---

# Backend Guidelines

- Keep backend changes aligned across [backend/app/models.py](/Users/matthewsavage/projects/garden-app/backend/app/models.py), [backend/app/schemas.py](/Users/matthewsavage/projects/garden-app/backend/app/schemas.py), and the route handlers in [backend/app/main.py](/Users/matthewsavage/projects/garden-app/backend/app/main.py).
- Follow the existing backend style: SQLAlchemy 2 `Mapped[...]` models, Pydantic v2 schemas with `ConfigDict(from_attributes=True)`, and FastAPI dependency injection with `Depends(...)`.
- Route logic stays centralized in [backend/app/main.py](/Users/matthewsavage/projects/garden-app/backend/app/main.py) unless there is a strong reason to split it.
- If you add or rename persisted fields without Alembic, update the startup DDL in [backend/app/main.py](/Users/matthewsavage/projects/garden-app/backend/app/main.py) so existing databases can boot cleanly.
- If crop template behavior changes, update [backend/app/seed.py](/Users/matthewsavage/projects/garden-app/backend/app/seed.py) and preserve compatibility with existing placements, plantings, and generated tasks.
- Prefer root-cause fixes for API mismatches instead of frontend-only workarounds.
- For ownership-sensitive data such as gardens, beds, placements, and tasks, preserve the current explicit ownership checks before mutating records.