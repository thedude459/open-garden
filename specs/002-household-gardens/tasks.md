---
description: "Task list for Household Gardens feature implementation"
---

# Tasks: Household Gardens

**Input**: Design documents from `/specs/002-household-gardens/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED per constitution. Vitest unit tests (≥80% coverage CI gate);
TDD ordering flexible. Zod contract smokes in `apps/api-e2e` run with `npm test`
(no live DB). Integration is Playwright against Compose Postgres (`npm run e2e`):
UI E2E plus HTTP request tests in `garden-api.spec.ts`.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Nx monorepo**: `apps/api/`, `apps/api-e2e/`, `apps/web/`, `apps/web-e2e/`,
  `libs/gardens/` (new), `libs/shared-types/`, `libs/plant-catalog-data/`,
  `libs/auth/`, `docs/adr/`, `apps/web/proxy.conf.json`, `scripts/ci/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the gardens domain library on the existing 001 workspace

- [x] T001 Create Nx library `libs/gardens` with `project.json` (test/lint targets matching `libs/plant-catalog/project.json`, tags `type:lib`, `scope:gardens`, `layer:domain`) and `libs/gardens/src/index.ts`
- [x] T002 [P] Add `@open-garden/gardens` path in `tsconfig.base.json` and Vitest alias plus coverage include for `libs/gardens/src/lib/**/*.ts` in `vitest.config.ts`
- [x] T003 [P] Export public API barrel (`domainError`, `validateSiteProfile`, `GardenService`, `MembershipService`) from `libs/gardens/src/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, schema, repositories, membership guard — MUST complete before any user story

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [x] T004 Implement garden DTOs (`GardenRole`, `MonthDayDto`, `MemberDto`, `GardenSummaryDto`, `GardenDetailDto`, `GardenCreateDto`, `GardenPatchDto`, `GardenInviteDto`, `GardenMemberPatchDto`) in `libs/shared-types/src/lib/garden.ts` per `specs/002-household-gardens/contracts/shared-types.ts.md`
- [x] T005 [P] Add Zod schemas for garden create/patch/list query/invite/member-patch (notes max 4000, name max 120, zone 1–13, pageSize default 20 max 100) in `libs/shared-types/src/lib/garden.schemas.ts`
- [x] T006 Re-export garden types and schemas from `libs/shared-types/src/index.ts`
- [x] T007 Add `gardens` and `garden_memberships` Drizzle tables, UNIQUE `(owner_id, name_normalized)`, partial unique owner membership, and indexes in `libs/plant-catalog-data/src/lib/schema.ts` per `specs/002-household-gardens/data-model.md`
- [x] T008 Add Drizzle migration SQL `libs/plant-catalog-data/migrations/0002_gardens.sql` and apply every `*.sql` from that directory in `apps/api/src/plants/sync-cli.ts`
- [x] T009 [P] Implement `GardenRepository` (insert, getById, listForUser, update, hard delete, owned-name lookup) in `libs/plant-catalog-data/src/lib/garden-repository.ts`
- [x] T010 [P] Implement `GardenMembershipRepository` (insert owner+invitee, get for user+garden, list members, update role, delete membership) in `libs/plant-catalog-data/src/lib/garden-membership-repository.ts`
- [x] T011 Export garden repositories from `libs/plant-catalog-data/src/index.ts`
- [x] T012 [P] Confirm ADR 0004 (garden membership vs `users.role`) at `docs/adr/0004-garden-membership.md`
- [x] T013 Implement session + membership guard: unauthenticated → 401; missing/non-member garden id → 404 (no existence leak) in `apps/api/src/gardens/garden-membership.guard.ts`
- [x] T014 [P] Use explicit `@Inject(AuthService)` on `SessionGuard` in `apps/api/src/auth/session.guard.ts` so tsx-hosted e2e can resolve sessions (no `design:paramtypes`)
- [x] T015 [P] Confirm Angular `/api` proxy to `http://localhost:3000` in `apps/web/proxy.conf.json` and `proxyConfig` on `web:serve` in `apps/web/project.json`
- [x] T016 Create NestJS `GardensModule` and import it from `apps/api/src/app.module.ts` in `apps/api/src/gardens/gardens.module.ts`

**Checkpoint**: Foundation ready — user stories can proceed

---

