# Feature Specification: End-to-End Test Coverage

**Feature Branch**: `007-e2e-test-coverage`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Create playwright tests for creating a user, creating a garden, creating a planting bed and any other functions that a user can perform so that features are being thoroughly tested"

## Clarifications

### Session 2026-07-07

- Q: What test data environment strategy should authenticated end-to-end tests use? → A: Dedicated test database wiped or reset before each CI suite run.
- Q: How should plant catalog data be provided for end-to-end tests? → A: Seed a minimal fixed catalog in the test database during suite setup.
- Q: How should authenticated sessions be established for end-to-end tests? → A: Auth tests use full UI registration/sign-in flows; other journeys use an API or fixture shortcut for user and session setup.
- Q: What end-to-end tests should run on every pull request versus post-merge? → A: P1/P2 smoke subset on every PR; full suite on merge to main or nightly.
- Q: What mobile viewport scope should end-to-end planner tests cover? → A: Mobile tests cover click-to-place only; layout editing (beds, paths, drag) is explicitly scoped to desktop in the full suite.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Account Registration and Sign-In (Priority: P1)

A new gardener creates an account with email and password, signs in, and reaches
protected areas of the application. Automated end-to-end tests verify the full
account lifecycle and confirm that unauthenticated visitors cannot access private
features.

**Why this priority**: Authentication gates every other user-facing capability.
Without reliable account-flow tests, all downstream journey tests are blocked or
untrustworthy.

**Independent Test**: Run the auth test suite alone; it exercises registration and
sign-in through the UI, creates disposable test accounts, confirms access to a
protected page, signs out (or uses an isolated session), and verifies redirect to
sign-in when unauthenticated.

**Acceptance Scenarios**:

1. **Given** a visitor on the registration page, **When** they submit a valid email
   and password, **Then** account creation succeeds and they can proceed to sign in.
2. **Given** a registered user on the sign-in page, **When** they submit correct
   credentials, **Then** they reach a protected destination (e.g., plant catalog or
   gardens list) without error.
3. **Given** a visitor submits registration with an invalid email, duplicate email,
   or password shorter than the minimum length, **When** the form is submitted,
   **Then** the system shows a clear validation or error message and does not grant
   access.
4. **Given** a visitor submits sign-in with incorrect credentials, **When** the form
   is submitted, **Then** access is denied with a clear error message.
5. **Given** a user is not signed in, **When** they navigate to protected areas
   (plant catalog, gardens list, garden editor, planner), **Then** they are
   redirected to sign in.

---

### User Story 2 - Garden Creation and Management (Priority: P1)

A signed-in gardener creates a new growing area with a name and dimensions, sees it
in their garden list, and opens it for editing. Tests cover happy paths and
dimension validation.

**Why this priority**: Garden creation is the foundation for beds, paths, and
planting. It is the second most common onboarding step after account creation.

**Independent Test**: Sign in via authenticated fixture (API or shortcut setup),
create a garden with valid dimensions, assert it appears in the list with correct
name and size, open it, and verify the editor loads.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the create-garden flow, **When** they enter a
   name, positive length and width, and a measurement unit, **Then** the garden is
   saved and appears in their garden list.
2. **Given** a signed-in user enters zero, negative, or missing dimensions,
   **When** they attempt to save, **Then** save is blocked and a validation message
   is shown.
3. **Given** a signed-in user has one or more gardens, **When** they open the
   gardens list, **Then** each garden shows its name and dimensions.
4. **Given** a signed-in user selects a garden from the list, **When** the garden
   page loads, **Then** the layout editor or planner for that garden is displayed.

---

### User Story 3 - Beds, Paths, and Layout Structure (Priority: P2)

Within an existing garden, a user adds plantable beds and non-plantable paths,
respecting garden boundaries and overlap rules. Tests confirm structure creation,
display, and rejection of invalid layouts.

**Why this priority**: Beds define where planting is allowed; paths and boundaries
are required before placement and visual-planner tests can run meaningfully.

**Independent Test**: Using a test garden fixture, add a bed and a path, verify
both render on the layout canvas, then attempt an overlapping or out-of-bounds
placement and confirm it is rejected.

**Acceptance Scenarios**:

1. **Given** a garden exists, **When** the user adds a bed that fits inside the
   garden boundary, **Then** the bed is saved and shown as a plantable area on the
   layout.
2. **Given** a garden exists, **When** the user adds a non-plantable path area,
   **Then** the path is saved and visually distinct from plantable beds.
3. **Given** a user attempts to add a bed or path outside the garden boundary,
   **When** they save, **Then** the system blocks save and explains the violation.
4. **Given** beds or paths already exist, **When** the user adds an overlapping
   area, **Then** the system blocks save and explains the overlap conflict.
