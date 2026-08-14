# Implementation Plan: Household Gardens

**Branch**: `002-household-gardens` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-household-gardens/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver household gardens as first-class shared resources: named gardens with
optional notes and a site profile (hardiness zone, last/first frost dates),
membership roles (owner / collaborator / viewer), invite by existing account
email, and isolation from the plant catalog and private favorites. Domain logic
lives in `libs/gardens`; persistence extends Drizzle in `libs/plant-catalog-data`;
REST DTOs live in `libs/shared-types`. The Angular PWA lists/opens gardens with
an IndexedDB read cache for previously loaded list/detail. Mutations (create,
edit, delete, membership) are online-only. No planting calendar, beds, layout,
or care reminders.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS REST API; Angular standalone PWA;
Drizzle ORM; Vitest; Playwright; `libs/shared-types`; existing session auth
(`libs/auth`). API is started with `tsx` in local/CI e2e — Nest providers that
need constructor injection MUST use explicit `@Inject(...)` (tsx/esbuild does
not emit `design:paramtypes`).

**Storage**: PostgreSQL 16+ via Drizzle migrations (`0002_gardens.sql`:
`gardens`, `garden_memberships`). Client IndexedDB for last-loaded garden
list/detail reads only — no mutation queue. Sync CLI applies every `*.sql` in
`libs/plant-catalog-data/migrations`.

**Testing**: Vitest unit tests (≥80% coverage CI gate) for `libs/gardens`.
`apps/api-e2e` holds Zod contract smokes that run in `npm test` without a live
DB. Integration and E2E are Playwright against Compose Postgres (`npm run e2e`
/ `scripts/ci/e2e.sh`): UI specs (`garden-*.spec.ts`) plus HTTP request tests
in `apps/web-e2e/src/garden-api.spec.ts` (401, non-member 404, CONFLICT, site
validation, membership). Local/CI: `npm test` then `npm run e2e`.

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo);
household multi-user deployment. Web talks to the API via same-origin `/api`
proxied to Nest (`apps/web/proxy.conf.json`) so session cookies stay first-party.

**Project Type**: Nx monorepo — `apps/api` + `apps/web` + feature/domain libs

**Performance Goals**: Garden list and detail feel responsive (<2s first load on
local network under household load). Delete confirm is a client step before one
DELETE. Last-write-wins saves return the stored garden in the same response.

**Constraints**: REST API only; library-first `libs/gardens`; no new plant
provider calls; garden membership authZ first-class (distinct from
`users.role` admin/user); offline read cache only; no calendar/layout/plantings
(003–006 stay spec-only until this feature is done)

**Scale/Scope**: Household multi-user (tens of users, tens of gardens per user);
default garden list page size 20; notes max 4000 characters

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Library-First**: Feature is planned as standalone lib(s) with a clear
  public interface, not app-coupled-only code
- [x] **Provider Abstraction**: Any plant/external data access goes through an
  internal interface — no direct provider API calls from features
- [x] **Simplicity (YAGNI)**: No speculative abstractions; Complexity Tracking
  filled if any deviation is proposed
- [x] **Multi-User**: Data model and API design include roles, sharing, and
  authorization as first-class concerns (not deferred)
- [x] **Type Safety & Shared Contracts**: Strict TypeScript; contracts live in
  the shared types package; no duplicated API types
- [x] **REST Boundary**: Backend exposes REST; frontend is a REST client only
- [x] **Angular Standalone**: New UI uses standalone components only (no new
  NgModules)
- [x] **PostgreSQL Migrations**: Schema changes are migration-managed
- [x] **Testing Gates**: Vitest unit tests (≥80% coverage); Zod contract smokes
  in `apps/api-e2e` (no live DB); integration + Playwright E2E against Compose
  Postgres (`scripts/ci/e2e.sh`, including HTTP tests in `garden-api.spec.ts`)
- [x] **Security**: Input validation / secure defaults considered; no hardcoded
  secrets; CI SCA/SAST/secrets scanning remain applicable
- [x] **Self-Hosted**: Any infra/deploy needs are in-repo (e.g. Docker Compose)
- [x] **ADR**: Significant decisions recorded or flagged for an ADR

### Post-design re-check

All gates remain satisfied after Phase 1. Garden membership is modeled as
resource roles (not a new global `users.role`). Schema lives in the existing
Drizzle lib (no extra data package). Offline is read-cache only (YAGNI vs
favorites queue). No plant-provider usage. ADR 0004 records membership vs
account-role. Confirm-delete is a UI step over a hard SQL delete. Nest session
guard uses explicit `@Inject(AuthService)` so tsx-hosted API e2e can resolve
sessions. Non-member GET is 404 (no existence leak). Viewer PATCH is 403.

## Project Structure

### Documentation (this feature)

```text
specs/002-household-gardens/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/                      # NestJS REST host; gardens controllers + guards
├── api-e2e/                  # Zod contract smokes (no live DB; npm test)
├── web/                      # Angular standalone PWA
└── web-e2e/                  # Playwright: UI E2E + HTTP integration (garden-*.spec.ts)

libs/
├── shared-types/             # Garden DTOs / membership enums (extend)
├── gardens/                  # Domain: create, site profile, membership, uniqueness, frost rules
├── plant-catalog-data/       # Drizzle: gardens + garden_memberships + repos
├── auth/                     # Existing session; garden guards consume AuthUser
├── plant-catalog/            # Unchanged — catalog remains shared reference data
└── plant-favorites/          # Unchanged — favorites remain private

# Notable web paths
apps/web/src/app/gardens/garden-list.page.ts
apps/web/src/app/gardens/garden-detail.page.ts
apps/web/src/app/gardens/garden-cache.service.ts
apps/web/src/app/gardens/gardens-api.service.ts
apps/web/proxy.conf.json
apps/api/src/gardens/
apps/api/src/auth/session.guard.ts   # @Inject(AuthService) required under tsx

docs/adr/
├── 0001-orm-drizzle.md
├── 0002-auth-sessions.md
├── 0003-plant-provider-port.md
└── 0004-garden-membership.md   # resource roles vs users.role

docker-compose.yml
scripts/ci/test.sh
scripts/ci/e2e.sh
```

**Structure Decision**: Garden domain logic lives in `libs/gardens` with a
clear public API (`GardenService`, `MembershipService`, `validateSiteProfile`,
`domainError`). Persistence stays in `libs/plant-catalog-data` — one Drizzle
schema/migration home (YAGNI: no second data lib). `apps/api` is a thin REST
host with `SessionGuard` plus `GardenMembershipGuard`. `apps/web` adds
standalone garden pages, native `<select value>` bindings for zone/frost, and a
read-through IndexedDB cache. Catalog and favorites libs are not modified except
shared-types additions.

## Complexity Tracking

> No constitution violations. Resource-level membership is required by Principle
> V (not speculative). Reusing `plant-catalog-data` for garden tables avoids an
> extra Nx project.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
