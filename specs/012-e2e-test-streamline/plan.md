# Implementation Plan: Streamline End-to-End Tests

**Branch**: `012-e2e-test-streamline` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-e2e-test-streamline/spec.md`

## Summary

Make the gated end-to-end job **fast, first-try green, and layered**. Browser checks keep gardener-facing journeys; request/response-only checks move to live `apps/api-e2e`. Each check gets a **unique user** via `POST /api/auth/register` on the page origin (no registration screen except auth tests). Drop the Playwright `pipeline` project; isolate catalog mutations with unique plant names and `sourceOrder` restore. Serve the **production** web build. `retries: 0`; traces/screenshots on failure. Record a CI baseline, then meet **≥40% faster and &lt; 15 minutes**.

Technical approach: helpers in `apps/web-e2e` / `apps/api-e2e` (no new Nx lib); `scripts/ci/e2e.sh` + Playwright config; ADR [0014](../../docs/adr/0014-e2e-test-streamline.md). No migration. No gardener-facing product change except a missing visible name if a wait cannot attach otherwise (FR-015).

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx; Playwright (`apps/web-e2e`); Vitest (`apps/api-e2e`); existing REST auth (`og_session`); Angular production `serve`; Nest API via `tsx`

**Storage**: PostgreSQL (Compose / CI service). **No new migration.** Tests isolate with unique users/gardens and unique pipeline plant names.

**Testing**: This feature *is* the e2e suites. Vitest live HTTP behind `E2E_LIVE=1`; Playwright Chromium for UI. Coverage gate unchanged for product libs. New helpers stay small and typed.

**Target Platform**: Self-hosted PWA; gated job in `.github/workflows/ci.yml` (`e2e`)

**Project Type**: Nx monorepo — no new app/lib

**Performance Goals**: Gated job ≥40% faster than recorded baseline **and** &lt; 15 minutes including app start (both bars; if baseline is already &lt; 15 minutes, 40% still ships). Single UI check &lt; 2 minutes with app already running. Existing 011 budgets unchanged (20 gardens / 100 placements; 1s assembly; 2s interactive).

**Constraints**: REST only; no new plant provider; unique user per ordinary check (seeded `gardener@example.com` / `admin@example.com` only for login or admin-identity screens); no automatic retries; no sequenced Playwright project; no live-reload web serve in the e2e job; constitution-required UI journeys remain

**Scale/Scope**: Current `web-e2e` + live HTTP subset of `api-e2e` + `scripts/ci/e2e.sh`. Out of scope: Safari/Firefox/device labs; unit-test job; relaxing 011 budgets; gardener UX.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Library-First**: No new product lib. This work is gated-test infrastructure, not a domain capability (plant catalog, layout, calendar). The e2e apps (`apps/web-e2e`, `apps/api-e2e`) **are** the module boundary; a new `@open-garden/e2e-harness` would be organizational-only packaging.
- [x] **Provider Abstraction**: Fixture catalog only; no direct provider calls.
- [x] **Simplicity (YAGNI)**: Reuse Playwright context `request`, existing `planner-helpers`, production `serve` + proxy. No second database, no nginx, no test-only HTTP API.
- [x] **Multi-User**: Unique owner/viewer/stranger per check; sharing/viewer UI journeys stay in the browser suite.
- [x] **Type Safety & Shared Contracts**: Helpers in strict TS; no new duplicated DTOs; no `any`.
- [x] **REST Boundary**: Session via existing `POST /api/auth/register` / `login`; live HTTP uses existing routes.
- [x] **Angular Standalone**: No new UI.
- [x] **PostgreSQL Migrations**: None.
- [x] **Testing Gates**: Playwright UI + live `api-e2e` HTTP; 011 assembly/interactive budgets kept; product coverage ≥80% unchanged.
- [x] **Security**: Unique test emails; existing `SESSION_SECRET` in CI; no new secrets; no test backdoor.
- [x] **Self-Hosted**: e2e job / Compose Postgres already in-repo; production serve uses in-repo proxy.
- [x] **ADR**: [0014-e2e-test-streamline.md](../../docs/adr/0014-e2e-test-streamline.md)

## Project Structure

### Documentation (this feature)

```text
specs/012-e2e-test-streamline/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── e2e.md
│   └── ci-job.md
├── baseline.md          # Recorded at implement start (not created here)
└── tasks.md             # Phase 2 (/speckit-tasks) — not created here
```

### Source Code (repository root)

```text
apps/web-e2e/
├── playwright.config.ts          # retries 0; one Chromium project; retain-on-failure
├── CONVENTION.md                 # FR-014
└── src/
    ├── session.ts                # signedInPage / extra user (API register + cookie)
    ├── planner-helpers.ts        # keep UI helpers; drop duplicated register copies
    └── *.spec.ts                 # UI journeys only

apps/api-e2e/
├── src/
│   ├── live-http.ts              # fetch + og_session; skip unless E2E_LIVE=1
│   ├── garden-http.spec.ts       # moved from web-e2e *-api.spec.ts
│   └── pipeline-http.spec.ts     # moved pipeline-api / pipeline-merge
└── (existing Zod smokes unchanged)

scripts/ci/e2e.sh                 # production web serve; parallel live api-e2e + Playwright
.github/workflows/ci.yml          # e2e job unchanged except what e2e.sh does
docs/adr/0014-e2e-test-streamline.md
.cursor/rules/specify-rules.mdc   # point at this plan
```

**Structure Decision**: Stay inside existing `web-e2e` and `api-e2e`. No new Nx project. Convention file sits next to the browser suite.

## Complexity Tracking

> No constitution violations.
