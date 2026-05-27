#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env. Run: cp .env.example .env"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI not found. Install Docker Desktop or another Docker engine first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop (or your Docker engine), then retry."
  exit 1
fi

set -a
source .env
set +a

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is set — rebuilding docker-compose.yml only (deploy / external Postgres)."
  docker compose build --no-cache api web
  docker compose up -d
else
  echo "DATABASE_URL unset — rebuilding with bundled Postgres + Mailpit."
  docker compose -f docker-compose.yml -f docker-compose.localdb.yml build --no-cache api web
  docker compose -f docker-compose.yml -f docker-compose.localdb.yml up -d
fi

echo "Rebuild and startup complete."
