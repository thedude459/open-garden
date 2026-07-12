#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for e2e:db:ensure (see specs/005-e2e-test-coverage/quickstart.md)" >&2
  exit 1
fi

echo "Starting Postgres via docker compose…"
docker compose up -d postgres --wait

echo "Ensuring garden_e2e database exists…"
exists="$(
  docker compose exec -T postgres \
    psql -U garden -d garden -tAc "SELECT 1 FROM pg_database WHERE datname = 'garden_e2e'"
)"

if [[ "${exists//[[:space:]]/}" != "1" ]]; then
  docker compose exec -T postgres \
    psql -U garden -d garden -c "CREATE DATABASE garden_e2e;"
  echo "Created database garden_e2e"
else
  echo "Database garden_e2e already exists"
fi

echo "E2E database ready at postgres://garden:garden@localhost:5432/garden_e2e"
