# Implementation Plan: Garden Layout Designer

**Branch**: `005-garden-layout` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-garden-layout/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver a per-garden **to-scale plan** of the same named beds and seasonal
plantings as 004: rectangular beds (length/width in inches, 90-degree
orientation), plantings placed as centers in **bed-local** coordinates,
center-to-center spacing using the **larger** catalog value, fit as
`ceil(s / 2)` inches from bed edges. Domain logic lives in `libs/garden-layout`.
Persistence extends Drizzle in `libs/plant-catalog-data` (geometry columns on
`garden_beds` / `garden_plantings`). REST DTOs live in `libs/shared-types`.
One transactional `PUT /api/gardens/:id/layout` is refused (422) while any
blocking spacing/fit flag exists. The Angular PWA adds a layout page with
native controls, in-page confirm for bed delete, IndexedDB **read** cache, and
**no** layout mutation queue. Calendar plans are not layout objects. Viewers
read; non-members get 404.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS REST API; Angular standalone PWA;
Drizzle ORM; Vitest; Playwright; `libs/shared-types`; existing session auth
(`libs/auth`); existing garden membership (`libs/gardens`,
`GardenMembershipGuard`). API is started with `tsx` in local/CI e2e — Nest
providers that need constructor injection MUST use explicit `@Inject(...)`.
Reuse 004 bed POST/DELETE and planting identity; do not call plant providers.

**Storage**: PostgreSQL 16+ via Drizzle migrations (`0005_garden_layout.sql`:
nullable geometry on `garden_beds`, nullable layout x/y on `garden_plantings`).
Client IndexedDB `og-layout` for last successful GET only. Sync CLI applies
every `*.sql` in `libs/plant-catalog-data/migrations`. Inches are SQL
`integer`.

**Testing**: Vitest unit tests (≥80% coverage CI gate) for
`libs/garden-layout` (pair spacing, fit, rotate-does-not-move-local-coords,
evaluateLayout save gate, PUT snapshot apply with in-memory repos).
`apps/api-e2e` holds Zod contract smokes that run in `npm test` without a live
DB. Integration and E2E are Playwright against Compose Postgres
(`npm run e2e` / `scripts/ci/e2e.sh`): UI specs (`layout-*.spec.ts`) plus HTTP
tests in `apps/web-e2e/src/garden-layout-api.spec.ts` (401, non-member 404,
viewer 403, 422 too-close with `Layout has spacing or fit problems`, mixed-spacing
larger-wins, `ceil(s/2)` fit, unavailable does not block, deprecated variety
still labeled, confirm/cancel bed delete, rotate keeps placements, overflow
flags and refuses save, offline abort read-only). Local/CI: `npm test` then
`npm run e2e`.

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo);
household multi-user deployment. Web talks to the API via same-origin `/api`
proxied to Nest (`apps/web/proxy.conf.json`) so session cookies stay first-party.

**Project Type**: Nx monorepo — `apps/api` + `apps/web` + feature/domain libs

**Performance Goals**: Technical first-load target (distinct from SC-001
three-minute usability study): layout GET + first paint <2s on local network
after the garden is open. This is a **manual quickstart check**, not a CI
coverage or Playwright timing gate. `evaluateLayout` is in-memory on tens to
low hundreds of placements (O(n²) per bed is acceptable).

**Constraints**: REST API only; library-first `libs/garden-layout`; no direct
plant-provider calls; garden membership authZ reused; plantings ≠ calendar ≠
favorites; layout mutations online-only; planting-list queue unchanged; no
companion rules, polygons, GPS, or layout mutation queue.

**Scale/Scope**: Household multi-user; tens of gardens per user; tens of named
beds per garden; tens to low hundreds of planting rows per garden. Integer
inches; no GIS.

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

All gates remain satisfied after Phase 1. Layout access reuses garden
membership (ADR 0004) — no new `users.role`. Schema stays in
`plant-catalog-data` (no extra data package). Spacing, fit, and orientation are
pure functions in `libs/garden-layout`. `LayoutService` injects catalog-data
repositories and MUST NOT import Nest, Perenual HTTP, or Drizzle schema/SQL.
Angular imports only the pure helpers plus DTOs — not repositories. Catalog
spacing comes from existing plant rows (no provider calls). Offline is GET
cache only. Non-member GET/PUT is 404. Viewer PUT is 403. Nest controllers use
explicit `@Inject(...)`. Confirmed bed delete remains 004 hard DELETE plus
clearing layout coords. ADR 0007 records bed-local coords, atomic PUT, and the
save gate.

## Project Structure

### Documentation (this feature)

```text
specs/005-garden-layout/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md                 # created later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/
├── api/                      # NestJS REST host; layout under gardens/:id
├── api-e2e/                  # Zod contract smokes (no live DB; npm test)
├── web/                      # Angular standalone PWA
└── web-e2e/                  # Playwright: UI + HTTP (layout-*.spec.ts)

libs/
├── shared-types/             # Layout DTOs + Zod
├── garden-layout/            # Domain: evaluateLayout, rotate, fit, spacing
├── seasonal-plantings/       # PATCH bedId must clear layout coords
├── plant-catalog-data/       # Drizzle: geometry columns
├── planting-calendar/        # Unchanged — not on the canvas
├── plant-catalog/            # Unchanged — spacing already on Plant
├── plant-provider/           # Unchanged — no new provider fields
├── gardens/                  # Unchanged — membership consumed
├── auth/                     # Existing session
└── plant-favorites/          # Unchanged — not layout objects

# Notable web paths
apps/web/src/app/gardens/garden-layout.page.ts
apps/web/src/app/gardens/garden-layout-cache.service.ts
apps/web/src/app/gardens/layout-api.service.ts
apps/web/src/app/app.routes.ts          # gardens/:id/layout
apps/api/src/gardens/garden-layout.controller.ts
apps/api/src/gardens/garden-membership.guard.ts   # reuse; params.id = garden id

docs/adr/
├── 0004-garden-membership.md
├── 0006-seasonal-plantings.md
└── 0007-garden-layout.md              # local coords; PUT; save gate

docker-compose.yml
scripts/ci/test.sh
scripts/ci/e2e.sh
```

**Structure Decision**: Layout domain logic lives in `libs/garden-layout` with
a clear public API (`LayoutService`, `evaluateLayout`, `rotateBed90`,
`pairRequiredSpacing`, `domainError`). `LayoutService` takes bed/planting/plant
and membership lookups as constructor dependencies — the same pattern as
`libs/seasonal-plantings` — and MUST NOT import Nest, Perenual HTTP, or Drizzle
schema/SQL. Persistence stays in `libs/plant-catalog-data`. `apps/api` is a thin
REST host. Angular imports only the pure helpers and types, not repositories
(path aliases such as `@open-garden/garden-layout/evaluate` so the barrel that
exports `LayoutService` is never pulled into the PWA). The read cache lives in
`apps/web` (IndexedDB), not in the domain lib.

## Complexity Tracking

> No constitution violations. Reusing `plant-catalog-data` avoids an extra Nx
> project. Atomic PUT is required by the clarify save gate (not a speculative
> document store). Integer inches and SVG-or-div plan avoid a map library.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
