# Implementation Plan: Plant Database

**Branch**: `001-plant-database` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-plant-database/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver an authenticated plant catalog for Open Garden: paged browse/search,
zone/type filters, plant detail (garden-variety identity), hybrid
external-provider sync into PostgreSQL, and private per-user favorites with
offline queue-and-sync. Implementation is library-first in an Nx monorepo
(domain libs + provider port + shared REST contracts), with a TypeScript REST
API and Angular standalone PWA client. Lookups always read the local catalog;
external providers are used only for operator sync and secondary on-demand
miss-fill. The web client caches catalog pages/details for offline read.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS REST API; Angular standalone PWA
(service worker); Drizzle ORM; Vitest; Playwright; shared-types lib

**Storage**: PostgreSQL 16+ via Drizzle migrations; client IndexedDB (or
equivalent) for offline favorites queue and cached catalog list/detail pages

**Testing**: Vitest (unit, ≥80% coverage CI gate); API integration tests;
Playwright E2E once UI + backend are functional

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo);
household multi-user deployment

**Project Type**: Nx monorepo — `apps/api` + `apps/web` + feature/domain libs

**Performance Goals**: Catalog list/detail interactions feel responsive
(<2s for first page on local network under household load); offline favorite
mutations apply on-device in <500ms; favorites sync completes within one
reconnect cycle under normal conditions. Verified manually via quickstart.

**Constraints**: REST API only; library-first modules; plant providers only via
internal port/adapter; multi-user authZ from v1; offline-capable PWA; no
planting schedule / layout / care reminders in this feature

**Scale/Scope**: Household multi-user (tens of users); catalog on the order of
thousands of garden varieties (not millions); default page size 20

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

All gates remain satisfied after Phase 1 and post-analyze remediation. Provider
port, shared-types DTOs, auth-gated REST, favorites ownership, PWA/offline
catalog cache, login UI, migration-backed schema, and ADRs are explicit in
plan/tasks. Operator-only baseline sync (cron deferred) matches YAGNI.

## Project Structure

### Documentation (this feature)

```text
specs/001-plant-database/
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
├── api/                      # NestJS REST host (auth middleware, wiring)
├── api-e2e/                  # API integration tests
├── web/                      # Angular standalone PWA (+ service worker)
└── web-e2e/                  # Playwright E2E for Angular PWA

libs/
├── shared-types/             # REST DTOs / enums shared by api + web
├── plant-catalog/            # Catalog domain: query, detail, variety identity
├── plant-provider/           # PlantDataProvider port + adapters (fixture, HTTP)
├── plant-favorites/          # Favorites domain: ownership, idempotent add/remove
├── plant-catalog-data/       # Drizzle schema/repos for plants + sync metadata
└── auth/                     # Minimal auth primitives used by API guards

# Notable web paths
apps/web/src/app/auth/login.page.ts
apps/web/src/app/plants/plant-catalog-cache.service.ts
apps/web/src/app/favorites/favorites-offline.queue.ts

docs/adr/
├── 0001-orm-drizzle.md
├── 0002-auth-sessions.md
└── 0003-plant-provider-port.md

docker-compose.yml
```

**Structure Decision**: Domain logic lives in `libs/plant-catalog`,
`libs/plant-favorites`, and `libs/plant-provider` with clear public APIs.
Persistence adapters sit in `libs/plant-catalog-data`. `apps/api` exposes REST
only; `apps/web` is a PWA that caches catalog reads and queues favorite writes
offline. No GraphQL/tRPC.

## Complexity Tracking

> No constitution violations requiring justification. Provider port is required
> by constitution (not speculative). Separate favorites lib keeps catalog
> read-path free of user-owned write concerns (YAGNI-compliant cohesion).

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