5. **Given** a bed exists, **When** the user optionally sets soil type or sun
   exposure from predefined options, **Then** the selections persist and are
   visible on the layout canvas when set.

---

### User Story 4 - Plant Catalog Discovery (Priority: P2)

A signed-in user searches, browses, and opens plant detail pages in the catalog.
Tests verify discovery flows and that catalog access remains protected.

**Why this priority**: Catalog discovery feeds every planting action; regressions
here break planner and validation workflows.

**Independent Test**: Sign in, search for a known plant, open its detail page, and
verify key summary fields are visible without requiring garden or layout setup.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the plant catalog, **When** they search by common
   name, **Then** matching plants appear with name and type visible.
2. **Given** a signed-in user browses by plant type, **When** a type filter is
   applied, **Then** only plants of that type are shown.
3. **Given** a signed-in user selects a plant from results, **When** the detail
   page loads, **Then** essential horticultural fields (name, maturity, spacing,
   companions) are displayed.
4. **Given** a signed-in user applies a climate or growing-condition filter,
   **When** results load, **Then** only compatible plants are shown or an empty
   state is clearly indicated.

---

### User Story 5 - Planting, Validation, and Indoor Starts (Priority: P2)

A signed-in user places plants on beds, receives spacing and incompatibility
feedback, and can start plants indoors or direct-seed into beds. Tests cover
successful placement, blocked invalid placement, and indoor-start tracking.

**Why this priority**: Planting with validation is the core value proposition of
the garden planner; silent regressions here directly harm user trust.

**Independent Test**: Using a garden with at least one bed and catalog access,
place a valid plant, attempt an invalid adjacent placement, start a plant indoors
linked to a target bed, and verify each outcome.

**Acceptance Scenarios**:

1. **Given** a garden with a bed and a plant selected from the library, **When**
   the user places the plant in a valid location, **Then** the plant appears on
   the canvas and persists after reload.
2. **Given** a placement would violate minimum spacing, **When** the user attempts
   to place or drop the plant, **Then** placement is blocked or clearly marked
   invalid before save.
3. **Given** incompatible plants would be adjacent, **When** the user attempts
   placement, **Then** the system hard-blocks the placement with an explanatory
   message.
4. **Given** a user chooses to start a plant indoors with a target bed, **When**
   they complete the flow, **Then** the indoor start is tracked separately and
   does not occupy bed space until transplanted.
5. **Given** a user direct-seeds into a bed, **When** placement succeeds, **Then**
   the plant occupies bed space immediately and planting history is recorded.

---

### User Story 6 - Visual Planner and Interaction UX (Priority: P3)

A signed-in user interacts with the visual planner: illustrated plant picker,
drag-and-drop or click-to-place on desktop and mobile viewports, zoom/pan, growing-
area types, and readable layout feedback. Tests cover primary interaction modes
defined in visual-planner and drag-drop UX features.

**Why this priority**: These flows are highly interactive and prone to UI
regressions that unit tests cannot catch.

**Independent Test**: Open a garden in the visual planner, add plants via the
primary interaction mode for the viewport, reposition one plant, and verify canvas
state and feedback without relying on unit-level mocks.

**Acceptance Scenarios**:

1. **Given** a signed-in user opens the visual planner, **When** they browse the
   plant library, **Then** plants show recognizable illustrations or images (not
   text-only rows).
2. **Given** a plant is selected on desktop, **When** the user drags it onto a
   valid bed location, **Then** the plant appears with spacing footprint visible.
3. **Given** a mobile phone viewport, **When** the user uses click-to-place,
   **Then** they can place a plant without drag-and-drop. Layout editing (adding
   or moving beds and paths) is not exercised on mobile phone viewports.
4. **Given** a user creates plans of different growing-area types (vegetable
   garden, orchard, container/patio), **When** each plan is opened, **Then** the
   appropriate type-specific defaults and library filtering apply.
5. **Given** an existing legacy garden, **When** the user opens it, **Then** it
   loads in the visual planner without data loss.
6. **Given** a user performs an action that succeeds or fails, **When** feedback
   is shown, **Then** success and error messages are readable and meet minimum
   contrast requirements on key screens (sign-in, planner controls).
7. **Given** a user is on the planner canvas, **When** they use toolbar zoom
   controls, **Then** the canvas scale changes without losing placed plants.

---

### User Story 7 - Reliable Test Infrastructure and CI Integration (Priority: P1)

The product team can run the full end-to-end suite locally and in continuous
integration with isolated test data, predictable setup/teardown, and clear failure
reports. No test depends on manual pre-seeded accounts or skipped placeholders.

**Why this priority**: Journey tests only deliver value when they run consistently
in automation; skipped or flaky tests provide false confidence.