## Phase 3: User Story 1 - Create and Manage a Named Garden (Priority: P1) 🎯 MVP

**Goal**: Signed-in users create, list, open, rename/edit notes, and permanently delete gardens they own; strangers and anonymous users see nothing; previously loaded list/detail stay readable offline; mutations require connectivity.

**Independent Test**: Sign in as a user with no gardens, create a named garden, see it on the list, open detail, edit name and notes, confirm a second signed-in user who was never invited does not see that garden; cancel vs confirm delete; offline read of cached list/detail.

### Tests for User Story 1 (REQUIRED)

- [x] T017 [P] [US1] Vitest unit tests for name trim/blank reject, owner-scoped case-insensitive uniqueness, last-write-wins update, hard delete, and non-member isolation in `libs/gardens/src/lib/garden-service.spec.ts`
- [x] T018 [P] [US1] Zod contract smokes (no live DB) for garden create/patch/invite schemas and documented 404 error shape in `apps/api-e2e/src/gardens.spec.ts`
- [x] T019 [P] [US1] Playwright E2E: empty state, create, list, detail, rename/notes, cancel delete vs confirm delete and name reuse in `apps/web-e2e/src/garden-list.spec.ts`
- [x] T020 [P] [US1] Playwright E2E: after list+detail online, abort `**/api/gardens**` (not `setOffline` + reload) and still read cache; create/edit/delete while unreachable shows online-required within 5 seconds and does not mutate in `apps/web-e2e/src/garden-offline.spec.ts`

### Implementation for User Story 1

- [x] T021 [P] [US1] Implement garden domain service (create with owner membership in one transaction, list memberships, get detail including owner member row, patch name/notes, hard delete, `name_normalized` uniqueness against garden owner) in `libs/gardens/src/lib/garden-service.ts`
- [x] T022 [US1] Expose `GET /api/gardens`, `POST /api/gardens`, `GET/PATCH/DELETE /api/gardens/:id` mapping shared-types DTOs (owner+collaborator PATCH name/notes; owner-only DELETE; GET 404 for non-members) in `apps/api/src/gardens/gardens.controller.ts`
- [x] T023 [P] [US1] Implement Angular gardens API client using relative `/api` and `withCredentials` in `apps/web/src/app/gardens/gardens-api.service.ts`
- [x] T024 [P] [US1] Implement IndexedDB read-through cache for last-loaded garden list and detail (no mutation queue; 404 on detail deletes that cache entry) in `apps/web/src/app/gardens/garden-cache.service.ts`
- [x] T025 [US1] Implement standalone garden list page: empty state, create form (name + optional notes), paged list with name and `myRole` in `apps/web/src/app/gardens/garden-list.page.ts`
- [x] T026 [P] [US1] Implement standalone garden detail page: name, notes (or empty-notes state), current role, edit name/notes, confirm-then-delete in `apps/web/src/app/gardens/garden-detail.page.ts`
- [x] T027 [US1] Add auth-guarded `/gardens` and `/gardens/:id` routes in `apps/web/src/app/app.routes.ts` and a Gardens nav link in `apps/web/src/app/app.component.ts`
- [x] T028 [US1] Surface a clear online-required state (no silent fail, no queue) for create/edit/delete in `apps/web/src/app/gardens/gardens-api.service.ts` and the list/detail pages

**Checkpoint**: US1 MVP — create/list/detail/delete + isolation + offline read cache

---

## Phase 4: User Story 2 - Set Garden Site Conditions (Priority: P2)

**Goal**: Owners and collaborators set/clear hardiness zone and annual last/first frost dates; viewers read only; invalid frost pairs and out-of-range zones are rejected; unset fields display as not set.

**Independent Test**: Create or open a garden, set zone and both frost dates, reopen and see the same values; clear or omit frost dates and see “not set”; reversed or same-day frost rejected with prior values unchanged.

### Tests for User Story 2 (REQUIRED)

- [x] T029 [P] [US2] Vitest unit tests for zone 1–13, frost pair both-or-neither per date, last < first when both set, Feb 29 allowed, independent omission in `libs/gardens/src/lib/site-profile.spec.ts`
- [x] T030 [P] [US2] Zod contract smokes (no live DB) for site PATCH zone 1–13 and frost month-day shape in `apps/api-e2e/src/gardens-site.spec.ts`
- [x] T031 [P] [US2] Playwright E2E: set zone 7 + Apr 15 / Oct 20, reopen; clear first frost only; reject reversed and same-day in `apps/web-e2e/src/garden-site.spec.ts`

