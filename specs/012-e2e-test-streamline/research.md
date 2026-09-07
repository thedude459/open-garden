# Research: Streamline End-to-End Tests

**Feature**: `012-e2e-test-streamline` | **Date**: 2026-09-07

## 1. Prepared session (unique user, no registration screen)

**Decision**: Each browser check that is not about registration or login creates its own user with `POST /api/auth/register` on the Playwright **browser context** `request` (proxied `/api` on `:4200`) so the `og_session` cookie lands on the same origin as the page. Then `context.newPage()` opens the app already signed in. Extra users (viewer, stranger) get their own context the same way. Auth-screen checks still walk the registration or login UI.

Reuse and extend `apps/web-e2e/src/planner-helpers.ts` (`register` today drives the UI). Replace duplicated local `register` copies (~20 files) with `signedInPage` / `signedInRequest`. Do not add a new Nx lib.

**Rationale**: Register already sets the session cookie (ADR 0002). Context-level `request` avoids a second origin (`:3000`) cookie mismatch. Unique emails keep isolation (FR-005) while skipping the slow catalog-heading wait on every check (FR-006).

**Alternatives considered**:

- One shared storageState gardener — faster, but leftovers (gardens, favorites, 20-garden load fixtures) leak; rejected in clarify.
- Unique user per worker — still leaks across checks on that worker.
- Direct `POST` to `:3000` then inject cookie — extra cookie-domain wiring; proxy path already works.

## 2. Where request/response-only checks live

**Decision**: Move Playwright files that never look at a page into `apps/api-e2e` as Vitest, gated by `E2E_LIVE=1` (skip in the unit `test` job). The e2e job starts API + web, then runs live `api-e2e`, then Playwright. Hit `http://localhost:3000` with `fetch` and the `og_session` cookie. Zod contract smokes that need no server stay as they are (always run in `npm test`).

Move at least: `garden-api`, `garden-layout-api`, `garden-plantings-api`, `garden-calendar-api`, `care-reminders-api`, `pipeline-api`, `pipeline-merge`. Keep UI: `pipeline-admin`, gardener-facing catalog/offline/planner files.

**Rationale**: Spec FR-007 names the API-level suite. `api-e2e` already hosts live DB checks (`gardens-load`, `layout-load`) behind `DATABASE_URL`. A second Playwright project that “doesn’t launch a browser” still couples HTTP proofs to the browser runner.

**Alternatives considered**:

- Playwright `request` fixture only — no browser, but still the wrong suite.
- Drizzle writes instead of HTTP — would not prove status codes and error bodies.

## 3. Catalog-mutating checks without a sequenced group

**Decision**: Delete the Playwright `pipeline` project and `dependencies: ['chromium']`. Pipeline UI and gardener checks run in one fully parallel Chromium project. After services are ready, `e2e.sh` starts live `api-e2e` (`E2E_LIVE=1`) and Playwright **together** and fails if either fails. That is concurrent catalog-mutating HTTP with gardener UI — not a Playwright `dependencies` wait and not “pipeline goes last.”

Isolation for mutations:

- Merge/run tests add plants with names gardener checks never search (`Pipeline Bravo *`, `Pipeline Extra *`).
- `sourceOrder` patches restore `['fixture']` in `finally`.
- Gardener checks assert named fixture plants, never global `totalCount`.
- Poll pipeline idle / plant appearance with a condition wait (`expect.poll` or deadline loop that **asserts the condition**, not a fixed “app catch-up” sleep). Poll interval is allowed; `waitForTimeout` / “sleep then click” is not.
- One-running-pipeline `409` stays product behavior; live HTTP helpers retry start only while status is `409`.

**Rationale**: Clarify forbade a suite-wide “pipeline goes last” wait. Additive unique names plus restore is isolation without a second database or product overlay (FR-015). Two job **processes** in parallel is not a sequenced Playwright project.

**Alternatives considered**:

- Second Postgres / API for pipeline — extra Compose service; YAGNI.
- Product namespaced catalog overlay — gardener-facing change; out of scope.
- Mutex around `sourceOrder` that blocks gardener catalog tests — hidden sequencing.

