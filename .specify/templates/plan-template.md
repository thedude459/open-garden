# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; TypeScript backend; Angular (standalone
components only); shared types package within the workspace

**Storage**: PostgreSQL (schema changes via migrations only)

**Testing**: Vitest (unit, ≥80% coverage CI gate); integration tests;
Playwright (E2E) required once UI + backend are functional for the feature

**Target Platform**: Self-hosted offline-capable PWA (e.g. Docker / home lab);
deployment config lives in-repo

**Project Type**: Nx monorepo — backend API app + Angular frontend app + libs

**Performance Goals**: [domain-specific, e.g., usable offline sync latency,
snappy garden layout interactions or NEEDS CLARIFICATION]

**Constraints**: REST API only (no GraphQL/tRPC without constitution amendment);
library-first modules; plant providers only via internal abstraction;
multi-user roles/sharing from v1; offline-capable PWA

**Scale/Scope**: [domain-specific, e.g., household multi-user gardens,
N plant catalog entries or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] **Library-First**: Feature is planned as standalone lib(s) with a clear
  public interface, not app-coupled-only code
- [ ] **Provider Abstraction**: Any plant/external data access goes through an
  internal interface — no direct provider API calls from features
- [ ] **Simplicity (YAGNI)**: No speculative abstractions; Complexity Tracking
  filled if any deviation is proposed
- [ ] **Multi-User**: Data model and API design include roles, sharing, and
  authorization as first-class concerns (not deferred)
- [ ] **Type Safety & Shared Contracts**: Strict TypeScript; contracts live in
  the shared types package; no duplicated API types
- [ ] **REST Boundary**: Backend exposes REST; frontend is a REST client only
- [ ] **Angular Standalone**: New UI uses standalone components only (no new
  NgModules)
- [ ] **PostgreSQL Migrations**: Schema changes are migration-managed
- [ ] **Testing Gates**: Vitest unit tests planned (≥80% coverage); integration
  + Playwright E2E planned for feature completion
- [ ] **Security**: Input validation / secure defaults considered; no hardcoded
  secrets; CI SCA/SAST/secrets scanning remain applicable
- [ ] **Self-Hosted**: Any infra/deploy needs are in-repo (e.g. Docker Compose)
- [ ] **ADR**: Significant decisions recorded or flagged for an ADR

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete Nx
  layout for this feature (apps/, libs/). The delivered plan must use real
  paths — not Option labels.
-->

```text
apps/
├── api/                 # TypeScript backend (REST)
└── web/                 # Angular PWA (standalone components)

libs/
├── shared-types/        # Shared API contracts (backend + frontend)
├── plant-data/          # Example: plant domain lib + provider abstraction
└── [feature-lib]/     # Library-first feature modules

# Infra (in-repo)
docker-compose.yml
```

**Structure Decision**: [Document the selected Nx apps/libs layout and reference
the real directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
