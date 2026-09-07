# Browser e2e convention

Layering, session, waits, and isolation for `apps/web-e2e`. Live HTTP proofs live in `apps/api-e2e` (`E2E_LIVE=1`). See `specs/012-e2e-test-streamline/contracts/e2e.md`.

## Inventory (T022)

| File | Decision | Notes |
|------|----------|--------|
| `ui-visual-smoke.spec.ts` | keep | Accessible names still visible |
| `ui-feedback-auth.spec.ts` | keep | Login busy (seeded gardener) + signed-in create/catalog |
| `ui-feedback-planner.spec.ts` | keep | Save/drop notices |
| `ui-empty-states.spec.ts` | keep | Empty planner UI |
| `ui-place-marker.spec.ts` | keep | Place marker a11y |
| `garden-list.spec.ts` | keep | CRUD / empty / isolation UI |
| `garden-list-load.spec.ts` | keep | 20-garden 2s budget |
| `garden-site.spec.ts` | keep | Site profile UI |
| `garden-share.spec.ts` | keep | Invite / transfer / leave |
| `garden-share-catalog.spec.ts` | keep | Favorites not shared |
| `garden-offline.spec.ts` | keep | Offline garden cache |
| `plant-catalog.spec.ts` | keep | Browse + no sync control (folded in `pipeline-catalog`) |
| `pipeline-catalog.spec.ts` | collapse → `plant-catalog.spec.ts` | Same catalog screen |
| `plant-catalog-offline.spec.ts` | keep | Distinct offline action |
| `plant-favorites.spec.ts` | keep | Favorites UI |
| `plant-filters.spec.ts` | keep | Filter UI |
| `plant-search-load.spec.ts` | keep | Search 2s budget |
| `plantings-beds.spec.ts` | keep | Planting-list beds UI |
| `plantings-record.spec.ts` | keep | Record plantings UI |
| `plantings-offline.spec.ts` | keep | Distinct offline action |
| `calendar-view.spec.ts` | keep | Calendar frost/windows UI |
| `calendar-plants.spec.ts` | keep | Add/remove calendar plants |
| `calendar-offline.spec.ts` | keep | Distinct offline action |
| `reminders-list.spec.ts` | keep | Reminder list UI |
| `reminders-complete.spec.ts` | keep | Complete/dismiss UI |
| `reminders-offline.spec.ts` | keep | Distinct offline action |
| `planner-beds.spec.ts` | keep | Overview create/resize/delete beds + areas |
| `layout-beds.spec.ts` | collapse → `planner-beds.spec.ts` | Same create/resize/delete bed journey |
| `planner-place.spec.ts` | keep | Overview place / grab-offset / viewer |
| `layout-place.spec.ts` | keep | Distinct: Bed View place + spacing gate |
| `planner-pan.spec.ts` | keep | Pan |
| `planner-drag.spec.ts` | keep | Drag |
| `planner-overview.spec.ts` | keep | Overview chrome |
| `planner-diagram.spec.ts` | keep | Diagram |
| `planner-transplants.spec.ts` | keep | Transplants |
| `planner-catalog-drop.spec.ts` | keep | Catalog drop |
| `planner-catalog-reject.spec.ts` | keep | Catalog reject / miss |
| `planner-load.spec.ts` | keep | 100-placement 2s budget |
| `layout-offline.spec.ts` | keep | Distinct offline layout |
| `pipeline-admin.spec.ts` | keep | Admin-identity pipeline UI |
| `garden-api.spec.ts` | move → `apps/api-e2e/src/garden-http.spec.ts` | HTTP only |
| `garden-layout-api.spec.ts` | move → `layout-http.spec.ts` | HTTP only |
| `garden-plantings-api.spec.ts` | move → `plantings-http.spec.ts` | HTTP only |
| `garden-calendar-api.spec.ts` | move → `calendar-http.spec.ts` | HTTP only |
| `care-reminders-api.spec.ts` | move → `reminders-http.spec.ts` | HTTP only |
| `pipeline-api.spec.ts` | move → `pipeline-http.spec.ts` | HTTP only |
| `pipeline-merge.spec.ts` | move → `pipeline-http.spec.ts` | HTTP only |

## Layer placement

| Kind of assertion | Home | Must not |
|-------------------|------|----------|
| Gardener sees/does (page, control, notice, offline cache UI) | `apps/web-e2e` | Live only as HTTP |
| Status code, error body, isolation via HTTP, pipeline merge counts | `apps/api-e2e` with `E2E_LIVE=1` | Start a browser |
| Zod parse / documented message strings without a server | `apps/api-e2e` (existing smokes) | Require Postgres |

Two page journeys that assert the **same visible outcome** collapse to one. Distinct actions stay separate: offline vs online, viewer vs owner, place vs miss, 20-garden / 100-placement load budgets.

## Session

- Ordinary checks: `signedInPage` / `signedInContext` (`apps/web-e2e/src/session.ts`) — unique email, `POST /api/auth/register` on the page origin, no registration screen.
- Extra person (viewer/stranger): another context, same helper. After Invite, wait until the member email is visible before that person opens the garden. After Remove, wait until the email is gone.
- Seeded `gardener@example.com` only when the behavior **is** the login screen.
- Seeded `admin@example.com` only when the behavior **is** the admin-identity screen.
- `registerViaUi` in `planner-helpers.ts` is auth-screen only.
- Keep `pipeline-helpers.ts` (`waitForPipelineIdleOnPage`) for pipeline **UI** idle waits.

## Waits

| Allowed | Forbidden |
|---------|-----------|
| `expect(locator).toBeVisible()` / toHaveText / response predicate | `page.waitForTimeout` |
| `expect.poll` / deadline loop that re-checks a condition | Sleep-then-click / sleep-then-assert |
| Route mock that **injects** delay so busy UI is visible (`ui-feedback-auth.spec.ts`, `ui-feedback-planner.spec.ts`) | Sleep “for the app to catch up” |
| `saveGarden` / wait for Invite member email / mutation notice before another page acts | Click then immediately `goto`/`reload` on another context |

`test.setTimeout` may stay as a ceiling. It is not a wait. Playwright contexts use `serviceWorkers: 'block'` so production SW cannot bypass `page.route` (offline tests still use IndexedDB). Default test timeout is 90s.

## Catalog isolation

- Gardener checks: query fixture names (`Cherry Tomato`, etc.). Do not assert global `totalCount`.
- Pipeline mutating checks: unique names (`Pipeline Bravo *`); `PATCH` `sourceOrder` restored to `['fixture']` in `finally`.
- Playwright: one Chromium project; **no** `pipeline` project and **no** `dependencies: ['chromium']`.
