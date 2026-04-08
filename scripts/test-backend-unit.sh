#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI not found. Install Docker Desktop (or another Docker engine) first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop (or your Docker engine), then retry."
  exit 1
fi

PIP_CACHE_DIR_HOST="${HOME:-/tmp}/.cache/pip"
mkdir -p "$PIP_CACHE_DIR_HOST"

DOCKER_RUN_ARGS=(
  --rm
  --user "$(id -u):$(id -g)"
  --volume "$ROOT_DIR:/workspace"
  --volume "$PIP_CACHE_DIR_HOST:/tmp/pip-cache"
  --env PIP_CACHE_DIR=/tmp/pip-cache
  --env PIP_DISABLE_PIP_VERSION_CHECK=1
  --env DATABASE_URL=sqlite+pysqlite:///tmp/open-garden-tests.db
  --env RANDOMLY_SEED="${RANDOMLY_SEED:-20260405}"
  --workdir /workspace
)

TEST_CMD='python -m venv /tmp/venv \
  && /tmp/venv/bin/pip install -r backend/requirements.txt \
  && /tmp/venv/bin/pip install pytest-randomly==3.16.0 \
  && echo "Running backend unit tests with randomized order seed: ${RANDOMLY_SEED}" \
  && /tmp/venv/bin/pytest backend/tests -q -m "unit" --randomly-seed="${RANDOMLY_SEED}" -o addopts="" --cov=app --cov-branch --cov-report=term-missing --cov-report=xml:backend/coverage-unit.xml --cov-fail-under=90'

docker run "${DOCKER_RUN_ARGS[@]}" python:3.12-slim bash -lc "$TEST_CMD"
