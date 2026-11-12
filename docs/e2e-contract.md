# E2E suite contract

**Feature**: `012-e2e-test-streamline`

Layering and helper rules. Product REST shapes are unchanged (see existing feature contracts). Accessible **names** used by Playwright stay as in 008–011 (`Save layout`, the `Garden Overview` heading, `Create bed`, `Notification`, `Drop missed a bed`, etc.). The property nav links are `Plan`, `Calendar`, `Tasks`, and `Settings`, with `Plantings` and `Transplants` beneath; match them with `exact: true`, since `Plan` is a prefix of `Plantings`.

## Layer placement

| Kind of assertion | Home | Must not |
|-------------------|------|----------|
| Gardener sees/does (page, control, notice, offline cache UI) | `apps/web-e2e` | Live only as HTTP |
| Status code, error body, isolation via HTTP, pipeline merge counts | `apps/api-e2e` with `E2E_LIVE=1` | Start a browser |
| Zod parse / documented message strings without a server | `apps/api-e2e` (existing smokes) | Require Postgres |

Two page journeys that assert the **same visible outcome** collapse to one. Distinct actions stay separate: offline vs online, viewer vs owner, place vs miss, 20-garden / 100-placement load budgets.

## Session helper (browser)

`signedInPage(browser, email)` (name may vary):

1. `browser.newContext()`
2. `context.request.post('/api/auth/register', { data: { email, password: 'password123', displayName: 'E2E' } })` — expect success
3. `context.newPage()` — caller owns the page; cookie is already `og_session`

Extra person: another context, same helper. UI `register` / `login` only for checks whose behavior **is** those screens (seeded `gardener@example.com` allowed there). Seeded `admin@example.com` only when the behavior **is** the admin-identity screen. `pipeline-admin` UI keeps `waitForPipelineIdleOnPage` (condition wait) in `apps/web-e2e/src/pipeline-helpers.ts` — do not delete that helper when HTTP pipeline specs move.

## Live HTTP helper

`E2E_LIVE=1` or skip. `POST http://localhost:3000/api/auth/register`, store `og_session`, send `Cookie` on later fetches. Unique email per case.

## Waits

| Allowed | Forbidden |
|---------|-----------|
| `expect(locator).toBeVisible()` / toHaveText / response predicate | `page.waitForTimeout` |
| `expect.poll` / deadline loop that re-checks a condition | Sleep-then-click / sleep-then-assert |
| Route mock that **injects** delay so busy UI is visible | Sleep “for the app to catch up” |

## Catalog isolation

- Gardener checks use crops from the bundled open-garden-data release. A variety reads `Tomato (Cherry)` in the UI; search by the common name (`Tomato`), then pick the variety. In API checks, pick the crop's own row (`cultivar` null) or name the variety. Do not assert global `totalCount`.
- A plant without spacing (the `unavailable` flag) is not in the dataset; `layout-http` inserts one with SQL.
- Playwright: one Chromium project; **no** `pipeline` project and **no** `dependencies: ['chromium']`.

## Convention file

`apps/web-e2e/CONVENTION.md` MUST state the rows above (FR-014). `apps/api-e2e` MAY link to it.
