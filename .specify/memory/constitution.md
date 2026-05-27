<!--
Sync Impact Report
Version change: (template) → 1.0.0
Modified principles: N/A (initial ratification)
Added sections: Core Principles (5), Technology Stack & Deployment,
  Spec-Driven Workflow & Quality Gates, Governance
Removed sections: None
Templates:
  - .specify/templates/plan-template.md — ✅ updated (Constitution Check gates)
  - .specify/templates/spec-template.md — ✅ no change required
  - .specify/templates/tasks-template.md — ✅ updated (path conventions)
  - .specify/templates/constitution-template.md — ⚠ unchanged (generic template retained)
Follow-up TODOs: None
-->

# Open Garden Constitution

## Core Principles

### I. Domain-Aligned Backend

Every backend change MUST keep `backend/app/models.py`, `backend/app/schemas.py`,
and the relevant domain routers in `backend/app/routers/` in sync.

Route handlers MUST stay thin: validate input, delegate to
`backend/app/services/`, return Pydantic response models. Reuse ownership and
authorization helpers from `backend/app/core/dependencies.py` instead of
duplicating query + 404/403 logic. New routers MUST be registered in
`backend/app/routers/__init__.py` and included from `backend/app/main.py`.

**Rationale**: Consistent layering prevents schema drift, authorization bugs,
and bloated handlers that are hard to test or extend.

### II. Feature-Modular Frontend

`frontend/src/App.tsx` MUST remain composition and orchestration only. Feature
logic lives under `frontend/src/features/**`, with shared app hooks in
`frontend/src/features/app/hooks/`. Use fetch-based API calls; do not introduce
a new global state-management layer without explicit approval in the
implementation plan.

Once a feature exceeds roughly eight files, organize by concern: `hooks/`,
`utils/`, and named component subdirectories (see `app/`, `planner/`, and
`calendar/` as reference). CSS changes MUST follow `frontend/src/styles.css`
patterns with minimal visual churn outside the requested area.

**Rationale**: The planner and calendar are core product surfaces; modular
features keep those workflows maintainable as the app grows.

### III. Data Integrity & Compatibility (NON-NEGOTIABLE)

Every persisted schema change MUST include an Alembic migration in
`backend/alembic/versions/`. If a field is added without Alembic, also update
startup DDL in `backend/app/main.py` so existing databases start cleanly.

Crop template or seed changes MUST update `backend/app/seed.py` and preserve
compatibility with existing plantings, placements, and auto-generated tasks.
Use UTC-aware datetimes (`DateTime(timezone=True)` with UTC defaults) for
persisted timestamps.

**Rationale**: Garden data is long-lived; breaking plantings or tasks destroys
user trust and is costly to repair.

### IV. Garden Planning UX First

Prefer improvements to calendar, planner, and task/weather workflows over
disconnected CRUD screens. Destructive user actions MUST be explicit and
confirmed in the UI. Features that touch layout, spacing, or planting guidance
MUST respect crop-template-driven behavior.

**Rationale**: The product value is planning and execution in the garden, not
generic data administration.

### V. Operational Discipline

Use structured logging via `backend/app/logging_utils.py`; avoid bare
`print()`. Use typed domain exceptions from `backend/app/exceptions.py`. Apply
rate limiting via `backend/app/core/rate_limit.py` for new sensitive or
abusable endpoints. Do not catch broad `Exception` unless re-raising with
context and logging.

Validate behavior with targeted smoke checks or API exercises after rebuild
when changing user-visible flows. Backend tests live in `backend/tests/` and
SHOULD run via `pytest` inside the Docker stack when behavior changes warrant
automated coverage.

**Rationale**: Observable, bounded APIs and verifiable changes keep a
self-hosted Docker deployment supportable.

## Technology Stack & Deployment

This project is a Dockerized **FastAPI + React + PostgreSQL** application.

- Local dev: `cp .env.example .env`, then `./scripts/rebuild.sh` or `./scripts/up.sh`.
- `DATABASE_URL` unset merges `docker-compose.localdb.yml` (bundled Postgres +
  Mailpit); set `DATABASE_URL` for deploy-style compose against external Postgres.
- Computation engines live in `backend/app/engines/`; cross-cutting code in
  `backend/app/core/`; business logic in `backend/app/services/`.
- Frontend build: `cd frontend && npm run build` (or project wrapper scripts if
  `npm_config_devdir` warnings appear).

Features MUST NOT introduce stack replacements (alternate ORMs, state
libraries, or databases) without a documented constitution amendment and
migration plan.

## Spec-Driven Workflow & Quality Gates

Spec Kit features live under `specs/[###-feature-name]/` with `spec.md`,
`plan.md`, and `tasks.md` produced by the `/speckit-*` commands.

Before Phase 0 research and again after Phase 1 design, the implementation plan
MUST pass the **Constitution Check** gates (see plan template). Any violation
MUST be recorded in the plan’s Complexity Tracking table with justification.

Runtime development guidance for agents and contributors is authoritative in
`AGENTS.md` (mirrored in `.github/copilot-instructions.md`) and `README.md` for
deploy, backup, and environment setup. When `AGENTS.md` and this constitution
conflict, this constitution wins; update `AGENTS.md` when amending principles
that affect day-to-day coding.

## Governance

This constitution supersedes ad-hoc conventions for Spec Kit–driven feature
work. Amendments MUST:

1. Update `.specify/memory/constitution.md` with a Sync Impact Report comment.
2. Bump `CONSTITUTION_VERSION` per semantic versioning:
   - **MAJOR**: Principle removal or backward-incompatible governance change.
   - **MINOR**: New principle or materially expanded guidance.
   - **PATCH**: Clarifications and non-semantic wording fixes.
3. Propagate required changes to `.specify/templates/*` and `AGENTS.md` when
   principles affect implementation or review expectations.
4. Set `LAST_AMENDED_DATE` to the amendment date (ISO `YYYY-MM-DD`).

Compliance review: every feature `plan.md` Constitution Check and every PR
touching backend models, migrations, planner/calendar UX, or crop templates MUST
explicitly confirm adherence or document justified exceptions.

**Version**: 1.0.0 | **Ratified**: 2026-05-27 | **Last Amended**: 2026-05-27
