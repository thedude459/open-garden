# Feature Specification: Streamline End-to-End Tests

**Feature Branch**: `012-e2e-test-streamline`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "Streamline e2e tests so that they run faster, follow best practices, and are not flaky"

## Clarifications

### Session 2026-09-07

- Q: When a check needs a signed-in gardener but is not itself about registration or login, should each check still use its own user, or should most checks share one prepared sign-in? → A: Unique user per check; skip the registration screen and reuse a prepared session for that user. Extra users for owner/viewer/stranger checks stay unique too.
- Q: When two existing checks prove the same gardener-facing outcome — one as a full page journey and one as overlapping extra clicks — how much of that overlap should the streamlined suite keep? → A: Move request/response-only checks out of the browser, and collapse overlapping page journeys so each user-visible behavior is proven once in the browser. Keep a distinct browser check whenever the gardener does something different (offline, viewer, place vs miss).
- Q: When this work is done, should the merge-gate end-to-end job still automatically retry a failed check, or must a healthy codebase pass on the first try? → A: No automatic retries on the gated job; first-try green is required to ship. Failure reports (screenshots, traces) stay; they are not a substitute for retry.
- Q: If the recorded baseline and the 15-minute ceiling disagree — for example the suite is already under 15 minutes, or 40% faster would still be slower than 15 minutes — which speed bar must this work meet? → A: Both apply: under 15 minutes and ≥40% faster than baseline; if baseline is already under 15 minutes, the 40% cut is the ship bar. The 15-minute ceiling remains so the suite cannot grow back.
- Q: Checks that rewrite shared catalog data (the admin/pipeline flow) currently force other checks to wait. After this work, should those checks be isolated so they can run at the same time as ordinary gardener checks, or may a small sequenced group remain? → A: Isolate catalog-mutating checks (their own data or an explicit reset) so they run concurrently with ordinary gardener checks. No suite-wide sequenced group and no “pipeline goes last” wait.

## User Scenarios & Testing *(mandatory)*

The people who use this feature are **contributors** (anyone changing the product) and the **merge gate** (the automated job that must pass before a change lands). Gardeners do not see this work; they benefit when fewer regressions slip through because the suite is trusted and actually run.

### User Story 1 - Fast Session and Production Serve (Priority: P1)

A contributor runs a user-journey check without walking the registration screen each time: the check uses its own signed-in user, already in the app. The gated job starts a production-like copy of the web app, not a slower live-reload development server. The full gated wall-clock (40% faster and under 15 minutes) is SC-001 / SC-002 after layering — not this story’s solo checkpoint.

**Why this priority**: If the suite is slow, people skip it, run a tiny slice, or treat the merge gate as someone else's problem. Speed is what makes the other stories usable.

**Independent Test**: With the app already running, one non-login user-journey check finishes in under two minutes including sign-in. The gated job starts a production-like copy of the web app (not a live-reload development server). Unique API sessions are used for checks that are not about registration or login. The full gated 40% / 15-minute bars are SC-001 and SC-002 after layering (User Story 3) and are proven at feature completion — not this story’s solo checkpoint.

**Acceptance Scenarios**:

1. **Given** the gated end-to-end job, **When** it starts the web app under test, **Then** that copy matches what gardeners receive as closely as practical (not a slower live-reload development mode).
2. **Given** a check that is not about registration or login, **When** it needs a signed-in gardener, **Then** it uses its own unique user with a prepared signed-in session — not a shared gardener and not the registration screen.
3. **Given** a contributor with the app already running locally, **When** they run a single user-journey check that is not the login screen, **Then** they get a result in under two minutes, including any required sign-in.

---

### User Story 2 - Failures Mean Real Bugs (Priority: P1)

A contributor sees a red end-to-end result. They can treat it as a real product or test-logic failure: the same check on an unchanged healthy codebase does not fail on one run and pass on the next. Checks do not "wait a bit and hope." They wait for a documented, observable outcome (a heading, a notice, a saved garden). Shared data from another check does not randomly break this one.

**Why this priority**: A fast suite that lies is worse than a slow one. Flakes train people to re-run until green and ignore the gate.

