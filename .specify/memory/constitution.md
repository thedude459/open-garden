<!--
Sync Impact Report:
- Version change: (none) → 1.0.0
- Modified principles: N/A (initial ratification from template placeholders)
- Added sections:
  - Core Principles (I–VII)
  - Technology Stack
  - Quality & Security Gates
  - Governance
- Removed sections: N/A (template placeholders replaced)
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated
  - .specify/templates/spec-template.md ✅ updated
  - .specify/templates/tasks-template.md ✅ updated
  - .specify/templates/checklist-template.md ✅ updated
  - .specify/templates/commands/*.md ⚠ none present (N/A)
  - README.md / docs/quickstart.md ⚠ not present yet
- Follow-up TODOs: None
-->

# Open Garden Constitution

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
current spec. Complexity MUST be justified against a concrete requirement.

**Rationale**: Premature generality slows delivery and obscures the real
domain model of home garden planning.

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

## Governance

This constitution supersedes conflicting local practices and informal
conventions. Amendments MUST be documented by updating
`.specify/memory/constitution.md`, bumping `CONSTITUTION_VERSION` per
semantic versioning (MAJOR for incompatible principle removals/redefinitions,
MINOR for new or materially expanded principles/sections, PATCH for
clarifications), and propagating changes to dependent templates and guidance.

All pull requests and design reviews MUST verify compliance with these
principles. Complexity or deviations MUST be justified in the plan's
Complexity Tracking table and, when architectural, via an ADR. Runtime
development guidance lives alongside Spec Kit artifacts under `.specify/`;
feature work proceeds through specify → plan → tasks → implement with a
passing Constitution Check at plan time.

**Version**: 1.0.0 | **Ratified**: 2026-08-01 | **Last Amended**: 2026-08-01
