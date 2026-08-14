# Implementation Plan: Household Gardens

**Branch**: `002-household-gardens` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-household-gardens/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver household gardens as first-class shared resources: named gardens with
optional notes and a site profile (hardiness zone, last/first frost dates),
membership roles (owner / collaborator / viewer), invite by existing account
email, and isolation from the plant catalog and private favorites. Domain logic
lives in a new `libs/gardens` library; persistence extends the existing Drizzle
schema in `libs/plant-catalog-data`; REST DTOs go in `libs/shared-types`. The
Angular PWA lists/opens gardens with an IndexedDB read cache for previously
loaded list/detail. Mutations (create, edit, delete, membership) are
online-only. No planting calendar, beds, layout, or care reminders.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS REST API; Angular standalone PWA
(service worker); Drizzle ORM; Vitest; Playwright; shared-types lib; existing
session auth (`libs/auth`)

**Storage**: PostgreSQL 16+ via Drizzle migrations (`gardens`,
`garden_memberships`); client IndexedDB (or Cache API) for last-loaded garden
list/detail reads only — no mutation queue

**Testing**: Vitest (unit, ≥80% coverage CI gate) for `libs/gardens`; API
integration tests for membership isolation and uniqueness; Playwright E2E once
UI + API work

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo);
household multi-user deployment

**Project Type**: Nx monorepo — `apps/api` + `apps/web` + feature/domain libs

**Performance Goals**: Garden list and detail feel responsive (<2s first load on
local network under household load). Delete confirm is a client step before one
DELETE. Last-write-wins saves return the stored garden in the same response.
Verified manually via quickstart.

**Constraints**: REST API only; library-first `libs/gardens`; no new plant
provider calls; garden membership authZ first-class (distinct from
`users.role` admin/user); offline read cache only; no calendar/layout/plantings

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
- [x] **Testing Gates**: Vitest unit tests planned (≥80% coverage); integration
  + Playwright E2E planned for feature completion
- [x] **Security**: Input validation / secure defaults considered; no hardcoded
  secrets; CI SCA/SAST/secrets scanning remain applicable
- [x] **Self-Hosted**: Any infra/deploy needs are in-repo (e.g. Docker Compose)
- [x] **ADR**: Significant decisions recorded or flagged for an ADR

### Post-design re-check

All gates remain satisfied after Phase 1. Garden membership is modeled as
resource roles (not a new global `users.role`). Schema lives in the existing
Drizzle lib (no extra data package). Offline is read-cache only (YAGNI vs
favorites queue). No plant-provider usage. ADR 0004 records membership vs
account-role. Confirm-delete is a UI step over a hard SQL delete.

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
├── api-e2e/                  # API integration tests (gardens isolation)
├── web/                      # Angular standalone PWA
└── web-e2e/                  # Playwright E2E

libs/
├── shared-types/             # Garden DTOs / membership enums (extend)
├── gardens/                  # NEW domain: create, site profile, membership, uniqueness, frost rules
├── plant-catalog-data/       # Extend Drizzle: gardens + garden_memberships + repos
├── auth/                     # Existing session; garden guards consume AuthUser
├── plant-catalog/            # Unchanged — catalog remains shared reference data
└── plant-favorites/          # Unchanged — favorites remain private

# Notable web paths
apps/web/src/app/gardens/garden-list.page.ts
apps/web/src/app/gardens/garden-detail.page.ts
apps/web/src/app/gardens/garden-cache.service.ts
apps/api/src/gardens/

docs/adr/
├── 0001-orm-drizzle.md
├── 0002-auth-sessions.md
├── 0003-plant-provider-port.md
└── 0004-garden-membership.md   # NEW: resource roles vs users.role

docker-compose.yml
```

**Structure Decision**: Garden domain logic lives in `libs/gardens` with a
clear public API (create/update/delete, site profile validation, membership
invite/role/leave/transfer, owner-scoped name uniqueness). Persistence stays in
`libs/plant-catalog-data` — one Drizzle schema/migration home (YAGNI: no second
data lib). `apps/api` is a thin REST host with a membership guard. `apps/web`
adds standalone garden pages and a read-through cache. Catalog and favorites
libs are not modified except shared-types additions.

## Complexity Tracking

> No constitution violations. Resource-level membership is required by Principle
> V (not speculative). Reusing `plant-catalog-data` for garden tables avoids an
> extra Nx project.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
