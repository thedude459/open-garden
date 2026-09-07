# Quickstart: Streamline End-to-End Tests

**Feature**: `012-e2e-test-streamline` | **Date**: 2026-09-07

## Prerequisites

- Docker Postgres (or CI service) and `npm run migrate`
- Fixture plants: `npm run api:sync-plants`
- Node.js LTS / npm
- Baseline recorded in `specs/012-e2e-test-streamline/baseline.md` before claiming SC-001

## Local stack (app already running)

```bash
docker compose up -d postgres
npm run migrate
npm run api:sync-plants
# terminal 1
npm run api:serve
# terminal 2 — production config matches the gated job
npx nx serve web --configuration=production --port=4200
```

```bash
npx nx e2e web-e2e                    # browser suite
E2E_LIVE=1 npx nx test api-e2e        # live HTTP (skips without E2E_LIVE)
```

A **single** UI check with the app up must finish in **under two minutes** (SC-005), including session setup.

Convention: `apps/web-e2e/CONVENTION.md`.

## Gated job (same as CI)

```bash
npm run e2e
```

Expect: production web, live HTTP and Playwright together, **no** per-check retry, traces/screenshots only on failure. After the full feature (not US1 alone), wall-clock **&lt; 15 minutes** and **≥40% faster** than `baseline.md`.

## Verify layering (P2)

1. `apps/web-e2e/src` has no `*-api.spec.ts` that never opens a page.
2. Live HTTP files in `apps/api-e2e` skip when `E2E_LIVE` is unset (`npm test` still green).
3. Playwright config has one Chromium project and `retries: 0`.

## Verify isolation (P1)

1. Two UI checks can run in parallel; each uses a different email (no shared gardener except login or admin-identity screens).
2. Pipeline merge (if run) restores `sourceOrder` to fixture; gardener catalog still finds **Cherry Tomato** by name.

## Verify flake bar (P1)

On an unchanged healthy tree, run `npm run e2e` **three** times. All pass with no retried checks. No `waitForTimeout` in `apps/web-e2e`.

## Verify load budgets still fail if broken (P3)

011 checks remain: 20-garden list and 100-placement planner still enforce 2s interactive; assembly 1s still in `api-e2e` when `DATABASE_URL` is set. Setup must seed via API, not a UI loop per garden/placement.

## Out of scope here

Safari/Firefox, changing gardener UX, relaxing 011 budgets. Full product `npm test` coverage gate is unchanged.
