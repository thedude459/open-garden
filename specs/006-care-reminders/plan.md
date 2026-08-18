# Implementation Plan: Care Reminders

**Branch**: `006-care-reminders` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-care-reminders/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver a per-garden **care reminder list** derived from the same seasonal
plantings as 004: harvest from planted date + catalog days to maturity; water
and fertilize only when the catalog supplies a numeric interval (qualitative
`waterNeeds` is never mapped to days). Domain logic lives in
`libs/care-reminders`. Persistence is `garden_care_events` plus optional
interval columns on `plants` in `libs/plant-catalog-data`. REST DTOs live in
`libs/shared-types`. The Angular PWA adds a reminders page, IndexedDB **read**
cache, and a **complete/dismiss queue** (`og-reminders-queue`) independent of
plantings and layout. Completing harvest does not write `harvestedOn`. Viewers
read; non-members get 404. Layout canvas and purchasing are out of scope.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS REST API; Angular standalone PWA;
Drizzle ORM; Vitest; Playwright; `libs/shared-types`; existing session auth
(`libs/auth`); existing garden membership (`libs/gardens`,
`GardenMembershipGuard`). API is started with `tsx` in local/CI e2e — Nest
providers that need constructor injection MUST use explicit `@Inject(...)`.
Reuse 004 planting identity and dates; do not call plant providers to invent
cadences. Catalog intervals are stored fields filled by fixture sync (and left
null by Perenual until a later catalog change).

**Storage**: PostgreSQL 16+ via Drizzle migrations (`0006_care_reminders.sql`:
nullable `water_interval_days` / `fertilize_interval_days` on `plants`;
`garden_care_events` with UNIQUE `(planting_id, kind, occurrence_on)`). Client
IndexedDB `og-reminders` (last successful GET) and `og-reminders-queue`. Sync
CLI applies every `*.sql` in `libs/plant-catalog-data/migrations`. Dates are
SQL `date` / JSON `YYYY-MM-DD`.

**Testing**: Vitest unit tests (≥80% coverage CI gate) for
`libs/care-reminders` (harvest omit/include, qualitative water omit, one open
repeating item, no stack of missed intervals, first-due on planted date,
complete/dismiss harvest one-shot, sort order, asOf date math, service authZ).
`apps/api-e2e` holds Zod contract smokes that run in `npm test` without a live
DB. Integration and E2E are Playwright against Compose Postgres
(`npm run e2e` / `scripts/ci/e2e.sh`): UI specs (`reminders-*.spec.ts`) plus
HTTP tests in `apps/web-e2e/src/care-reminders-api.spec.ts` (401, non-member
404, viewer 403, harvest far-future still listed, two plantings two streams,
complete does not set harvestedOn, last-write-wins, offline abort queue).
Local/CI: `npm test` then `npm run e2e`.

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo);
household multi-user deployment. Web talks to the API via same-origin `/api`
proxied to Nest (`apps/web/proxy.conf.json`) so session cookies stay first-party.

**Project Type**: Nx monorepo — `apps/api` + `apps/web` + feature/domain libs

**Performance Goals**: Technical first-load target (distinct from SC-001
one-minute usability study): reminders GET + first paint <2s on the local
network after the garden is open. This is a **manual quickstart check**, not a
CI coverage or Playwright timing gate. Derivation is in-memory over tens to
low hundreds of plantings.

**Constraints**: REST API only; library-first `libs/care-reminders`; no direct
plant-provider HTTP; garden membership authZ reused; plantings ≠ calendar ≠
favorites ≠ layout; reminder queue MUST NOT mutate plantings, beds, layout, or
calendar; no push notifications, weather irrigation, or qualitative→days map.

**Scale/Scope**: Household multi-user; tens of gardens per user; tens to low
hundreds of planting rows per garden. One open water item and one open
fertilize item per planting plus at most one harvest item per planting.

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

All gates remain satisfied after Phase 1. Reminder access reuses garden
membership (ADR 0004) — no new `users.role`. Schema stays in
`plant-catalog-data` (no extra data package). Derivation, date math, and sort
are pure functions in `libs/care-reminders`. `CareReminderService` injects
catalog-data repositories and MUST NOT import Nest, Perenual HTTP, or Drizzle
schema/SQL. Angular imports only the pure helpers plus DTOs — not
repositories. Catalog intervals are stored plant columns (fixture-populated);
qualitative `waterNeeds` is unused for cadence. Offline is GET cache plus a
dedicated complete/dismiss queue. Non-member GET/POST is 404. Viewer POST is
403. Nest controllers use explicit `@Inject(...)`. Completing harvest MUST NOT
PATCH the planting. ADR 0008 records derived list, care events, `asOf`, and
queue isolation.

## Project Structure

### Documentation (this feature)

```text
specs/006-care-reminders/
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
├── api/                      # NestJS REST host; reminders under gardens/:id
├── api-e2e/                  # Zod contract smokes (no live DB; npm test)
├── web/                      # Angular standalone PWA
└── web-e2e/                  # Playwright: UI + HTTP (reminders-*.spec.ts)

libs/
├── shared-types/             # Reminder DTOs + Zod
├── care-reminders/           # Domain: deriveReminders, sortReminders, date math
├── seasonal-plantings/       # Unchanged — plantings remain the source rows
├── plant-catalog-data/       # Drizzle: interval columns + garden_care_events
├── plant-catalog/            # Unchanged except DTO fields for intervals
├── plant-provider/           # Fixture Interval Herb; Perenual leaves intervals null
├── planting-calendar/        # Unchanged — plans are not reminders
├── garden-layout/            # Unchanged — reminders are not on the canvas
├── gardens/                  # Unchanged — membership consumed
├── auth/                     # Existing session
└── plant-favorites/          # Unchanged — not reminder objects

# Notable web paths
apps/web/src/app/gardens/garden-reminders.page.ts
apps/web/src/app/gardens/garden-reminders-cache.service.ts
apps/web/src/app/gardens/reminders-offline.queue.ts
apps/web/src/app/gardens/reminders-api.service.ts
apps/web/src/app/app.routes.ts          # gardens/:id/reminders
apps/api/src/gardens/garden-reminders.controller.ts
apps/api/src/gardens/garden-membership.guard.ts   # reuse; params.id = garden id

docs/adr/
├── 0004-garden-membership.md
├── 0006-seasonal-plantings.md
├── 0007-garden-layout.md
└── 0008-care-reminders.md             # derived list; events; asOf; queue

docker-compose.yml
scripts/ci/test.sh
scripts/ci/e2e.sh
```

**Structure Decision**: Reminder domain logic lives in `libs/care-reminders`
with a clear public API (`CareReminderService`, `deriveReminders`,
`sortReminders`, `addIsoDateDays`, `domainError`). `CareReminderService` takes
planting/plant/event and membership lookups as constructor dependencies — the
same pattern as `libs/seasonal-plantings` — and MUST NOT import Nest, Perenual
HTTP, or Drizzle schema/SQL. Persistence stays in `libs/plant-catalog-data`.
`apps/api` is a thin REST host. Angular imports only the pure helpers and types,
not repositories (path aliases such as `@open-garden/care-reminders/derive` so
the barrel that exports `CareReminderService` is never pulled into the PWA).
Read cache and mutation queue live in `apps/web` (IndexedDB), not in the domain
lib.

## Complexity Tracking

> No constitution violations. Reusing `plant-catalog-data` avoids an extra Nx
> project. A care-events table is required so complete/dismiss is garden-shared
> without overloading planting dates. Nullable interval columns avoid inventing
> cadences from qualitative labels.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
