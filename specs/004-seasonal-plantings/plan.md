# Implementation Plan: Seasonal Plantings

**Branch**: `004-seasonal-plantings` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-seasonal-plantings/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver a per-garden list of what is actually planted this season: catalog
variety, optional planted/harvest dates (past, today, or future), and optional
named bed. Domain logic lives in `libs/seasonal-plantings`. Persistence extends
Drizzle in `libs/plant-catalog-data` (`garden_beds`, `garden_plantings`). REST
DTOs live in `libs/shared-types`. The Angular PWA adds a garden plantings page
grouped by named bed (empty beds still appear; Unassigned only when needed),
with IndexedDB read cache **and** a mutation queue that syncs on reconnect.
Queued update/remove MUST NOT recreate a planting another member already
deleted. Remove is a confirmed permanent hard delete. Plantings are not calendar
plans and are not favorites. No geometry, quantity field, or care reminders.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS REST API; Angular standalone PWA;
Drizzle ORM; Vitest; Playwright; `libs/shared-types`; existing session auth
(`libs/auth`); existing garden membership (`libs/gardens`,
`GardenMembershipGuard`). API is started with `tsx` in local/CI e2e — Nest
providers that need constructor injection MUST use explicit `@Inject(...)`.
Reuse paged catalog (`GET /api/plants`) and private favorites
(`GET /api/favorites`) as pickers.

**Storage**: PostgreSQL 16+ via Drizzle migrations (`0004_seasonal_plantings.sql`:
`garden_beds`, `garden_plantings`). Client IndexedDB `og-plantings` for
last-loaded list **and** pending mutations. Sync CLI applies every `*.sql` in
`libs/plant-catalog-data/migrations`. Planted/harvest values are SQL `date`
(no time-of-day).

**Testing**: Vitest unit tests (≥80% coverage CI gate) for
`libs/seasonal-plantings` (date-pair rules, bed-name normalize, list grouping,
add/update/remove/authZ with in-memory repos). `apps/api-e2e` holds Zod contract
smokes that run in `npm test` without a live DB. Integration and E2E are
Playwright against Compose Postgres (`npm run e2e` / `scripts/ci/e2e.sh`): UI
specs (`plantings-*.spec.ts`) plus HTTP tests in
`apps/web-e2e/src/garden-plantings-api.spec.ts` (401, non-member 404, viewer 403,
harvest-before-planted, confirm/cancel delete, empty-bed groups, offline queue,
no-resurrect). Local/CI: `npm test` then `npm run e2e`.

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo);
household multi-user deployment. Web talks to the API via same-origin `/api`
proxied to Nest (`apps/web/proxy.conf.json`) so session cookies stay first-party.

**Project Type**: Nx monorepo — `apps/api` + `apps/web` + feature/domain libs

**Performance Goals**: Technical first-load target (distinct from SC-001 one-minute
usability study): plantings GET + first paint <2s on local network after the
garden is open. This is a **manual quickstart check** (T050), not a CI coverage
or Playwright timing gate. Grouping and bed filter are client-side on the
**full loaded set** (no extra round trip for filter). Last-write-wins PATCH
returns the stored planting (or full list) in the same response.

**Constraints**: REST API only; library-first `libs/seasonal-plantings`; no
direct plant-provider calls; garden membership authZ reused; plantings ≠
calendar entries ≠ favorites; offline queue-and-sync for planting/bed
mutations; membership and calendar add/remove stay online-only; no layout
geometry, quantity, or reminders.

**Scale/Scope**: Household multi-user; tens of gardens per user; tens of named
beds per garden; tens to low hundreds of planting rows per garden; default GET
`pageSize` 200 (max 500). The plantings page MUST request `pageSize=200` and,
when `total` exceeds the first page, fetch remaining pages before
`groupPlantings` so FR-015 grouping is not truncated. US1 may show a flat list;
FR-015 grouped default is complete only after US2.

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

All gates remain satisfied after Phase 1. Planting access reuses garden
membership (ADR 0004) — no new `users.role`. Schema stays in
`plant-catalog-data` (no extra data package). Date-pair validation, bed-name
rules, and grouped-list assembly are pure functions in
`libs/seasonal-plantings`. `PlantingService` injects catalog-data repositories
and MUST NOT import Nest, Perenual HTTP, or Drizzle schema/SQL. Angular imports
only the pure helpers (`assertDatePair`, `groupPlantings`, `normalizeBedName`)
plus DTOs — not repositories. Catalog identity comes from existing plant rows
(no provider calls). Offline queue is client-only (same idea as favorites);
the API stays ordinary REST with client-supplied planting/bed ids for
idempotent creates. Non-member GET is 404. Viewer mutate is 403. Nest
controllers use explicit `@Inject(...)`. Confirmed delete is a hard DELETE
with no status/archive column. ADR 0006 records plantings vs calendar and the
no-resurrect queue rule.

## Project Structure

### Documentation (this feature)

```text
specs/004-seasonal-plantings/
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
├── api/                      # NestJS REST host; plantings + beds under gardens/:id
├── api-e2e/                  # Zod contract smokes (no live DB; npm test)
├── web/                      # Angular standalone PWA
└── web-e2e/                  # Playwright: UI + HTTP (plantings-*.spec.ts)

libs/
├── shared-types/             # Planting/bed DTOs + Zod
├── seasonal-plantings/       # Domain: date pair, grouping, bed names, CRUD
├── plant-catalog-data/       # Drizzle: garden_beds + garden_plantings
├── planting-calendar/        # Unchanged — no auto-convert either way
├── plant-catalog/            # Unchanged — picker via existing plants API
├── plant-provider/           # Unchanged — no new provider fields
├── gardens/                  # Unchanged — membership consumed
├── auth/                     # Existing session
└── plant-favorites/          # Unchanged — picker via existing favorites API

# Notable web paths
apps/web/src/app/gardens/garden-plantings.page.ts
apps/web/src/app/gardens/garden-plantings-cache.service.ts
apps/web/src/app/gardens/plantings-offline.queue.ts
apps/web/src/app/gardens/plantings-api.service.ts
apps/web/src/app/app.routes.ts          # gardens/:id/plantings
apps/api/src/gardens/garden-plantings.controller.ts
apps/api/src/gardens/garden-beds.controller.ts
apps/api/src/gardens/garden-membership.guard.ts   # reuse; params.id = garden id

docs/adr/
├── 0003-plant-provider-port.md
├── 0004-garden-membership.md
└── 0006-seasonal-plantings.md           # list vs calendar; queue; hard delete

docker-compose.yml
scripts/ci/test.sh
scripts/ci/e2e.sh
```

**Structure Decision**: Planting domain logic lives in `libs/seasonal-plantings`
with a clear public API (`PlantingService`, `assertDatePair`, `groupPlantings`,
`normalizeBedName`, `domainError`). `PlantingService` takes
`PlantingRepository` / `BedRepository` / plant and membership lookups as
constructor dependencies — the same pattern as `libs/gardens` and
`libs/planting-calendar` — and MUST NOT import Nest, Perenual HTTP, or Drizzle
schema/SQL. Persistence stays in `libs/plant-catalog-data`. `apps/api` is a thin
REST host. Angular imports only the pure helpers and types, not repositories.
The offline queue lives in `apps/web` (IndexedDB), not in the domain lib.

## Complexity Tracking

> No constitution violations. Reusing `plant-catalog-data` avoids an extra Nx
> project. Client-side grouping/filter is required so empty-bed groups,
> Unassigned omission, and offline filter work on a cached payload (FR-015).
> A mutation queue is required by US3 (not speculative sync infrastructure).

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
