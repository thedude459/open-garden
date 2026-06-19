# Implementation Plan: Plant Database

**Branch**: `003-plant-database` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)

**Input**: NextJS + React + PostgreSQL. Email/password auth. Server-side scheduled
sync from external plant providers (Trefle, Perenual) into Postgres; filter
non-organic fertilizer recommendations at ingestion per constitution Principle IV.
Companion/incompatible relationships and rootstock spacing data are curated/authored
separately, not synced from any provider — model as owned reference data, not a
pipeline target. Clients cache a scoped subset (user's garden plants + recently
viewed, not the full catalog) into IndexedDB via service worker for offline use.
Per-user provisional plants, with field-merge linking when a provisional entry
later matches a synced canonical plant.

## Summary

Build the foundational horticultural knowledge engine as a Next.js full-stack
application with PostgreSQL. The server ingests and normalizes plant records from
Trefle and Perenual on a scheduled pipeline, applies organic-only fertilizer
filtering at ingestion, and stores canonical plant data separately from
curated reference data (companion/incompatible relationships, rootstock spacing).
Signed-in users search and browse via server-side API (online); a service worker
caches a scoped offline subset (garden-associated plants + recently viewed) in
IndexedDB. Per-user provisional plants persist on the server with field-merge
linking when a canonical match appears.

**Spec reconciliation**: FR-011a/011c originally described full-catalog client
download. This plan intentionally replaces that with **scoped subset offline
cache** per user direction. Online catalog search/browse always hits the server
API against the full Postgres catalog; offline mode serves only cached plants
(SC-003 applies to the scoped subset, not the full 500+ record catalog).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS

**Primary Dependencies**: Next.js 15 (App Router), React 19, PostgreSQL 16,
Drizzle ORM, NextAuth.js v5 (Auth.js) with credentials provider, Zod validation,
Trefle API, Perenual API

**Storage**: PostgreSQL (canonical plants, reference data, users, provisionals,
sync state); IndexedDB (client scoped offline cache via service worker)

**Testing**: Vitest (unit), Playwright (E2E), MSW (API mocks)

**Target Platform**: Web (desktop + mobile browsers); Dockerized Postgres for local dev

**Project Type**: Full-stack web application (monolithic Next.js)

**Performance Goals**: Server-side plant search p95 < 500ms for 500+ records
(SC-007); offline detail load from IndexedDB < 100ms; initial scoped cache
bundle download < 5s on broadband

**Constraints**: Auth required for all catalog routes; external provider calls
server-side only; non-organic fertilizer filtered at ingestion; companions/rootstock
not sourced from providers; offline limited to scoped subset

**Scale/Scope**: 500–5,000 canonical plants; curated reference tables for top
200 edible garden species at launch; single-tenant user accounts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Horticultural Knowledge Engine (I)**: Centralized Postgres catalog +
      curated reference tables; all UI/API reads from data layer, not hard-coded
- [x] **Layout & Placement Validation (II)**: Companion/incompatible and
      rootstock spacing stored as queryable reference data (FR-015 API); layout
      validation deferred to future feature but data model ready
- [N/A] **Weather-Aware Task Scheduling (III)**: Out of scope for this feature;
      planting windows stored for future scheduler consumption
- [x] **Organic & Safety-First (IV)**: Ingestion pipeline filters non-organic
      fertilizer; only organic-aligned guidance persisted (FR-017)
- [x] **Persistence & Extensibility (V)**: Server-persisted users, provisionals,
      locations; extensible schema for garden placements and future modules
- [x] **Domain Requirements**: All plant DB fields modeled; climate filtering via
      user location; categories supported
- [x] **Spec-Driven Quality Gates**: Acceptance criteria mapped to API contracts
      and E2E tests in quickstart.md

