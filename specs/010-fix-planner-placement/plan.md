# Implementation Plan: Fix Planner Placement

**Branch**: `010-fix-planner-placement` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-fix-planner-placement/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Fix Garden Overview so beds and non-planting areas land where the gardener points (first-place: rectangle **center** under the pointer; move: **grab-offset**, no center-snap), using one zoom/pan mapping that matches what Save stores. Make **Bed View** the place to plant: a full catalog **plant panel** (same search as the Plants page; climate filter defaults to this garden’s hardiness zone), drag or arm-then-click onto the **open bed** to create a **direct_seed** at the drop center. Invalid catalog-from-panel drops are **rejected** (specific notice, no planting). Overview becomes a **structure map**: create/arrange beds and areas, **show** planting marks, **no** plant panel, marks not draggable. Catalog admission: unknown spacing is omitted from list/sync/search (existing plantings stay). Keep 008 Save/draft/roles/tray and 009 notices. ADR 0012. No new tables.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx; NestJS REST (catalog list/sync behavior only); Angular standalone (`garden-plan-canvas`, Overview, Bed View); `@open-garden/garden-layout` (coords, origin helpers, catalog-drop outcome); `@open-garden/plant-catalog` (omit no-spacing; existing miss-fill); `@open-garden/web-ui` / `NoticeService` (009); Vitest; Playwright

**Storage**: PostgreSQL unchanged (`plants.spacing_inches` stays nullable for leftover rows). No new migrations. Layout PUT and planting create paths unchanged. Draft remains in-memory (`PlannerDraftService`).

**Testing**: Vitest for origin-from-center, grab-offset, `catalogDropOutcome`, catalog list/sync omit-null-spacing, miss-fill skip-no-spacing, leftover null-spacing planting still evaluated. Playwright: zoomed/panned **Create** at viewport center + grab-offset move + Save/reload origin; Bed View search+drag (and arm-click) stored planting; Overview has no catalog search; invalid drop (miss/spacing/fit/offline) creates 0 plantings; no-spacing variety absent from panel.

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo)

**Project Type**: Nx monorepo — backend API app + Angular frontend app + libs

**Performance Goals**: Pointer mapping must match the visible SVG (no “jump to garden center”). Catalog search in Bed View uses the same `GET /api/plants` as the Plants page (pageSize ≤ 20). Overview 10×50 fixture timing from 008 unchanged.

**Constraints**: REST only; no new endpoints; library-first math in `libs/garden-layout` and catalog filter in `libs/plant-catalog` / `plant-catalog-data`; plant providers only via existing abstraction; membership/Save/draft unchanged; YAGNI — no bed-template palette, no image CDN, no guessed spacing, no GraphQL

**Scale/Scope**: Household gardens. One open bed’s plant panel. Catalog omit-null-spacing applies to **all** catalog pickers (Plants page + planner), not a planner-only query flag.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Library-First**: Pointer→plan origin helpers and catalog-drop reject live in `libs/garden-layout`. Spacing admission lives in `libs/plant-catalog` + `plant-catalog-data` list/sync. Angular pages stay thin.
- [x] **Provider Abstraction**: Miss-fill and sync still go through `PlantDataProvider`. No direct provider HTTP from Angular.
- [x] **Simplicity (YAGNI)**: No new REST resources, no image pipeline, no extra query `requireSpacing` (always omit). No new Nx lib. Canvas keeps SVG `getScreenCTM`; lib helpers take **plan inches**.
- [x] **Multi-User**: Same owner/collaborator mutate, viewer read. Non-member not-found unchanged.
- [x] **Type Safety & Shared Contracts**: Additive `PlantSummaryDto.spacingInches: number` (listed plants always have spacing). Zod in `libs/shared-types`. Layout DTOs unchanged.
- [x] **REST Boundary**: Nest REST; Angular HTTP-only. Catalog `GET` query params unchanged (`q`, `zone`, `plantType`).
- [x] **Angular Standalone**: Plant panel is markup on existing `GardenBedViewPage` (or a small standalone child). No NgModules.
- [x] **PostgreSQL Migrations**: None. Nullable `spacing_inches` remains for leftover rows; omit at read/sync.
- [x] **Testing Gates**: Vitest ≥80%; Playwright for FR-008 stored origin and stored planting-in-bed.
- [x] **Security**: No new authZ; notices MUST NOT leak other gardens’ names; no secrets.
- [x] **Self-Hosted**: Existing Compose.
- [x] **ADR**: [0012](../../docs/adr/0012-planner-placement.md) (written at implement): SVG CTM as sole screen mapping; Overview marks-not-editable; catalog-drop reject vs 008 flag-and-keep.

**Post-design re-check**: Still pass. Data-model entities are existing layout/catalog rows plus client draft/arm state. REST contract is behavior change on list/sync, not new paths. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/010-fix-planner-placement/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ui.md
│   ├── rest-api.md
│   └── shared-types.ts.md
└── tasks.md                 # /speckit-tasks — not this command
```

### Source Code (repository root)

```text
libs/garden-layout/src/lib/
├── plan-coords.ts           # keep planToLocal; do not export pan/scale mapper
├── origin.ts                # originFromCenter, originFromGrabOffset (new)
├── catalog-drop.ts          # catalogDropOutcome before draft add (new)
├── evaluate-layout.ts       # reuse for spacing/fit
├── hit-test.ts              # Overview: skip planting hits
└── viewport-center.ts       # unused by apps; do not export (SVG CTM on canvas)

libs/plant-catalog/src/lib/
├── catalog-service.ts       # list already miss-fills; skip upsert without spacing
└── catalog-sync-service.ts  # skip provider items with null spacing

libs/plant-catalog-data/src/lib/
└── plant-repository.ts      # list WHERE spacing_inches IS NOT NULL

libs/shared-types/src/lib/
├── plant.ts                 # PlantSummaryDto.spacingInches: number; favorites may be null
└── plant.schemas.ts         # query unchanged; list mapping in toSummary

apps/web/src/app/gardens/
├── garden-plan-canvas.ts    # CTM mapping; show marks without planting drag on Overview
├── garden-layout.page.ts    # first-place viewport center; grab-offset move; no plant panel
└── garden-bed-view.page.ts  # plant panel; remove Add {name}; drag + arm-then-click

apps/web-e2e/src/
├── planner-place.spec.ts             # US1: viewport-center create + grab-offset
├── planner-catalog-drop.spec.ts      # US2: Bed View search + place + Save
└── planner-catalog-reject.spec.ts    # US3: miss / spacing / fit / offline
```

**Structure Decision**: Domain math stays in `@open-garden/garden-layout`. Catalog admission stays in `@open-garden/plant-catalog` / data. UI wiring stays in existing planner pages. No new app or lib project.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None.
