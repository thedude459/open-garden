# Implementation Plan: Load Performance

**Branch**: `011-load-performance` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-load-performance/spec.md`

## Summary

Stop garden list, Garden Overview / Bed View, and plant search from doing **per-item** work on load. Add **bedCount** and **placementCount** to the garden list via **batched aggregates** (those counts are not on the list today). Keep layout GET as **one plants join** for spacing and **derive canopy** in memory (`plantingFootprintRadius`). Put **illustrationUrl** on catalog search results (null + existing `.plant-stand-in` until art exists). Batch miss-fill upserts. Overlap Overview/Bed View layout + garden-detail HTTP. **Fail CI** on N+1 and on **&lt;1s assembly** / **≤2s interactive** budgets, with timings on those three paths.

Technical approach: data access in `@open-garden/plant-catalog-data`; domain mapping in `@open-garden/gardens`, `@open-garden/garden-layout`, `@open-garden/plant-catalog`; DTOs in `@open-garden/shared-types`; thin Nest logs + Angular standalone wiring. ADR [0013](../../docs/adr/0013-load-performance.md). No new Nx project. No migration.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS API; Angular standalone components; Drizzle ORM; Vitest; Playwright; `@open-garden/gardens`, `@open-garden/garden-layout`, `@open-garden/plant-catalog`, `@open-garden/plant-catalog-data`, `@open-garden/shared-types`

**Storage**: PostgreSQL (schema changes via migrations only). **No new migration.** Reuse `garden_beds.garden_id` and `garden_plantings(garden_id, created_at)` indexes. IndexedDB layout cache unchanged.

**Testing**: Vitest (unit, ≥80% coverage CI gate) for N+1 / query-count. `apps/api-e2e` is **required** for the 1s assembly budgets (20-garden list and 100-placement layout) against Postgres. Playwright (`apps/web-e2e`) for data-request counts and 2s interactive budgets.

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo)

**Project Type**: Nx monorepo — backend API app + Angular frontend app + libs

**Performance Goals**: Garden-list payload assembly for **20 gardens &lt; 1s** and not ~20× a 1-garden list. Layout payload assembly (`LayoutService.get`) for **100 placements &lt; 1s**. Garden GET (name/zone/counts) runs **in parallel** with layout GET and is not a second 1s budget. Interactive garden list, Overview, Bed View, and plant search **≤ 2s** on those fixtures (pictures may still load; that window includes both round-trips). Query/request count **constant** in garden / placement / result count.

**Constraints**: REST API only; library-first modules; plant providers only via internal abstraction; multi-user roles/sharing from v1; offline-capable PWA; online-only planner mutations; last-write-wins; no GraphQL/tRPC; no new image pipeline

**Scale/Scope**: Household gardens (verify at 20 gardens and 100 placements). Not farm/GIS scale. Out of scope unless on these load paths: calendar, reminders, transplant list, favorites UI, admin pipeline, layout **PUT** row loops.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Library-First**: Counts, layout join, miss-fill upsert, footprint derive live in existing libs; Angular pages stay thin
- [x] **Provider Abstraction**: Miss-fill still uses `PlantDataProvider`; no Perenual/image HTTP from this feature
- [x] **Simplicity (YAGNI)**: No denormalized counters, no canopy column, no CDN, no new Nx lib, no migration
- [x] **Multi-User**: Aggregates scoped to membership page ids; viewers get counts and layout GET; cannot mutate
- [x] **Type Safety & Shared Contracts**: Additive `GardenSummaryDto` / `PlantSummaryDto` fields in `libs/shared-types`
- [x] **REST Boundary**: Existing GET gardens / layout / plants only
- [x] **Angular Standalone**: Garden list, Overview, Bed View, Plants page remain standalone
- [x] **PostgreSQL Migrations**: No schema change; existing indexes used
- [x] **Testing Gates**: Vitest query-count; api-e2e 1s assembly on DB fixtures; Playwright request-count + 2s interactive; coverage ≥80%
- [x] **Security**: No new secrets; batch `IN` lists only caller’s gardens; catalog still signed-in
- [x] **Self-Hosted**: No new infra
- [x] **ADR**: [0013-load-performance.md](../../docs/adr/0013-load-performance.md)

## Project Structure

### Documentation (this feature)

```text
specs/011-load-performance/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── rest-api.md
│   ├── shared-types.ts.md
│   └── ui.md
└── tasks.md             # Phase 2 (/speckit-tasks) — not created here
```

### Source Code (repository root)

```text
libs/plant-catalog-data/src/lib/
├── garden-repository.ts      # listForUser + countsForGardenIds (GROUP BY)
├── planting-repository.ts    # listAllForLayout join (audit; keep one query)
└── plant-repository.ts       # upsertManyByVarietyKey next to upsertByVarietyKey

libs/gardens/src/lib/
└── garden-service.ts         # map bedCount / placementCount on list and get

libs/garden-layout/src/lib/
├── layout-service.ts         # snapshot already Promise.all; tests lock no per-id plant fetch
└── footprint.ts              # plantingFootprintRadius (canopy)

libs/plant-catalog/src/lib/
└── catalog-service.ts        # toSummary.illustrationUrl; miss-fill upsertMany

libs/shared-types/src/lib/
├── garden.ts                 # bedCount, placementCount on GardenSummaryDto
└── plant.ts                  # illustrationUrl on PlantSummaryDto

apps/api/src/
├── gardens/gardens.controller.ts
├── gardens/garden-layout.controller.ts
└── plants/plants.controller.ts   # assembly_ms logs on the three GETs

apps/web/src/app/
├── gardens/garden-list.page.ts
├── gardens/garden-layout.page.ts    # Promise.all(planner.load, gardensApi.detail)
├── gardens/garden-bed-view.page.ts
└── plants/plant-list.page.ts        # img or .plant-stand-in

apps/web-e2e/src/             # 20-garden list, 100-placement planner, search data GETs, 2s
apps/api-e2e/src/             # required DB-backed 1s assembly budgets (20 gardens / 100 placements)
```

**Structure Decision**: No new app or lib. Batching and DTO mapping stay in existing domain/data libraries; apps only log, display counts, parallelize two GETs, and render illustration-or-stand-in.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None.

## Constitution Check (post-design)

Gates still pass. Design adds two DTO fields and repository batch helpers rather than a fourth project or a speculative cache. Provider port unchanged. Membership isolation specified on aggregates. Tests cover both linear-growth failure and time budgets.