### Implementation for User Story 2

- [x] T032 [P] [US2] Implement site-profile validation (zone, month-day pairs, last-frost-before-first-frost) in `libs/gardens/src/lib/site-profile.ts`
- [x] T033 [US2] Apply site-profile validation on create and patch in `libs/gardens/src/lib/garden-service.ts` so invalid input returns `VALIDATION_ERROR` and leaves the stored row unchanged
- [x] T034 [US2] Add zone and last/first frost controls on `apps/web/src/app/gardens/garden-detail.page.ts` using native `<select value>` (not `[ngValue]`) so Playwright `selectOption` and reload persist; disable edits when `myRole` is `viewer`
- [x] T035 [US2] Render unset zone and frost dates as explicit “not set” (never invented defaults) on `apps/web/src/app/gardens/garden-detail.page.ts` and include `hardinessZone` on list rows in `apps/web/src/app/gardens/garden-list.page.ts`

**Checkpoint**: US1 + US2 — gardens with a usable site profile

---

## Phase 5: User Story 3 - Share a Garden by Email and Manage Membership (Priority: P3)

**Goal**: Owners invite existing accounts by email as collaborator or viewer; invitees see the garden immediately; owners change roles, remove, and transfer ownership; collaborators/viewers can leave; catalog and favorites stay unchanged.

**Independent Test**: User A creates a garden, invites User B (existing account) as collaborator; B sees and can edit name/notes/site but cannot invite or delete; User C sees nothing; A changes B to viewer and B cannot edit; B leaves or A removes B and B no longer sees the garden.

### Tests for User Story 3 (REQUIRED)

- [x] T036 [P] [US3] Vitest unit tests for invite unknown email, self-invite, duplicate member, collaborator/viewer permissions, last-owner cannot leave/demote, transfer (including owned-name CONFLICT) in `libs/gardens/src/lib/membership-service.spec.ts`
- [x] T037 [P] [US3] Zod contract smokes (no live DB) for invite/member-patch schemas and documented non-member 404 error shape in `apps/api-e2e/src/gardens-membership.spec.ts`
- [x] T038 [P] [US3] Playwright E2E: unknown-email invite failure, invite collaborator, collaborator edit vs refused invite/delete, demote to viewer, member list visible, stranger isolation, transfer/leave/remove in `apps/web-e2e/src/garden-share.spec.ts`
- [x] T039 [P] [US3] Playwright regression: two users sharing a garden still have private favorites and a shared plant catalog in `apps/web-e2e/src/garden-share-catalog.spec.ts`

### Implementation for User Story 3

- [x] T040 [P] [US3] Implement membership domain service (invite by normalized email, role collaborator|viewer only, patch role, transfer ownership demoting the current owner before promoting so `garden_memberships_one_owner_uidx` holds, updating `gardens.owner_id`, leave, owner remove) in `libs/gardens/src/lib/membership-service.ts`
- [x] T041 [US3] Expose member routes in `apps/api/src/gardens/garden-members.controller.ts` (any member GET; owner POST/PATCH; DELETE = owner remove other or self-leave for non-owners)
- [x] T042 [US3] Add member list (display name, email, role) and owner invite/role/remove/transfer UI on `apps/web/src/app/gardens/garden-detail.page.ts`
- [x] T043 [US3] Enforce online-required (no queue) for invite/role/leave/remove/transfer in `apps/web/src/app/gardens/gardens-api.service.ts`
- [x] T044 [US3] Enforce collaborator cannot manage membership or delete, viewer cannot PATCH garden fields (403), in `libs/gardens/src/lib/garden-service.ts` and `apps/api/src/gardens/garden-membership.guard.ts`

**Checkpoint**: All three user stories independently demonstrable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Coverage, YAGNI, quickstart, isolation hardening, CI parity, HTTP integration

