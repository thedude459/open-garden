---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: REQUIRED per constitution. Every feature MUST include Vitest unit
tests (≥80% coverage CI gate). TDD ordering is flexible (tests need not
precede implementation), but no story is complete without unit coverage.
Once UI and backend are functional, integration tests and Playwright E2E
tests are also REQUIRED before the feature is considered complete.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Nx monorepo** (Open Garden): `apps/api/`, `apps/web/`, `libs/[feature]/`,
  `libs/shared-types/`
- Adjust concrete paths based on plan.md structure

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit-tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create Nx workspace structure per implementation plan (apps/ + libs/)
- [ ] T002 Initialize TypeScript strict mode and shared-types library
- [ ] T003 [P] Configure Vitest, linting, and formatting

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T004 Setup PostgreSQL schema and migrations framework
- [ ] T005 [P] Implement authentication/authorization (roles + sharing primitives)
- [ ] T006 [P] Setup REST API routing and middleware structure
- [ ] T007 Create base entities / shared contracts all stories depend on
- [ ] T008 Configure secure error handling (no secret leakage)
- [ ] T009 Setup environment configuration and in-repo deploy stubs (e.g. Compose)
- [ ] T010 [P] Plant-data provider abstraction interface (if feature uses external plant data)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 (REQUIRED) ✅

> **NOTE**: TDD ordering is flexible — tests may follow implementation — but
> coverage MUST exist before the story is marked complete. Prefer Vitest unit
> tests alongside the library under `libs/` or app under `apps/`.

- [ ] T011 [P] [US1] Vitest unit tests for [lib/service] in libs/[feature]/src/
- [ ] T012 [P] [US1] Integration test for [user journey] in apps/api-e2e/ or equivalent
- [ ] T013 [P] [US1] Playwright E2E for [critical path] once UI + API are functional

### Implementation for User Story 1

- [ ] T014 [P] [US1] Add/extend shared contracts in libs/shared-types/
- [ ] T015 [P] [US1] Implement library module with public interface in libs/[feature]/
- [ ] T016 [US1] Implement REST endpoint(s) in apps/api/ (depends on T014, T015)
- [ ] T017 [US1] Implement Angular standalone UI in apps/web/
- [ ] T018 [US1] Enforce authorization (roles/sharing) on affected resources
- [ ] T019 [US1] Add input validation and safe error handling
- [ ] T020 [US1] Add PostgreSQL migration if schema changes are required

**Checkpoint**: User Story 1 is functional, authorized, and covered by unit +
integration/E2E as applicable; coverage ≥80% for touched libs/apps

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (REQUIRED) ✅

- [ ] T021 [P] [US2] Vitest unit tests for [lib/service] in libs/[feature]/src/
- [ ] T022 [P] [US2] Integration test for [user journey]
- [ ] T023 [P] [US2] Playwright E2E for [critical path] once UI + API are functional

### Implementation for User Story 2

- [ ] T024 [P] [US2] Add/extend shared contracts in libs/shared-types/
- [ ] T025 [US2] Implement library module in libs/[feature]/
- [ ] T026 [US2] Implement REST endpoint(s) in apps/api/
- [ ] T027 [US2] Implement Angular standalone UI in apps/web/
- [ ] T028 [US2] Enforce authorization; integrate with US1 only where needed

**Checkpoint**: User Stories 1 AND 2 both work independently with required tests

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (REQUIRED) ✅

- [ ] T029 [P] [US3] Vitest unit tests for [lib/service] in libs/[feature]/src/
- [ ] T030 [P] [US3] Integration test for [user journey]
- [ ] T031 [P] [US3] Playwright E2E for [critical path] once UI + API are functional

### Implementation for User Story 3

- [ ] T032 [P] [US3] Add/extend shared contracts in libs/shared-types/
- [ ] T033 [US3] Implement library module in libs/[feature]/
- [ ] T034 [US3] Implement REST endpoint(s) in apps/api/
- [ ] T035 [US3] Implement Angular standalone UI in apps/web/

**Checkpoint**: All user stories independently functional with required tests

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX [P] ADR(s) for significant architectural decisions
- [ ] TXXX Code cleanup and refactoring (YAGNI — remove speculative abstractions)
- [ ] TXXX Confirm Vitest coverage ≥80% for touched projects
- [ ] TXXX Security hardening (validation, least privilege, no secrets in code)
- [ ] TXXX Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests are REQUIRED; ordering vs implementation is flexible (constitution)
- Shared contracts / library public interface before app wiring
- Library/service before REST endpoints before Angular UI
- Authorization and migrations with the story that needs them
- Unit coverage complete; integration + Playwright when UI + API are ready
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch unit/integration tests for User Story 1 together:
Task: "Vitest unit tests for [lib/service] in libs/[feature]/src/"
Task: "Integration test for [user journey]"

# Launch contract + library work together:
Task: "Add/extend shared contracts in libs/shared-types/"
Task: "Implement library module with public interface in libs/[feature]/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Confirm required Vitest/integration/Playwright coverage before marking complete
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence,
  direct external plant-provider calls, new NgModules, protocol drift from REST
