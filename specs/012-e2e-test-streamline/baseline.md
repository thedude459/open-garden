# Gated e2e baseline (pre-streamline)

Recorded at implement start (T001). Do not claim SC-001 until a post-change duration is compared here.

| Field | Value |
|-------|--------|
| Date | 2026-09-07 |
| Commit SHA | `9d7b01d43650f0545987e0027368871c4fabfe16` |
| Runner | GitHub Actions `ubuntu-latest` |
| Workflow | `ci.yml` job `e2e` (run `34126163754`) |
| Job wall-clock | 3m 32s (212s) — `13:13:18Z` → `13:16:50Z` |
| **App start + all checks** (`End-to-end tests` step / `scripts/ci/e2e.sh`) | **2m 53s (173s)** — `13:13:54Z` → `13:16:47Z` |

**Baseline used for SC-001 / SC-002:** 173 seconds (gated script: Postgres already up, seed, API, development `nx serve web`, Playwright including the sequenced `pipeline` project, `retries: 1` on CI).

**Bars (both):**

- SC-001: new script wall-clock ≤ 103s (≥40% faster than 173s)
- SC-002: new script wall-clock < 15 minutes (already true of this baseline; still a ceiling)

## SC-005 (T013)

With API + production web already running: `apps/web-e2e/src/ui-visual-smoke.spec.ts` finished in **~2.1s** (well under 120s).

## Post-change (T032)

Local `npm run e2e` (same script as CI: production serve, live HTTP + Playwright in parallel, retries 0). Postgres already on `:5432`. Three consecutive greens:

| Run | Script wall-clock | Result |
|-----|-------------------|--------|
| 1 | 90s | pass (70 live HTTP + 59 Playwright) |
| 2 | 88s | pass |
| 3 | 87s | pass |

**SC-001:** 87–90s vs 173s baseline = **48–50% faster** (bar ≤103s).  
**SC-002:** well under 15 minutes.  
**SC-003:** three consecutive greens, retries 0.