- [x] T045 [P] Confirm plant catalog and favorites authorization is unchanged (no garden scoping) in `apps/api/src/plants/plants.controller.ts` and `apps/api/src/favorites/favorites.controller.ts`
- [x] T046 [P] Point operators at household-garden verify steps from `specs/002-household-gardens/quickstart.md` in `README.md`
- [x] T047 Confirm Vitest coverage ≥80% for `libs/gardens` (and that `vitest.config.ts` coverage include lists it)
- [x] T048 [P] Wire CI-parity scripts `scripts/ci/test.sh` and `scripts/ci/e2e.sh` to `npm test` / `npm run e2e` in `package.json` and `.github/workflows/ci.yml`
- [x] T049 YAGNI pass: no planting calendar, bed geometry, layout canvas, in-ground plantings, or care reminders in `apps/web` or `apps/api`
- [x] T050 Run `specs/002-household-gardens/quickstart.md` validation (create/list/detail, site profile, sharing, offline read, <2s local list/detail)
- [x] T051 Security pass: GET non-member stays 404, notes/name limits enforced, no secrets in garden code, errors use existing `ApiErrorDto` in `apps/api/src/gardens/`
- [x] T052 Playwright HTTP integration against live API+Postgres (401, stranger 404, CONFLICT duplicate owned name, last-write-wins, site PATCH validation, invite/list/viewer 403/transfer/leave) in `apps/web-e2e/src/garden-api.spec.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately (workspace already exists from 001)
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on Foundational; extends US1 garden PATCH/detail UI
- **US3 (Phase 5)**: Depends on Foundational + a garden resource from US1
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Foundational — no dependency on US2/US3
- **US2 (P2)**: After Foundational; practically extends US1 detail/PATCH
- **US3 (P3)**: After Foundational; needs garden ids from US1; site-profile collaborator edits reuse US2 fields

### Within Each User Story

- Tests required; ordering vs implementation flexible
- Shared contracts / library public interface before app wiring
- Library/service before REST endpoints before Angular UI
- Authorization and migrations with the story that needs them (schema is Foundational)
- Unit coverage complete; integration + Playwright when UI + API are ready

### Parallel Opportunities

- Phase 1: T002–T003 after T001
- Phase 2: T004–T005 parallel; T009–T010 parallel after T007; T012, T014, T015 parallel with schema work
- US1: T017–T020 tests parallel; T023–T024 parallel; T025–T026 parallel after API client
- US2: T029–T031 parallel; T032 parallel with tests
- US3: T036–T039 parallel; T040 parallel with tests
- Polish: T045–T046, T048 parallel

---

## Parallel Example: User Story 1

```bash
# Tests in parallel:
Task: "Vitest garden-service.spec.ts"
Task: "Zod contract smokes gardens.spec.ts"
Task: "Playwright garden-list.spec.ts"
Task: "Playwright garden-offline.spec.ts"
Task: "Playwright garden-api.spec.ts (HTTP integration)"

# Client in parallel:
Task: "gardens-api.service.ts"
Task: "garden-cache.service.ts"

# UI in parallel after API client + cache:
Task: "garden-list.page.ts"
Task: "garden-detail.page.ts"
```

---

## Parallel Example: User Story 3

```bash
Task: "membership-service.ts"
Task: "garden-members.controller.ts"
Task: "Vitest membership-service.spec.ts"
Task: "API gardens-membership.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (`libs/gardens`)
2. Complete Phase 2: Foundational (CRITICAL) including SessionGuard `@Inject` and `/api` proxy
3. Complete Phase 3: US1 (CRUD, isolation, offline read, tests)
4. **STOP and VALIDATE** via quickstart P1 checks
5. Demo named gardens before sharing/site profile

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → MVP gardens + isolation + offline read
3. US2 → site profile (calendar foundation); native select values
4. US3 → email invite and membership
5. Polish → coverage, YAGNI, quickstart, `npm test` / `npm run e2e`

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Then: Developer A finishes US1 UI; B starts US2 site-profile domain; C starts US3 membership domain (after garden ids exist)

---

## Notes

- [P] = different files, no incomplete dependencies
- [USn] maps to spec user stories for traceability
- Checkboxes are `[x]` because this feature is already implemented on `002-household-gardens`
- Commit after each task or logical group
- Stop at checkpoints to validate independently
- Avoid: new NgModules, GraphQL/tRPC, duplicated DTOs outside `libs/shared-types`, a second data lib, offline mutation queue, plant-provider calls, conflating garden roles with `users.role`, implicit Nest constructor injection under tsx
- Catalog and favorites libs stay unmodified except shared-types additions
- Do not start 003–006 application code until this feature is closed
