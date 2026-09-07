# Gated e2e job contract

**Feature**: `012-e2e-test-streamline`

The merge-gate `e2e` job (`scripts/ci/e2e.sh`, invoked from `.github/workflows/ci.yml`).

## Process

1. Postgres reachable (`DATABASE_URL` as today).
2. `npx nx run api:sync-plants` (fixture catalog).
3. API on `:3000` (`tsx apps/api/src/main.ts`).
4. Web on `:4200` via **`nx serve web --configuration=production`** (existing `/api` proxy). Not development live-reload.
5. Ready: web `200`, `GET /api/plants` on `:3000` and on `:4200/api/plants` both `401`. Poll HTTP codes; do not sleep a guessed interval then assume ready.
6. Start **in parallel**: `E2E_LIVE=1` Vitest `api-e2e` (live HTTP) **and** `nx e2e web-e2e`. Job fails if either fails.

## Playwright config (gated)

| Setting | Value |
|---------|--------|
| `retries` | `0` |
| `trace` | `retain-on-failure` |
| `screenshot` | `only-on-failure` |
| Projects | Single Chromium; `fullyParallel: true` |
| CI workers | `2` (current; change only after baseline if measured) |

A failing check fails the job on the **first** try. Artifacts must still be retained.

## Speed bars (both)

| Bar | Rule |
|-----|------|
| SC-001 | Wall-clock of this script (start through both suites) ≥40% below `specs/012-e2e-test-streamline/baseline.md` |
| SC-002 | Same wall-clock &lt; 15 minutes. If baseline is already &lt; 15 minutes, SC-001 still applies; 15 minutes remains the ceiling |

`baseline.md` is the pre-change duration of this job on the standard runner, recorded at implement start.

## Unchanged

- `timeout-minutes: 30` on the workflow job (headroom, not the success bar)
- `PLANT_PROVIDER=fixture`, `SESSION_SECRET` as today
- Unit `test` job does **not** set `E2E_LIVE`; live HTTP specs skip
