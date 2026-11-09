# Open Garden — Project Principles (Constitution)

## Core Principles

### I. Library-First

Every feature (plant database, planting calendar, garden layout designer,
and similar capabilities) MUST be implemented as a standalone, independently
testable library or module with a clear public interface. Feature code MUST
NOT live only as app-coupled folders without a defined boundary. Libraries
MUST be self-contained, independently testable, and purposeful — not
organizational-only packaging.

**Rationale**: Clear module boundaries enable reuse, independent verification,
and evolution of the offline-capable PWA without tangled app-layer coupling.

### II. Testing Completeness

Tests are REQUIRED for all features. TDD ordering is flexible: tests need
not be written before implementation. No feature is complete without test
coverage. Once UI and backend are functional for a given feature, integration
tests and end-to-end tests (Playwright) are also REQUIRED before that feature
is considered complete.

**Rationale**: Coverage and verification matter more than ceremony; flexible
ordering must not weaken the definition of "done."

### III. External Provider Abstraction

All external plant data providers (e.g. Trefle, Perenual, USDA PLANTS) MUST
be accessed only through an internal abstraction or interface layer. No
feature or library MAY call a specific provider's API directly.

**Rationale**: Keeps providers swappable and avoids vendor lock-in as data
sources change or fail.

### IV. Simplicity (YAGNI)

Avoid speculative abstraction, extra configuration, or generalized frameworks
for needs that do not yet exist. Build the simplest thing that satisfies the
current requirement. Complexity MUST be justified against a concrete requirement.

**Rationale**: Premature generality slows delivery and obscures the domain
in principle VIII. YAGNI is not a ban on later work for seasons, companion
advice, or orchards.

### V. Multi-User Access Control as First-Class Concern

The application MUST support full multi-user access with roles and sharing
(e.g. shared gardens, per-user permissions) from v1. This is NOT a
single-user product and MUST NOT be deferred. The data model and API MUST
treat authorization as a first-class design concern from the start.

**Rationale**: Retrofitting multi-tenant access control is costly and
error-prone; garden sharing is a core product expectation.

### VI. Type Safety & Shared Contracts

TypeScript strict mode is mandatory across backend and frontend: full strict
compiler flags MUST be enabled, and the `any` type is disallowed.
Type-safety violations are build failures, not warnings. Backend and frontend
MUST consume a single shared TypeScript types/interfaces package (published
within the Nx monorepo) for all data contracts crossing the API boundary.
Duplicated type definitions across apps are forbidden.

**Rationale**: Shared contracts keep the REST boundary synchronized; strict
typing catches integration errors at compile time.

### VII. Documented Architecture Decisions

Significant architectural or technical decisions (e.g. choice of ORM, auth
strategy, provider abstraction design) MUST be recorded as Architecture
Decision Records (ADRs) in the repository, capturing context, decision, and
consequences.

**Rationale**: Future contributors need the "why," not only the "what."

### VIII. Product Purpose

The product MUST help a household plan a garden, see it, and maintain it
across years.

- A planting MUST be able to belong to a season. A planting MUST also be able
  to persist across seasons, so a perennial or a tree is not modeled only as
  a one-year annual.
- Companion suggestions (helps, hinders, pollinates) are in scope when a feature
  asks for them. They are advice. They MUST NOT block save unless that feature
  says so. Spacing remains the hard gate.
- A property is the garden record. A vegetable garden, an orchard, a
  bramble patch, and a greenhouse are typed areas on that same record, not a
  second product or a second database. Vegetable beds are raised or
  in-ground. An orchard is one bed per tree, and underplanting may share that
  bed. A bramble area holds cane fruit (raspberries, blackberries) and is its
  own area type, not part of an orchard. A greenhouse is named trays.
- Each area type declares which plants it accepts, by growth habit and use
  from the catalog (for example, a vegetable area and a tray do not take
  trees, shrubs, or canes; an orchard takes fruit and nut trees plus
  herbaceous underplanting). A mismatch is **blocked**, like spacing — it is
  a hard gate, not advice. New area types are added to that one list, not by
  schema changes.
- Principle IV still holds. An orchard canvas, a crop-family taxonomy, or a
  companion graph MUST NOT be built until a feature needs it. A provider
  call for companion pairs MUST NOT be added until a real source exists;
  until then, pairs are household data. Principle III applies once a provider
  is used.

