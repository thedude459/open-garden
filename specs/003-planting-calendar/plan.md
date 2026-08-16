# Implementation Plan: Planting Calendar

**Branch**: `003-planting-calendar` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-planting-calendar/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver a per-garden planting calendar: members add catalog plants to a garden,
see indoor-start / outdoor-sow / transplant / harvest as frost-relative date
ranges, and get current-week emphasis for start windows overlapping today
through today+6 (viewer local date). Domain logic lives in
`libs/planting-calendar`. Persistence extends Drizzle in
`libs/plant-catalog-data` (`garden_calendar_entries` plus optional growing-
guidance columns on `plants`). REST DTOs live in `libs/shared-types`. The
Angular PWA adds a garden calendar page with an IndexedDB read cache; add/remove
are online-only. No layout, in-ground plantings, or care reminders.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS REST API; Angular standalone PWA;
Drizzle ORM; Vitest; Playwright; `libs/shared-types`; existing session auth
(`libs/auth`); existing garden membership (`libs/gardens`,
`GardenMembershipGuard`). API is started with `tsx` in local/CI e2e — Nest
providers that need constructor injection MUST use explicit `@Inject(...)`.

**Storage**: PostgreSQL 16+ via Drizzle migrations (`0003_planting_calendar.sql`:
`garden_calendar_entries`; frost-relative columns on `plants`). Client IndexedDB
for last-loaded calendar reads only — no mutation queue. Sync CLI applies every
`*.sql` in `libs/plant-catalog-data/migrations`.

**Testing**: Vitest unit tests (≥80% coverage CI gate) for
`libs/planting-calendar` (window math, frost anchors, this-week overlap,
idempotent add). `apps/api-e2e` holds Zod contract smokes that run in `npm test`
without a live DB. Integration and E2E are Playwright against Compose Postgres
(`npm run e2e` / `scripts/ci/e2e.sh`): UI specs (`calendar-*.spec.ts`) plus HTTP
request tests in `apps/web-e2e/src/garden-calendar-api.spec.ts` (401, non-member
404, viewer 403, frost-shift, this-week emphasis). Local/CI: `npm test` then
`npm run e2e`.

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo);
household multi-user deployment. Web talks to the API via same-origin `/api`
proxied to Nest (`apps/web/proxy.conf.json`) so session cookies stay first-party.

**Project Type**: Nx monorepo — `apps/api` + `apps/web` + feature/domain libs

**Performance Goals**: Technical first-load gate (distinct from SC-001 two-minute
usability study): calendar GET + first paint <2s on local network under
household load. Current-week emphasis is computed on the client from cached
windows (no extra round trip). Last-write-wins add/remove return the stored
calendar in the same response.

**Constraints**: REST API only; library-first `libs/planting-calendar`; plant
providers only via `PlantDataProvider` (extend the port, never call Perenual
from the calendar feature); garden membership authZ reused (not a new global
role); offline read cache only; no layout/plantings/reminders.

**Scale/Scope**: Household multi-user; tens of gardens per user; tens to low
hundreds of calendar plants per garden; default calendar page size 100 (max
200); type filter is client-side on the loaded set.

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

All gates remain satisfied after Phase 1. Calendar access reuses garden
membership (ADR 0004) — no new `users.role`. Schema stays in
`plant-catalog-data` (no extra data package). Window math and this-week overlap
are pure functions in `libs/planting-calendar`. Growing guidance is optional
catalog columns filled only when `PlantDataProvider` supplies them (ADR 0003
port extended; ADR 0005 records window math). Offline is read-cache only.
Non-member GET is 404. Viewer POST/DELETE is 403. Nest calendar controller uses
explicit `@Inject(...)`. Client computes this-week emphasis from local today so
server timezone cannot leak into SC-008.

## Project Structure

### Documentation (this feature)

```text
specs/003-planting-calendar/
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
├── api/                      # NestJS REST host; calendar controller under gardens/:id
├── api-e2e/                  # Zod contract smokes (no live DB; npm test)
├── web/                      # Angular standalone PWA
└── web-e2e/                  # Playwright: UI + HTTP (calendar-*.spec.ts)

libs/
├── shared-types/             # Calendar DTOs + Zod; PlantDetailDto growing guidance
├── planting-calendar/        # Domain: window math, this-week overlap, add/remove
├── plant-catalog-data/       # Drizzle: garden_calendar_entries + plants guidance cols
├── plant-catalog/            # Sync/upsert persists new optional guidance fields
├── plant-provider/           # ProviderPlant growing guidance (optional); fixture fills some
├── gardens/                  # Unchanged — membership + site profile consumed
├── auth/                     # Existing session
└── plant-favorites/          # Unchanged — picker via existing favorites API

# Notable web paths
apps/web/src/app/gardens/garden-calendar.page.ts
apps/web/src/app/gardens/garden-calendar-cache.service.ts
apps/web/src/app/gardens/calendar-api.service.ts
apps/web/src/app/app.routes.ts          # gardens/:id/calendar
apps/api/src/gardens/garden-calendar.controller.ts
apps/api/src/gardens/garden-membership.guard.ts   # reuse; params.id = garden id

docs/adr/
├── 0003-plant-provider-port.md         # amend: optional growing-guidance fields
├── 0004-garden-membership.md
└── 0005-planting-calendar-windows.md   # annual month-day math, frost anchors, this week

docker-compose.yml
scripts/ci/test.sh
scripts/ci/e2e.sh
```

**Structure Decision**: Calendar domain logic lives in `libs/planting-calendar`
with a clear public API (`CalendarService`, `computeWindows`, `overlapsThisWeek`,
`domainError`). `CalendarService` takes `CalendarEntryRepository` /
`PlantRepository` (and garden lookup) as constructor dependencies — the same
pattern as `libs/gardens` — and MUST NOT import Nest, Perenual HTTP, or Drizzle
schema/SQL. Persistence stays in `libs/plant-catalog-data`. `apps/api` is a thin
REST host. Angular imports only the pure helpers (`overlapsThisWeek`, types),
not repositories. Provider port gains optional fields only.

## Complexity Tracking

> No constitution violations. Extending `PlantDataProvider` is required by FR-005
> (not a new vendor client). Reusing `plant-catalog-data` avoids an extra Nx
> project. Client-side this-week overlap is required so emphasis follows the
> viewer’s local date (FR-013).

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
