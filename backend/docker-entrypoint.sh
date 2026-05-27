#!/bin/sh
set -eu
cd /app

# Run migrations exactly once before uvicorn forks worker processes. Lifespan runs per worker;
# parallel alembic upgrades from multiple workers reliably deadlock or crash (migration replay loop).
#
# Fresh Postgres (CI e2e, new volume): bootstrap ORM tables first, matching
# backend/tests/test_migrations_smoke.py — early Alembic revisions only ALTER existing tables.
python - <<'PY'
from sqlalchemy import inspect

from app.database import engine
from app.models import Base  # noqa: F401 — registers tables on Base.metadata

if engine.dialect.name == "postgresql":
    if not inspect(engine).has_table("users"):
        Base.metadata.create_all(bind=engine)
PY

alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WEB_CONCURRENCY:-1}"
