#!/usr/bin/env bash
# CI `e2e` job: Postgres + seed + API + web + Playwright Chromium.
# GitHub Actions supplies Postgres as a service; locally this script starts
# docker compose `postgres` when port 5432 is not already accepting connections.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgresql://open_garden:open_garden@localhost:5432/open_garden}"
export SESSION_SECRET="${SESSION_SECRET:-ci-session-secret}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:4200}"
export PLANT_PROVIDER="${PLANT_PROVIDER:-fixture}"
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

ensure_docker
ensure_postgres

if [[ "$(uname -s)" == "Linux" ]]; then
  npx playwright install --with-deps chromium
else
  npx playwright install chromium
fi

npx nx run api:sync-plants

PORT=3000 npx tsx apps/api/src/main.ts &
API_PID=$!

PORT=4200 npx nx serve web --host=0.0.0.0 --port=4200 &
WEB_PID=$!

wait_for_services
npx nx e2e web-e2e