**Independent Test**: Execute the complete suite in a clean environment; all
formerly skipped authenticated scenarios pass without manual intervention.

**Acceptance Scenarios**:

1. **Given** a clean test environment with a dedicated test database reset before
   the suite, **When** the full end-to-end suite runs, **Then** authenticated
   journey tests execute without `skip` markers for missing fixtures.
2. **Given** parallel or repeated test runs within a single suite execution,
   **When** tests create users, gardens, or plantings, **Then** each test uses
   isolated data and does not collide with other tests; stale data from prior CI
   runs is eliminated by the pre-suite database reset.
3. **Given** a test failure, **When** a developer reviews the report, **Then**
   they can identify which user journey failed and capture diagnostic artifacts
   (e.g., trace on retry) sufficient to reproduce locally.
4. **Given** continuous integration runs on every pull request, **When** a
   regression is introduced in a P1 or P2 journey, **Then** the PR smoke subset
   fails before merge.
5. **Given** code merges to main or a scheduled nightly run, **When** the full
   end-to-end suite executes, **Then** all P1–P3 journeys including visual planner
   and mobile viewport tests are exercised.

---

### Edge Cases

- What happens when network is slow during sign-in or garden save — do tests wait
  for stable UI state rather than racing?
- How are tests handled when the plant catalog is empty or search returns no
  results — prevented by seeding a minimal fixed catalog (including at least one
  compatible pair and one incompatible pair for validation tests) during suite
  setup after database reset.
- What happens when a test user already exists from a partial prior run — mitigated
  by pre-suite database reset in CI; local runs may still use unique email
  generation when re-running without a reset.
- How do tests behave when validation messages appear in toast vs inline form
  errors?
- What happens on mobile viewport for flows that are desktop-only (e.g., drag
  layout editing) — mobile phone tests cover click-to-place planting only; bed and
  path layout editing is tested on desktop in the full suite and explicitly excluded
  from mobile phone scenarios.
- How are orchard-specific spacing rules tested when catalog tree data may be
  sparse in test environments — include at least one tree record with spacing
  metadata in the seeded minimal catalog.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test suite MUST include automated end-to-end coverage for user
  registration with valid and invalid inputs.
- **FR-002**: The test suite MUST include automated end-to-end coverage for user
  sign-in with valid and invalid credentials.
- **FR-003**: The test suite MUST verify that all primary protected routes redirect
  unauthenticated visitors to sign-in.
- **FR-004**: The test suite MUST cover creating a garden with valid name,
  dimensions, and measurement unit, and verifying it appears in the user's garden
  list.
- **FR-005**: The test suite MUST cover rejection of invalid garden dimensions
  (zero, negative, or missing values).
- **FR-006**: The test suite MUST cover adding at least one plantable bed and one
  non-plantable path within a garden, including boundary and overlap validation
  failures.
- **FR-007**: The test suite MUST cover plant catalog search, browse-by-type, plant
  detail viewing, and climate compatibility filtering (with test user location set)
  for signed-in users against the seeded minimal catalog.
- **FR-008**: The test suite MUST cover successful plant placement on a bed and
  blocked placement for spacing or incompatibility violations.
- **FR-009**: The test suite MUST cover indoor-start and direct-seed flows at
  least once each, including correct bed-occupancy behavior.
- **FR-010**: The test suite MUST cover visual planner entry, illustrated plant
  picker visibility, and at least one placement interaction per supported viewport:
  desktop (drag-and-drop) and mobile phone (click-to-place). Layout editing
  (bed/path creation, drag repositioning) MUST be tested on desktop only; mobile
  phone tests MUST NOT attempt bed/path layout editing.
- **FR-011**: The test suite MUST cover creating or opening growing-area types
  vegetable garden, orchard, and container/patio where exposed in the UI.
- **FR-012**: The test suite MUST provide reusable authenticated session setup via
  API or fixture shortcuts so non-auth journey tests do not rely on manual seed
  data or permanent skip markers; dedicated auth specs MUST still exercise full
  UI registration and sign-in flows.
- **FR-013**: The test suite MUST use isolated test accounts and data per test or
  test file to prevent cross-test interference within a suite run.
- **FR-014**: The test suite MUST run as part of the project's continuous
  integration pipeline: a P1/P2 smoke subset on every pull request, and the full
  suite on merge to main or on a nightly schedule; either path MUST fail the build
  on regression.
- **FR-015**: The test suite MUST map each major user journey from existing
  product specifications (plant database, garden layout, visual planner, drag-drop
  UX) to at least one end-to-end scenario or document an explicit exclusion with
  rationale.
- **FR-016**: Accessibility smoke tests MUST cover minimum contrast on primary
  interactive controls for sign-in and at least one planner screen.
- **FR-017**: Failed tests MUST produce artifacts (trace, screenshot, or
  equivalent) on retry sufficient for local reproduction.
