#!/usr/bin/env bash
# CI `test` job: Nx affected unit tests, then Vitest coverage gate (≥80%).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PARALLEL="${NX_PARALLEL:-3}"

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  npx nx affected -t test --parallel="${PARALLEL}"
else
  # Local runs have no nx-set-shas; test every project so nothing is skipped.
  npx nx run-many -t test --all --parallel="${PARALLEL}"
fi

npm run test:coverage
