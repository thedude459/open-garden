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
  echo "DATABASE_URL is set — using docker-compose.yml only (deploy / external Postgres)."
  docker compose up --build -d
else
  echo "DATABASE_URL unset — using bundled Postgres + Mailpit (docker-compose.localdb.yml)."
  docker compose -f docker-compose.yml -f docker-compose.localdb.yml up --build -d
fi