**Post-design re-check**: All gates pass. Scoped offline cache documented as
intentional deviation from full-catalog client sync (see Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/001-plant-database/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── plant-api.md
│   ├── auth-api.md
│   └── offline-cache.md
└── tasks.md             # Phase 2 — /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (catalog)/
│   ├── plants/
│   │   ├── page.tsx              # search + browse
│   │   └── [id]/page.tsx         # detail
│   └── layout.tsx
├── api/
│   ├── auth/[...nextauth]/route.ts
│   ├── plants/
│   │   ├── search/route.ts
│   │   └── [id]/
│   │       ├── route.ts
│   │       ├── relationships/route.ts
│   │       └── rootstocks/route.ts
│   ├── users/me/
│   │   ├── location/route.ts
│   │   ├── provisionals/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── link/route.ts
│   │   └── cache/
│   │       ├── manifest/route.ts
│   │       └── bundle/route.ts
│   └── internal/
│       └── sync/route.ts         # cron-triggered ingest
├── layout.tsx
└── page.tsx

lib/
├── db/
│   ├── schema/                   # Drizzle schema modules
│   ├── migrations/
│   └── client.ts
├── auth/
│   ├── config.ts
│   └── session.ts
├── catalog/
│   ├── search.ts
│   ├── climate-filter.ts
│   └── merge-provisional.ts
├── ingestion/
│   ├── trefle-client.ts
│   ├── perenual-client.ts
│   ├── normalize.ts
│   ├── fertilizer-filter.ts
│   └── sync-job.ts
├── reference/
│   └── seed-companions.ts        # curated data loader
└── offline/
    └── cache-types.ts

components/
├── catalog/
│   ├── PlantSearch.tsx
│   ├── PlantCard.tsx
│   ├── PlantDetail.tsx
│   ├── ClimateFilter.tsx
│   └── ProvisionalPlantForm.tsx
└── auth/
    ├── LoginForm.tsx
    └── RegisterForm.tsx

public/
└── sw.js                         # service worker — IndexedDB cache

scripts/
├── sync-plants.ts                # manual/CI ingest trigger
└── seed-reference-data.ts        # companions + rootstock

tests/
├── unit/
├── integration/
└── e2e/

docker-compose.yml                # Postgres local dev
drizzle.config.ts
next.config.ts
package.json
```

**Structure Decision**: Monolithic Next.js App Router application. API routes
replace a separate FastAPI backend. Scheduled sync runs via `scripts/sync-plants.ts`
invoked by cron (GitHub Actions, systemd, or Vercel Cron hitting
`/api/internal/sync`). Drizzle ORM chosen for type-safe schema aligned with
TypeScript stack (see research.md).

## Complexity Tracking

| Violation / Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------------------|------------|--------------------------------------|
| Scoped offline cache vs full-catalog client sync (FR-011a) | User-directed architecture: IndexedDB subset for garden + recently viewed plants avoids multi-MB full catalog on device | Full catalog IndexedDB cache rejected — 500+ full records with relationships exceeds mobile storage budget and conflicts with server-side search model |

**Spec reconciliation (2026-06-12)**: spec.md updated to match scoped offline cache model; FR-002, FR-011a/011c, SC-003, and US1 aligned with this plan.
| Dual external providers (Trefle + Perenual) | Neither API alone covers all FR-004 fields; Trefle strong on taxonomy, Perenual on care guides | Single provider rejected — incomplete field coverage for edible garden plants |
| Curated reference data separate from sync pipeline | Providers lack reliable companion/incompatible and rootstock spacing data (user direction) | Provider-sourced relationships rejected — inaccurate/incomplete for layout validator requirements |
| Stub plants (FR-006a) for missing relationship targets | Spec requires queryable relationship IDs even when target plant not yet in catalog | Text-only references rejected — breaks FR-015 programmatic query interface |

## Phase 0 & 1 Artifacts

- [research.md](./research.md) — technology decisions and provider mapping
- [data-model.md](./data-model.md) — entity definitions and relationships
- [contracts/](./contracts/) — API and offline cache contracts
- [quickstart.md](./quickstart.md) — local dev and validation steps