**Rationale**: The layout and reminder features left companions and
multi-year plants out of those versions. That exclusion is not permanent.
The planting record has to be able to outlive a single season before an
orchard feature arrives.

## Technology Stack

- **Workspace**: Nx monorepo; TypeScript backend and Angular frontend are
  separate apps/libs in the same workspace.
- **API protocol**: Backend exposes a REST API; Angular frontend consumes it
  as a REST client. GraphQL, tRPC, or other protocols MUST NOT be introduced
  without amending this constitution.
- **Frontend**: Angular standalone components exclusively. NgModules MUST NOT
  be introduced for new features.
- **Persistence**: PostgreSQL. All schema changes MUST be managed through
  migrations — no ad hoc schema edits.
- **Deployment**: Self-hosted (e.g. home lab, Docker), not cloud-provider
  managed PaaS. Infrastructure and deployment configuration (e.g. Docker
  Compose) MUST live in the repository.
- **Client form factor**: Offline-capable Progressive Web App (PWA).
- **Unit testing**: Vitest is the required unit testing framework for both
  backend and frontend.

## Quality & Security Gates

- **Coverage**: Every feature MUST maintain 80% or greater unit test coverage,
  enforced as a hard CI gate. A pull request that drops coverage below 80%
  fails the build and MUST NOT merge.
- **Integration & E2E**: After UI and backend are functional for a feature,
  integration tests and Playwright end-to-end tests are REQUIRED for
  completion.
- **Automated scanning**: CI MUST run on every change: software composition
  analysis (SCA) for vulnerable/outdated dependencies, static application
  security testing (SAST) for code-level vulnerabilities, and secrets scanning
  (e.g. gitleaks). Any high-severity finding blocks merge.
- **Secure coding**: All code MUST follow secure coding practices — input
  validation, least privilege, safe error handling, no hardcoded secrets,
  secure defaults — in addition to automated scanning gates.

## Coding style: simplest thing that works

Lazy means efficient, not careless. The best code is the code never written.
After you understand the problem (read the task and the code it touches,
trace the real flow end to end), stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse the helper or pattern.
3. Does the standard library or a native platform feature cover it?
4. Does an already-installed dependency solve it?
5. Can this be one line?
6. Only then: write the minimum code that works.

- Fix the root cause, not the symptom: grep every caller of the function you
  touch and fix the shared function once.
- No abstractions, dependencies, or boilerplate nobody asked for. Deletion
  over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins, but only once you understand the problem. The
  smallest change in the wrong place is a second bug.
- Question complex requests: "Do you actually need X, or does Y cover it?"
- When two approaches are the same size, pick the edge-case-correct one.
- Mark deliberate simplifications that cut a real corner with a known
  ceiling (global lock, O(n²) scan, naive heuristic) with a `ponytail:`
  comment naming the ceiling and the upgrade path.

Never lazy about: understanding the problem, input validation at trust
boundaries, error handling that prevents data loss, security, accessibility,
or anything explicitly requested. Non-trivial logic leaves one runnable check
behind — the smallest test that fails if the logic breaks.

The visual design system (brand, palette, type, components) is in
`docs/design-system.md`.

## Glossary

Use one word per concept, in the UI and in code comments:

- **Property** — a household's garden record (the `gardens` table).
- **Area** — a typed part of a property: vegetable garden, orchard, bramble
  patch, or greenhouse.
- **Bed** — a plot inside an area, raised or in-ground. An orchard is one bed
  per tree.
- **Tray** — a named seed-starting tray in a greenhouse. Nothing else is a tray.
- **Planting** — one plant grown in a property, for a season or across seasons.
- **Direct seed** — a planting sown where it grows.
- **Transplant** — a planting started elsewhere and moved into a bed.
  **Waiting transplants** are ones not yet in a bed.
- **Plants in beds** — plantings placed on the plan (not "placements").

## Working in this repo

- Plan a change in the pull request description: problem, approach, and how
  it is tested. Record lasting decisions as an ADR in `docs/adr/`.
- The product roadmap lives in `docs/roadmap.md`.
- `npm test` runs every unit test and the coverage gate; `npm run e2e` runs
  Playwright against a seeded stack. See `README.md` for setup.

## Governance

These principles supersede conflicting local practices. Change them with a
pull request that edits this file and says why. When a change is
architectural, add an ADR. Pull requests and reviews check new work against
these principles; a deliberate exception is stated in the PR description.
