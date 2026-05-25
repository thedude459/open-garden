#!/bin/sh
set -eu
cd /app

# Run migrations exactly once before uvicorn forks worker processes. Lifespan runs per worker;
# parallel alembic upgrades from multiple workers reliably deadlock or crash (migration replay loop).
alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WEB_CONCURRENCY:-1}"
