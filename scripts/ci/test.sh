#!/usr/bin/env bash
# Unit tests. CI runs the Vitest coverage gate once (it already executes every
# spec). Locally there is no nx-set-shas base, so run every Nx test target and
# then the same coverage gate. Use `nx affected -t test` for a faster local pass.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  npm run test:coverage
  exit 0
fi

PARALLEL="${NX_PARALLEL:-3}"
npx nx run-many -t test --all --parallel="${PARALLEL}"
npm run test:coverage
