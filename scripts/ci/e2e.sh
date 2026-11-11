#!/usr/bin/env bash
# CI `e2e` job: Postgres + seed + API + production web + live api-e2e HTTP + Playwright Chromium.
# GitHub Actions supplies Postgres as a service; locally this script starts
# docker compose `postgres` when port 5432 is not already accepting connections.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# Own database so test data never lands in the one the Docker app uses.
export DATABASE_URL="${DATABASE_URL:-postgresql://open_garden:open_garden@localhost:5432/open_garden_e2e}"
export SEED_DEMO_USERS="${SEED_DEMO_USERS:-true}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:4200}"
export PLACE_PROVIDER="${PLACE_PROVIDER:-fixture}"
export CI="${CI:-true}"

API_PID=""
WEB_PID=""

cleanup() {
  if [[ -n "${WEB_PID}" ]]; then
    pkill -P "${WEB_PID}" 2>/dev/null || true
    kill "${WEB_PID}" 2>/dev/null || true
  fi
  if [[ -n "${API_PID}" ]]; then
    pkill -P "${API_PID}" 2>/dev/null || true
    kill "${API_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

port_open() {
  local port="$1"
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "${port}" >/dev/null 2>&1
  else
    bash -c "echo >/dev/tcp/127.0.0.1/${port}" >/dev/null 2>&1
  fi
}

docker_ready() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

start_docker() {
  local os
  os="$(uname -s)"
  case "${os}" in
    Darwin)
      echo "Starting Docker Desktop"
      open -a Docker
      ;;
    Linux)
      if command -v systemctl >/dev/null 2>&1 && systemctl start docker >/dev/null 2>&1; then
        echo "Started docker via systemctl"
      elif command -v sudo >/dev/null 2>&1 && sudo -n systemctl start docker >/dev/null 2>&1; then
        echo "Started docker via sudo systemctl"
      else
        echo "Could not start the Docker daemon automatically. Start Docker and re-run."
        exit 1
      fi
      ;;
    *)
      echo "Start Docker manually on ${os}, then re-run."
      exit 1
      ;;
  esac
}

ensure_docker() {
  # Only start Docker for local e2e. CI provides a Postgres service and must
  # not launch Docker Desktop / the host daemon.
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    return 0
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker CLI not found. Install Docker Desktop and re-run."
    exit 1
  fi
  if docker_ready; then
    echo "Docker is running"
    return 0
  fi
  start_docker
  echo "Waiting for Docker to become ready"
  for _ in $(seq 1 60); do
    if docker_ready; then
      echo "Docker is ready"
      return 0
    fi
    sleep 2
  done
  echo "Docker did not become ready"
  exit 1
}

ensure_postgres() {
  if port_open 5432; then
    echo "Postgres already listening on :5432"
    return 0
  fi
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    echo "Postgres is not reachable on :5432 in GitHub Actions"
    exit 1
  fi
  echo "Starting Postgres via docker compose"
  docker compose up -d postgres
  for _ in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U open_garden -d open_garden >/dev/null 2>&1; then
      echo "Postgres is ready"
      return 0
    fi
    sleep 1
  done
  echo "Postgres did not become ready"
  exit 1
}

wait_for_services() {
  local web api proxy
  for _ in $(seq 1 90); do
    web="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4200 || true)"
    api="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/plants || true)"
    proxy="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/api/plants || true)"
    if [[ "${web}" == "200" && "${api}" == "401" && "${proxy}" == "401" ]]; then
      echo "Services ready (web=${web} api=${api} proxy=${proxy})"
      return 0
    fi
    sleep 2
  done
  echo "Services did not become ready (web=${web:-?} api=${api:-?} proxy=${proxy:-?})"
  exit 1
}

if ! port_open 5432; then
  ensure_docker
fi
ensure_postgres

if [[ "$(uname -s)" == "Linux" ]]; then
  npx playwright install --with-deps chromium
else
  npx playwright install chromium
fi

node scripts/ci/ensure-database.js
npx nx run api:sync-plants

# Run the API from the same esbuild bundle the Docker image ships.
node scripts/docker/build-api.mjs >/dev/null
API_ENV=(PORT=3000)
API_NODE_ARGS=(--enable-source-maps)
if [[ "${E2E_COVERAGE:-}" == "1" ]]; then
  # Record which API code the live HTTP and Playwright suites exercise.
  rm -rf coverage/e2e
  mkdir -p coverage/e2e/v8
  API_ENV+=("NODE_V8_COVERAGE=${ROOT}/coverage/e2e/v8")
  API_NODE_ARGS+=(--import ./scripts/ci/coverage-flush.mjs)
fi
env "${API_ENV[@]}" node "${API_NODE_ARGS[@]}" dist/api-runtime/main.js &
API_PID=$!

PORT=4200 npx nx serve web --configuration=production --host=0.0.0.0 --port=4200 &
WEB_PID=$!

wait_for_services
# One Postgres and one pipeline lock. Live HTTP and Playwright share both,
# so they run one after the other.
LIVE_STATUS=0
PW_STATUS=0
E2E_LIVE=1 npx nx test api-e2e --skip-nx-cache || LIVE_STATUS=$?
# Kills the API's database connections, so it runs alone after the other live specs.
E2E_LIVE=1 E2E_DB_RECONNECT=1 npx vitest run --config vitest.config.ts \
  apps/api-e2e/src/db-reconnect-http.spec.ts || LIVE_STATUS=$?
npx nx e2e web-e2e || PW_STATUS=$?
if [[ "${E2E_COVERAGE:-}" == "1" ]]; then
  # Stop the API cleanly so Node writes its coverage, then map it to the sources.
  kill -TERM "${API_PID}" 2>/dev/null || true
  wait "${API_PID}" 2>/dev/null || true
  API_PID=""
  node scripts/ci/coverage-e2e.mjs coverage/e2e/v8 coverage/e2e/coverage-final.json || true
fi
if [[ "${LIVE_STATUS}" -ne 0 || "${PW_STATUS}" -ne 0 ]]; then
  echo "e2e failed (live HTTP=${LIVE_STATUS} playwright=${PW_STATUS})"
  exit 1
fi
