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
  echo "Detected DATABASE_URL in .env. Rebuilding app images against external PostgreSQL mode."
  docker compose build --no-cache api web
  docker compose up -d
else
  echo "No DATABASE_URL detected. Rebuilding app images and starting local PostgreSQL mode."
  docker compose -f docker-compose.yml -f docker-compose.localdb.yml build --no-cache api web
  docker compose -f docker-compose.yml -f docker-compose.localdb.yml up -d
fi

echo "Rebuild and startup complete."