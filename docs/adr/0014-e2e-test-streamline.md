# ADR 0014: Streamlined end-to-end suites

## Status

Accepted

## Context

Spec 012 requires a faster, non-flaky gated e2e job that still covers gardener-facing journeys. Today Playwright registers users through the UI, keeps HTTP-only proofs in the browser runner, retries once on CI, serves the Angular **development** app, and runs `pipeline-*` only after every other Chromium file (`dependencies: ['chromium']`). Traces are `on-first-retry`, which saves nothing if retries are turned off.

## Decision

1. **Session**: Unique user per check via existing `POST /api/auth/register` on the Playwright context (cookie on `:4200`). UI register/login only when that screen is the behavior under test.
2. **Layering**: Request/response-only checks move to `apps/api-e2e` and run when `E2E_LIVE=1`. Zod smokes stay in `npm test`. Gated `nx test api-e2e` uses `--skip-nx-cache` so a skip-mode `npm test` cache cannot stand in for live proofs.
3. **Catalog isolation**: No Playwright pipeline project. Mutating checks use unique plant names and restore `sourceOrder` to `['fixture']`. Live HTTP and Playwright start together after services are ready.
4. **Runtime**: `nx serve web --configuration=production` in `e2e.sh`; `retries: 0`; `trace`/`screenshot` retain on failure. Playwright `serviceWorkers: 'block'` so `page.route` still intercepts `/api` (production SW would otherwise bypass Playwright routes; gardener IndexedDB offline path is unchanged).
5. **Speed**: Record CI wall-clock baseline; ship only if ≥40% faster **and** under 15 minutes.

## Consequences

+ First-try red means a real failure; artifacts still exist without retries.
+ HTTP proofs do not pay browser startup; UI files are not serialized behind pipeline.
+ Unique users avoid cross-check leaks (lists, favorites, sharing).
- Live HTTP is skipped in the unit `test` job (must run `e2e` to execute it).
- Global catalog remains one table; isolation is naming + restore, not a second database.
- `apps/web-e2e/src/pipeline-helpers.ts` stays for pipeline **UI** idle waits; HTTP pipeline proofs live in `api-e2e`.
- CI worker count stays 2 until a post-baseline measurement says otherwise.
