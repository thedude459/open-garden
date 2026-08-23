# Implementation Plan: Catalog Data Pipeline

**Branch**: `007-data-pipeline` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-data-pipeline/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace hybrid catalog sync (capped operator `POST /api/admin/plants/sync` +
on-demand miss-fill) with a **catalog data pipeline**: full load of every
configured `PlantDataProvider`, in-memory normalize/merge by garden-variety
key, one-transaction publish into PostgreSQL. Gardeners only read persisted
plants. Operators start runs, inspect results, and set a daily schedule in
`/admin/pipeline` (`users.role = admin`). Concurrent starts are 409.
Production v1 is fixture-only by default; an operator MAY enable Perenual
when `PERENUAL_API_KEY` is set. Merge is proven with a **controlled**
`fixture` + `fixture-b` overlap pair (SC-002) plus the full ≥50 fixture
catalog (SC-009). Domain logic lives in `libs/catalog-pipeline`.
DTOs live in `libs/shared-types`. Persistence stays in
`libs/plant-catalog-data` (migration `0007_catalog_pipeline.sql`).

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS REST API; Angular standalone
PWA; Drizzle ORM; Vitest; Playwright; `libs/shared-types`; existing session
auth (`libs/auth`); existing `users.role` admin (001). Reuse
`PlantDataProvider` (ADR 0003). API is started with `tsx` in local/CI e2e —
Nest providers that need constructor injection MUST use explicit
`@Inject(...)`. Do not add `@nestjs/schedule`, Redis, or a job-queue product.
Pipeline MUST NOT import Perenual URLs or Drizzle schema from Angular.

**Storage**: PostgreSQL 16+ via Drizzle migrations (`0007_catalog_pipeline.sql`:
`catalog_pipeline_runs`, `catalog_pipeline_run_sources`,
`catalog_pipeline_merge_decisions`, `catalog_plant_sources`,
`catalog_pipeline_settings`; partial unique one-running-run). Client catalog
IndexedDB cache unchanged (001). Sync CLI applies every `*.sql` in
`libs/plant-catalog-data/migrations`.

**Testing**: Vitest unit tests (≥80% coverage CI gate) for
`libs/catalog-pipeline` (full-load vs prefix, merge last-wins + fill blanks,
duplicate variety keys, skip invalid records, deprecate only when contributing
sources succeeded, reactivate in place, 409 lock, scheduled tick no-ops when
running, CatalogService does not miss-fill). `apps/api-e2e` Zod contract
smokes in `npm test` without a live DB. Integration and E2E are Playwright
against Compose Postgres (`npm run e2e` / `scripts/ci/e2e.sh`): admin start +
poll, gardener 403, empty search does not create rows, two-fixture merge
counts, already-running 409. Local/CI: `npm test` then `npm run e2e`.

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo);
household multi-user deployment. Web talks to the API via same-origin `/api`
proxied to Nest (`apps/web/proxy.conf.json`) so session cookies stay
first-party. Scheduled runs require the API process to be up.

**Project Type**: Nx monorepo — `apps/api` + `apps/web` + feature/domain libs

**Performance Goals**: Fixture full load (≥50 plants) + operator GET status
within 2 minutes (SC-006). Gardener catalog first page <2s on the local
network after catalog is open — **manual quickstart check**, not a CI timing
gate. Merge is in-memory over thousands of varieties, not millions.

**Constraints**: REST API only; library-first `libs/catalog-pipeline`; plant
providers only via port; no miss-fill; no gardener sync UI; live source
optional; no second live vendor required; no weather/imagery ingest;
user-owned offline queues unchanged; no GraphQL/tRPC.

**Scale/Scope**: Household multi-user; catalog thousands of garden varieties;
one singleton settings row; one running pipeline at a time; fixture ≥50
plants (SC-009). SC-002 uses a **controlled two-source pair** (10 overlap +
10 unique each → 30 keys), not the full catalog row count after enabling
`fixture-b` on top of the ≥50 fixture set.

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