- **FR-018**: The CI pipeline MUST run end-to-end tests against a dedicated test
  database that is wiped or fully reset immediately before each suite execution.
- **FR-019**: Suite setup MUST seed a minimal fixed plant catalog into the test
  database after reset, including plants sufficient for search, detail, spacing,
  and incompatibility validation scenarios.

### Key Entities

- **Test Account**: A disposable user identity (email/password) created for
  automation; must not depend on production or shared manual accounts.
- **Test Garden**: A growing area with known name and dimensions, created during
  setup or within a test, used as the container for layout and planting scenarios.
- **Test Bed / Path**: Structural layout elements within a test garden, with
  defined geometry used to exercise validation and planting flows.
- **Test Planting**: A plant instance placed on a bed or tracked as an indoor
  start, used to verify persistence and validation behavior.
- **Test Catalog Fixture**: A minimal fixed set of plant records seeded into the
  test database after reset, with known names, types, spacing rules, and
  companion/incompatibility relationships for deterministic assertions.
- **Test Location Profile**: User climate/location set via `setTestLocationViaApi()`
  in `tests/e2e/fixtures/climate.ts` for catalog climate filter tests.
- **Journey Map**: A documented mapping from product user stories to end-to-end
  test scenarios, used to track coverage completeness and intentional gaps.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of P1 user journeys (account registration/sign-in, garden
  creation, test infrastructure) have at least one passing automated end-to-end
  test with no skip markers. *(Verified by journey-map audit in T049.)*
- **SC-002**: At least 90% of P2 user journeys (beds/paths, catalog, planting
  validation) have at least one passing automated end-to-end test. *(Verified by
  journey-map audit in T049.)*
- **SC-003**: The PR smoke subset completes in under 8 minutes in CI; the full
  end-to-end suite completes in under 15 minutes on a standard runner.
- **SC-004**: Zero authenticated journey tests remain permanently skipped due to
  missing fixtures after this feature ships.
- **SC-005**: A documented journey map lists every major user-facing capability
  from shipped product specs and marks each as covered, partially covered, or
  explicitly out of scope with rationale.
- **SC-006**: Regressions in covered P1/P2 journeys are detected by the PR smoke
  subset before merge; P3 regressions are caught by the full suite on merge or
  nightly. *(Detection rate over time is tracked operationally post-launch, not a
  release gate.)*
- **SC-007**: Developers can run any single journey test locally with one command
  and no manual database or account setup.

## Assumptions

- The project already uses browser-based end-to-end automation as indicated in the
  feature request; this specification defines coverage scope and quality bars, not a
  change of test tooling.
- Tests run against a local or CI-deployed instance of the application with access
  to a test-friendly backend (API and data store) that supports creating users
  and gardens. In CI, a dedicated test database is wiped or reset before each
  suite run; local development may use the same pattern or a persistent dev
  database with unique per-run identifiers when not resetting.
- Email verification and password reset are out of scope unless already implemented
  in the product; registration tests cover email/password only via full UI flows in
  the dedicated auth spec. Non-auth journey tests may bypass the sign-in UI using
  API or fixture shortcuts after user creation.
- Third-party catalog sync and offline IndexedDB behavior are covered at the
  integration level only where a signed-in online flow is sufficient; dedicated
  offline simulation may be deferred with documented exclusion. Catalog-dependent
  tests use the seeded minimal fixture catalog, not live external sync.
- Performance benchmarking (e.g., canvas frame rate) remains in separate bench
  scripts; this feature focuses on functional user-journey regression tests.
- Mobile phone end-to-end tests cover click-to-place planting only; bed/path
  layout editing and drag-based layout changes are desktop-scoped per product UX.
- Visual regression (pixel-diff screenshot comparison) is out of scope unless
  already established; contrast and presence checks are in scope.
- Crop rotation advisory warnings and geometric bed rotation may be covered by a
  single representative scenario each rather than exhaustive permutation tests.

## Dependencies

- Existing product features: account registration/sign-in, garden CRUD, layout
  editor, plant catalog, visual planner, planting validation, indoor starts.
- A test environment configuration that starts the application and provides a
  writable data backend for isolated test data.
- Prior specifications (`001-plant-database`, `002-garden-layout`,
  `003-visual-planner-ui`, `004-garden-drag-drop-ux`) as the source of user
  journeys to cover.

## Out of Scope

- Unit and integration test expansion (this feature targets full user-journey
  end-to-end coverage only).
- Load, stress, and security penetration testing.
- Testing admin-only or internal tooling not exposed to home gardeners.
- Pixel-perfect visual regression across all illustrations and themes.
- Exhaustive combinatorial testing of every soil type, sun option, and rotation
  permutation.
