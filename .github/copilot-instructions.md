# Project Guidelines

## Code Style

- Keep backend changes aligned across [backend/app/models.py](/Users/matthewsavage/projects/garden-app/backend/app/models.py), [backend/app/schemas.py](/Users/matthewsavage/projects/garden-app/backend/app/schemas.py), and the route handlers in [backend/app/main.py](/Users/matthewsavage/projects/garden-app/backend/app/main.py).
- Follow existing backend patterns: SQLAlchemy 2 `Mapped[...]` models, Pydantic v2 schemas with `ConfigDict(from_attributes=True)`, and FastAPI dependency injection with `Depends(...)`.
- Follow existing frontend patterns in [frontend/src/App.tsx](/Users/matthewsavage/projects/garden-app/frontend/src/App.tsx): inline TypeScript domain types, React hooks, and straightforward fetch-based API calls rather than adding a new state-management layer.
- Keep CSS changes consistent with [frontend/src/styles.css](/Users/matthewsavage/projects/garden-app/frontend/src/styles.css): responsive grid/flex layouts, shared utility classes, and minimal visual churn outside the requested area.

## Architecture

- This is a Dockerized FastAPI + React + PostgreSQL app for garden planning.
- Backend API routes are centralized in [backend/app/main.py](/Users/matthewsavage/projects/garden-app/backend/app/main.py); avoid scattering route logic into new modules unless the task clearly justifies it.
- The frontend is currently centered in [frontend/src/App.tsx](/Users/matthewsavage/projects/garden-app/frontend/src/App.tsx) with tabs for calendar, planner, and weather/task workflows.
- Crop templates drive spacing, planting guidance, and auto-generated task creation. When changing crop data behavior, preserve compatibility with existing plantings, placements, and generated tasks.

## Build And Test

- First-time setup uses `cp .env.example .env` from the repo root.
- Preferred full-stack rebuild command: `./scripts/rebuild.sh`.
- Preferred fast startup command when rebuilds are unnecessary: `./scripts/up.sh`.
- Frontend-only build command: `cd frontend && npm run build`.
- There is no formal automated test suite in the repo yet. For behavior changes, prefer targeted smoke checks against the running app or API after rebuilding.

## Conventions

- The Docker scripts switch behavior based on `DATABASE_URL` in `.env`: empty means local Postgres via `docker-compose.localdb.yml`, set means external Postgres.
- If a backend schema field is added without Alembic, also update the startup DDL in [backend/app/main.py](/Users/matthewsavage/projects/garden-app/backend/app/main.py) so existing databases can start cleanly.
- If crop template fields change, update seed data in [backend/app/seed.py](/Users/matthewsavage/projects/garden-app/backend/app/seed.py) and preserve existing user data where possible.
- Garden planning UX is a core product surface. Prefer improving the calendar/planner workflows over adding disconnected CRUD screens.
- Keep user-facing destructive actions explicit and confirmed in the UI.
- See [README.md](/Users/matthewsavage/projects/garden-app/README.md) for deployment, backup, and local run details.