## 4. App under test: production web, not live-reload

**Decision**: In `scripts/ci/e2e.sh`, start web with `npx nx serve web --configuration=production --host=0.0.0.0 --port=4200` (existing `proxy.conf.json` still proxies `/api` to `:3000`). Keep API as `tsx apps/api/src/main.ts`. Ready check stays HTTP codes on `:4200`, `:3000/api/plants`, and `:4200/api/plants`.

**Rationale**: FR-012. Production configuration builds once and does not rebuild on file watch. Same proxy as today; no nginx.

**Alternatives considered**:

- `nx build web` + static file server + extra proxy — more moving parts.
- Keep development `nx serve` — slower and unlike what gardeners get.

## 5. Retries, traces, workers

**Decision**:

- `retries: 0` in Playwright (CI and local).
- `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'` (today `on-first-retry` would never save a trace once retries are off).
- One Chromium project, `fullyParallel: true`. CI `workers` stay **2** (current); local unbounded. Raising CI workers is a later knob after the baseline, not an isolation strategy.
- `test.setTimeout` may stay as a safety ceiling; it is not a wait.

**Rationale**: Clarify: first-try green; artifacts still required. Worker count is a speed knob, not an isolation strategy (isolation is unique users).

**Alternatives considered**:

- `retries: 1` with a separate no-retry proof job — rejected in clarify.
- CI workers 4 — try only after baseline if CPU is idle; may lengthen wall-clock on a small runner.

## 6. Waits vs injected latency

**Decision**: Forbidden in checks: `waitForTimeout`, and `setTimeout` used to “give the app time.” Allowed: `expect` on a locator/response; `expect.poll` / deadline loops that re-check a condition; a **route mock** that delays a response so a busy state is observable (`ui-feedback-auth` 400ms login delay is injected latency, not waiting for the app).

Replace `pipeline-helpers` 200ms sleep-poll with the same condition wait. **Keep** the file for `pipeline-admin` UI (`waitForPipelineIdleOnPage`). Do not delete it when HTTP pipeline specs move.

**Rationale**: FR-003 / SC-004.

## 7. Overlap collapse (browser)

**Decision**: Inventory during implement; collapse when two page files assert the same visible outcome. Keep distinct actions (offline, viewer, place vs miss, 2s load budgets). Likely moves/collapses (not exhaustive):

| Keep in browser | Collapse or move |
|-----------------|------------------|
| `pipeline-admin` UI | `pipeline-api` / `pipeline-merge` → live `api-e2e` |
| `plant-catalog` gardener browse | `pipeline-catalog` overlap (no-sync control can fold into catalog if the same screen) |
| `garden-list` CRUD/empty/isolation | HTTP CRUD already in `garden-api` → live `api-e2e`; list **load** budgets stay in `garden-list-load` |
| `layout-beds` / `planner-beds` | Keep one UI journey for create/resize/delete; HTTP in `garden-layout-api` |
| Place vs miss vs viewer | Stay separate (`planner-place`, `planner-catalog-reject`, share/viewer files) |

**Rationale**: Clarify option B — one browser proof per distinct gardener action.

## 8. Load/offline setup

**Decision**: Seed 20 gardens / 100 placements through the API (context `request` or live `api-e2e` helper), not a UI loop. Keep existing 2s interactive and 1s assembly budgets. Offline tests keep route abort / cache assertions; they use unique users and condition waits, not 90s as a substitute for readiness.

**Rationale**: FR-013 / US4.

## 9. Baseline and convention

**Decision**: First implementation task records wall-clock of the current gated `e2e` job on the standard runner (GitHub Actions job duration, app start + checks) into `specs/012-e2e-test-streamline/baseline.md`. Success is ≥40% under that number **and** &lt; 15 minutes. Short `apps/web-e2e/CONVENTION.md` (plus a pointer from `apps/api-e2e`) states the rules in FR-014.

**Rationale**: FR-001, FR-002, FR-014.

**ADR**: [0014-e2e-test-streamline.md](../../docs/adr/0014-e2e-test-streamline.md)
