# Data model: Streamline End-to-End Tests

**Feature**: `012-e2e-test-streamline` | **Date**: 2026-09-07

No new PostgreSQL tables or columns. Product entities (users, gardens, memberships, plantings, catalog, pipeline settings) are unchanged. This feature defines **how checks own data** during a gated run.

## End-to-end check

One automated scenario with a single behavior under test.

| Field | Rules |
|-------|--------|
| Layer | `browser` (page, controls, notices) or `http` (status + body only) |
| Identity | Unique to the file/case; independently runnable |
| Wait | Observable outcome only (visible text, control state, HTTP body). No fixed pause for the app |
| Timeout ceiling | Optional safety cap; not a wait |

**Validation**: HTTP-only checks MUST NOT start a browser. Browser checks MUST NOT duplicate an HTTP-only assertion of the same status/body.

## Prepared session

Signed-in identity for a check that is not itself about registration or login.

| Field | Rules |
|-------|--------|
| User | Unique email per check (and per extra person in that check) |
| Cookie | `og_session` on the page origin (`:4200` via `/api` proxy) for browser checks; same cookie on `:3000` for live HTTP |
| How obtained | `POST /api/auth/register` (existing), not the registration screen |
| Sharing | Forbidden across checks |

Auth-screen checks (login busy, register landing) MAY use the UI and MAY use the seeded `gardener@example.com` only when the behavior under test is that screen. Admin-identity checks MAY use seeded `admin@example.com` only when the behavior under test is that admin screen. All other checks MUST use a unique user.

## Isolation boundary

Records a check may write without colliding.

| Record | Rule |
|--------|------|
| User | Unique per check (FR-005) |
| Garden / membership / planting | Created under that check’s users |
| Catalog (shared table) | Gardener checks read **named fixture plants**. Pipeline checks MAY add uniquely named plants (`Pipeline Bravo *`, `Pipeline Extra *`) and MUST restore `sourceOrder` to `['fixture']` in `finally` |
| Pipeline run | At most one `running` globally (existing 409). Helpers retry start only on 409 |

**Forbidden**: one shared gardener for ordinary checks; asserting global `plants.totalCount` from a gardener check; leaving `sourceOrder` not equal to `['fixture']` after a mutating check.

## Browser suite vs API-level suite

| Suite | Home | Runs when |
|-------|------|-----------|
| Browser | `apps/web-e2e` Playwright | Gated `e2e` job |
| Live HTTP | `apps/api-e2e` Vitest with `E2E_LIVE=1` | Same job, **in parallel** with Playwright after services ready |
| Contract smokes | `apps/api-e2e` Vitest, no server | `npm test` (skip live HTTP) |

## Gated run

One execution of `scripts/ci/e2e.sh` on the merge gate.

| Phase | Rule |
|-------|------|
| Baseline | Wall-clock of this job **before** streamlining, stored in `baseline.md` |
| Start | Production web on `:4200` (proxy `/api` → `:3000`); API on `:3000`; wait on HTTP ready, not a guessed sleep |
| Checks | Playwright + live `api-e2e` concurrent; first failure fails the job; **retries 0** |
| Artifacts | Trace + screenshot on failure |
| Success | ≥40% faster than baseline **and** &lt; 15 minutes including start |

## State transitions

None for product data. Check lifecycle: **setup** (unique user + optional garden) → **assert** → **teardown** (cookie context closed; pipeline `sourceOrder` restored if this check patched it). No “must run file A before file B.”

## Authorization in checks

Viewer/collaborator/owner journeys stay first-class in the browser suite. Isolation tests (stranger cannot see a garden) use two unique users, not a global stranger account.
