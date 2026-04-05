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
  && echo "Running unit tests (phase 1/2)..." \
  && echo "Using pytest-randomly seed: ${RANDOMLY_SEED}" \
  && /tmp/venv/bin/pytest backend/tests -q -m "unit" --randomly-seed="${RANDOMLY_SEED}" -o addopts="" --cov=app --cov-branch --cov-report= --cov-fail-under=0 \
  && echo "Running integration tests (phase 2/2)..." \
  && /tmp/venv/bin/pytest backend/tests -q -m "integration" --randomly-seed="${RANDOMLY_SEED}" -o addopts="" --cov=app --cov-branch --cov-append --cov-report=term-missing --cov-report=xml:backend/coverage.xml --cov-report=html:backend/htmlcov --cov-fail-under=90 \
  && /tmp/venv/bin/python - <<"PY"
import re
from pathlib import Path

branch_min = 86.0
content = Path("backend/coverage.xml").read_text(encoding="utf-8")
match = re.search(r"branch-rate=\"([0-9.]+)\"", content)
if not match:
    raise SystemExit("Could not parse branch-rate from backend/coverage.xml")
branch_pct = float(match.group(1)) * 100
print(f"Backend branch coverage: {branch_pct:.2f}%")
if branch_pct < branch_min:
    raise SystemExit(
        f"Backend branch coverage {branch_pct:.2f}% is below required {branch_min:.2f}%"
    )
PY'

docker run "${DOCKER_RUN_ARGS[@]}" python:3.12-slim bash -lc "$TEST_CMD"