All gates remain satisfied after Phase 1. Ingest is `libs/catalog-pipeline`
(`CatalogPipelineService`, pure `mergeCatalogRecords`). The service injects
plant/run repositories and a `PlantDataProvider[]` registry — MUST NOT import
Nest, Perenual HTTP, or Drizzle schema/SQL. Angular imports only DTOs.
AuthZ is `users.role === 'admin'` (no garden membership). Catalog lookups
stay shared reference data (001). Provider access remains ADR 0003.
Adapters map vendor units/labels into `ProviderPlant` before merge.
Schedule is an in-process interval (no extra Compose service). Raw vendor
payloads are not stored. Seeded `sourceOrder` is `['fixture']`; operators
MAY append a live source last. ADR 0009 records pipeline vs hybrid sync.

## Project Structure

### Documentation (this feature)

```text
specs/007-data-pipeline/
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
├── api/                      # NestJS REST host; admin pipeline controllers
├── api-e2e/                  # Zod contract smokes (no live DB; npm test)
├── web/                      # Angular standalone PWA
└── web-e2e/                  # Playwright: admin pipeline + gardener 403

libs/
├── shared-types/             # Pipeline DTOs + Zod
├── catalog-pipeline/         # Domain: merge, run, lock, deprecation
├── plant-catalog/            # List/detail only — miss-fill removed
├── plant-catalog-data/       # Drizzle: 0007 + pipeline repos
├── plant-provider/           # Port + fixture, fixture-b, perenual
├── plant-favorites/          # Unchanged
├── auth/                     # Existing session + admin role
├── gardens/                  # Unchanged — pipeline is not garden-scoped
└── care-reminders/           # Unchanged — still reads plants

# Notable paths
apps/api/src/admin/pipeline-runs.controller.ts
apps/api/src/admin/pipeline-settings.controller.ts
apps/api/src/admin/pipeline-scheduler.service.ts
apps/api/src/admin/pipeline-sources.ts
apps/api/src/admin/admin.guard.ts
apps/api/src/admin/admin.module.ts
apps/api/src/plants/plants.controller.ts          # drop provider from list
apps/api/src/plants/plants-sync.controller.ts     # delete
apps/api/src/plants/sync-cli.ts                   # pipeline.runAndWait()
apps/web/src/app/admin/pipeline.page.ts
apps/web/src/app/admin/pipeline-api.service.ts
apps/web/src/app/admin/admin.guard.ts
apps/web/src/app/app.routes.ts                    # /admin/pipeline
libs/plant-catalog/src/lib/catalog-service.ts     # no searchByName
libs/plant-catalog/src/lib/catalog-sync-service.ts  # remove or thin-wrap

docs/adr/
└── 0009-catalog-data-pipeline.md

docker-compose.yml            # unchanged services
scripts/ci/test.sh
scripts/ci/e2e.sh
```

**Structure Decision**: Pipeline domain logic lives in `libs/catalog-pipeline`
with a clear public API (`CatalogPipelineService`, `mergeCatalogRecords`,
`tryStartScheduled`). `CatalogPipelineService` takes repositories and an
ordered `PlantDataProvider[]` as constructor dependencies — same pattern as
`PlantingService` — and MUST NOT import Nest, Perenual HTTP, or Drizzle
schema/SQL. Persistence stays in `libs/plant-catalog-data`. `apps/api` is a
thin REST host plus a 60s `onModuleInit` interval that calls
`tryStartScheduled`. Angular admin page imports DTOs only. Path aliases such
as `@open-garden/catalog-pipeline` must not pull Nest. Do not create
`libs/catalog-pipeline-data`.

## Complexity Tracking

> No constitution violations. A dedicated ingest lib keeps gardener reads free
> of provider I/O (required by FR-003, not speculative generality). A second
> fixture adapter proves multi-source merge without a second live vendor.
> In-memory merge + one transaction is simpler than staging tables at
> household scale. In-process 202 + interval avoids a job queue.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