**Independent Test**: Inspect the suite: no check waits a fixed number of milliseconds for the app to become ready. Ordinary checks use unique users; seeded gardener/admin accounts only on login or admin-identity screens. A failing check fails on the first try with a saved screenshot and trace. Three consecutive full gated runs without retry are SC-003, proven at feature completion — not this story’s solo checkpoint.

**Acceptance Scenarios**:

1. **Given** any check in the suite, **When** it needs the app to finish work (save, navigate, show a notice), **Then** it waits until that outcome is observable — not until a timer expires.
2. **Given** two checks that can run at the same time, **When** they both create gardens, members, or plantings, **Then** neither check depends on leftover data from the other; each owns its users and gardens. Seeded accounts (`gardener@example.com`, `admin@example.com`) are allowed **only** when the behavior under test is that login or admin-identity screen.
3. **Given** a check that fails, **When** a contributor reads the report, **Then** they can tell which user-visible behavior broke without re-running "to see if it flakes," using the saved failure report (screenshot and trace).
4. **Given** the merge gate, **When** a check fails, **Then** the job fails on that first failure. The gated job MUST NOT automatically retry the check. Three consecutive full gated greens without retry remain SC-003 at feature completion.

---

### User Story 3 - The Suite Follows End-to-End Best Practices (Priority: P2)

The suite is shaped like a good end-to-end suite, not a pile of every check that was convenient to put in a browser. Browser checks cover gardener-facing journeys (what someone sees and does). Request-and-response-only behavior (status codes, isolation of one household's data from another, contract of an error body) is proven without driving a full page, in the project's existing API-level suite. Checks that rewrite catalog data (admin/pipeline) isolate that data so they run at the same time as ordinary gardener checks — there is no suite-wide wait for a sequenced group.

**Why this priority**: Best-practice structure is what keeps the P1 speed and stability gains from rotting. It also shortens new-feature work: authors know where a check belongs.

**Independent Test**: Classify each existing end-to-end check as "user-visible journey" or "request/response only." Confirm the latter no longer require a browser. Confirm overlapping page journeys that asserted the same visible outcome were collapsed to one. Confirm gardener checks and catalog-mutating checks run at the same time (no suite-wide sequenced group). Confirm a short contributor convention exists and that duplicated sign-in helpers are gone.

**Acceptance Scenarios**:

1. **Given** a check that never looks at a page (it only sends requests and reads responses), **When** the streamlined suite is in place, **Then** that check lives in the API-level suite and does not start a browser.
2. **Given** a gardener-facing journey (create a garden, place a planting, complete a reminder, go offline and see the cached layout), **When** coverage is reviewed, **Then** a browser check still exists for that journey, and two page journeys that only repeated the same visible outcome have been collapsed into one.
3. **Given** the default end-to-end run, **When** checks execute, **Then** independent checks run concurrently, including catalog-mutating (admin/pipeline) checks alongside ordinary gardener checks.
4. **Given** a catalog-mutating check, **When** it runs at the same time as gardener checks, **Then** it uses isolated catalog data (or an explicit reset that does not collide with in-flight gardener checks) so gardener checks still pass; there is no suite-wide “this group goes last” wait.
5. **Given** a new contributor adding a check, **When** they follow the project convention, **Then** they use the shared helpers to create a unique user and prepared session (and garden or bed as needed) instead of copying a local sign-up helper into a new file.

---

### User Story 4 - Load and Offline Journeys Stay Honest (Priority: P3)

The suite still includes the expensive-but-required journeys: a household with many gardens, a bed with many placements, and offline/read-only paths. Those checks stay correct and non-flaky. They get faster by cheaper setup (preparing data without repeating the slowest UI steps) and by waiting on real readiness, not by deleting the scenarios or weakening the budgets they already enforce.

**Why this priority**: These checks catch real regressions and are constitution-adjacent (performance budgets, offline PWA). They must not be the first thing cut to "go faster," but they also must not dominate wall-clock time through wasteful setup.

**Independent Test**: Re-run the many-garden list, many-placement planner, and representative offline journeys. Confirm they still enforce their existing time/behavior budgets and that their setup no longer repeats full UI registration or fixed pauses.

**Acceptance Scenarios**:

1. **Given** the existing many-garden list and many-placement planner checks, **When** they run after streamlining, **Then** they still fail if the product regresses past the already-agreed interactive budgets.
2. **Given** those same checks, **When** they prepare test data, **Then** they do not walk the gardener UI once per garden or placement when a direct, isolated setup can create the same data.
3. **Given** an offline or viewer journey, **When** it runs alongside other checks, **Then** it still passes reliably (cache, online-required notices, viewer restrictions) without relying on a long per-check timeout as a substitute for waiting.

---

### Edge Cases

- Two checks need an owner and a viewer of the same garden: they still isolate from every other check (unique users and garden). Extra people in one check are unique to that check; there is no global "the viewer" account and no shared gardener reused across ordinary checks. Seeded `gardener@example.com` / `admin@example.com` are only for login or admin-identity screens.
- An admin/catalog pipeline check that would otherwise rewrite shared plant data: it uses isolated data (or an explicit reset that cannot collide with in-flight gardener checks) so it can run at the same time as ordinary gardener checks. A suite-wide sequenced group or “pipeline goes last” wait is not allowed.
- The app under test is slow to become ready at the start of the job: the suite waits for a health/ready condition, not a guessed sleep, and that wait is counted in the 15-minute budget.
- A contributor runs one file or one check, not the full suite: that slice still works (no hidden “must run file A before file B” rule).
- A check fails because the product is actually broken: streamlining must not hide that behind a longer timeout or an extra retry.
- Local machine vs merge-gate environment: the same isolation and wait rules apply; a check that only passes locally because of extra manual waiting is not acceptable.
- Existing performance budgets (list of 20+ gardens, 100+ placements, interactive within two seconds) remain in force; streamlining setup is in scope, relaxing those budgets is not.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST record a wall-clock baseline of the full gated end-to-end job (app start plus all checks) on the standard CI runner before claiming a speedup.
- **FR-002**: After this work, the gated job MUST meet SC-001 and SC-002 (at least 40% faster than the recorded baseline **and** under 15 minutes including app start; both bars; if the baseline is already under 15 minutes, the 40% cut still ships and 15 minutes remains the ceiling). These bars are proven at feature completion, not as User Story 1 alone.
- **FR-003**: Every end-to-end check MUST wait for an observable, documented outcome (visible text, control state, saved result), measured as SC-004. Waiting a fixed number of milliseconds for the app to "catch up" is forbidden.
- **FR-004**: Checks MUST be independently runnable. No check may require another check in the same suite to have run first. A contributor MUST be able to run a single file or single check without a hidden “file A before file B” rule.
- **FR-005**: Checks MUST isolate their data with a unique user per check (and unique extra users when a scenario needs an owner, viewer, or stranger) plus unique gardens so concurrent runs cannot see each other's writes. Sharing one gardener across ordinary checks is forbidden. Seeded accounts (`gardener@example.com`, `admin@example.com`) MAY be used only when the behavior under test is that login or admin-identity screen.
- **FR-006**: Checks that are not about registration or login MUST obtain that unique user's session without completing the registration screen (create the user and sign in through the service, then open the app already signed in).
- **FR-007**: Checks that only verify requests and responses MUST live in the API-level suite and MUST NOT require a browser.
- **FR-008**: Gardener-facing journeys required for feature completeness (including offline and sharing/viewer paths) MUST remain covered by a browser check. Two page journeys that assert the same visible outcome MUST be collapsed into one; distinct gardener actions (offline vs online, viewer vs owner, place vs miss) MUST keep separate browser checks. Shrinking each feature area to a single happy-path page check is forbidden.
- **FR-009**: Duplicated local sign-in/setup helpers MUST be replaced by a single shared setup used across browser checks.
- **FR-010**: The default run MUST execute independent checks concurrently, including catalog-mutating (admin/pipeline) checks. Those checks MUST isolate their catalog data (own data or an explicit reset that cannot collide with in-flight gardener checks). A sequenced group or suite-wide “pipeline goes last” wait is forbidden.
- **FR-011**: The merge gate MUST fail when any check fails on the first try. Automatic retry of individual checks on the gated job is forbidden. A healthy codebase MUST go green without retrying. Failure artifacts (screenshot and trace) MUST still be saved so a contributor can see what broke.
- **FR-012**: Time spent starting the app under test MUST be minimized; the running app MUST match what gardeners receive as closely as practical (not a slower live-reload development mode unless a documented exception remains).
- **FR-013**: Many-garden and many-placement checks MUST keep their existing interactive budgets; their data setup MUST avoid repeating the slowest UI steps per item.
- **FR-014**: Contributors MUST have a short convention (in the end-to-end area of the repo) stating: wait for outcomes not time, unique user per check, obtain that session without the registration screen, put HTTP-only checks in the API-level suite, and isolate catalog-mutating checks so they can run in parallel with gardener checks.
- **FR-015**: Product behavior for gardeners MUST NOT change except where a tiny, user-invisible testability fix is required for a stable wait (for example a missing visible name on a control the check already relies on). Appearance, layout, and service contracts stay as specified by existing features.

### Key Entities

- **End-to-end check**: One automated scenario with a clear behavior under test and a pass/fail result.
- **Browser suite**: Checks that drive the product the way a gardener would (pages, controls, notices).
- **API-level suite**: Checks that prove request/response behavior without a page.
- **Prepared session**: A signed-in session for a check’s own unique user, obtained without the registration screen and not shared with other checks.
- **Isolation boundary**: The users, gardens, catalog data, and other records a check owns so it cannot collide with another check.
- **Gated run**: One full execution of the merge-gate end-to-end job, including starting the app.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Full gated end-to-end job wall-clock time is at least 40% lower than the recorded pre-change baseline on the same class of CI runner.
- **SC-002**: That same job also completes in under 15 minutes, including starting the app. If the baseline is already under 15 minutes, SC-001 still applies and SC-002 remains a ceiling the job must not exceed.
- **SC-003**: Three consecutive full-suite runs on an unchanged healthy codebase all pass with zero individual-check retries, and the gated job itself has automatic retries turned off.
- **SC-004**: 100% of checks wait on observable outcomes; zero checks use a fixed-duration pause to wait for the app.
- **SC-005**: A contributor with the app already running gets a result from a single user-journey check in under two minutes.
- **SC-006**: Request/response-only checks no longer require a browser; each remaining gardener-facing behavior has exactly one browser check (not two overlapping page journeys), and distinct actions still have their own browser checks.
- **SC-007**: Contributors can add a new browser check without copying a sign-in helper: they use the shared setup on the first attempt.

## Assumptions

- The recorded baseline is the current full gated end-to-end job as it exists at the start of implementation, measured on the project's then-standard continuous-integration runner, so the 40% figure is comparable. Both the 40% cut and the 15-minute ceiling apply at **feature completion** (SC-001 / SC-002), not as User Story 1’s solo checkpoint. If the baseline is already under 15 minutes, the 40% cut is the ship bar and 15 minutes stays the ceiling.
- Seeded accounts (`gardener@example.com`, `admin@example.com`) exist for demo/login/admin-identity screens only (FR-005). All other checks use a unique user.
- Constitution-required end-to-end coverage of features remains: this work relocates request/response-only checks, collapses overlapping page journeys that asserted the same visible outcome, and speeds what remains; it does not drop distinct user-visible journeys or shrink a feature to a single happy-path page check.
- The existing API-level suite (including contract checks that do not need a live database, and the database-backed load budgets) stays the home for non-browser verification; HTTP-only checks currently living in the browser suite move there.
- Automatic retries on the gated job are removed as part of this work; they are not left on as a diagnostic. First-try green is the ship bar.
- Seed/catalog fixture data already used by the project is reused; this feature does not require a new plant-data provider. Catalog-mutating checks isolate that data (or reset without colliding) so they run at the same time as gardener checks.
- Cross-browser expansion (Safari, Firefox, mobile device labs) is out of scope.
- Changing gardener-facing product behavior is out of scope except the tiny testability exception in FR-015.
- Existing interactive budgets from the load-performance feature (list of 20+ gardens, 100+ placements, interactive within two seconds) stay in force.
- Unit-test coverage gates and lint/build jobs are unchanged; this feature is the end-to-end job and the suites it runs.
