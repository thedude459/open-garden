# Implementation Plan: Garden Planner UX

**Branch**: `008-garden-planner-ux` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-garden-planner-ux/spec.md`

**Note**: This plan was regenerated after the 2026-08-21 two-view / transplant / non-planting-area spec. It supersedes the 2026-08-18 single-canvas plan.

## Summary

Replace the form-heavy layout page with **three views** of one garden: **Garden Overview** (to-scale map of beds and non-planting areas; planting **name/count labels** only; select bed → Bed View), **Bed View** (in-bed plant marks; **direct seed** from catalog or **transplant** from the indoor tray), and **Transplant View** (create/full-delete indoor starts; water/fertilizer indoor tasks). Bed geometry and areas are Overview-only. Plantings in a bed are Bed View-only. New tray records are Transplant View-only; removing a transplant from a bed restores it to the tray with prior information; removing a direct seed deletes it.

Technical approach: keep spacing/fit in `libs/garden-layout`; add non-planting areas and start-method rules there and in `libs/seasonal-plantings` / `libs/care-reminders`. Persist areas (`garden_non_planting_areas`) and planting `start_method` + `indoor_started_on` via migration `0008`. That migration also **deletes leftover unsized beds** (direct-seed plantings on them deleted; transplants unassigned to the tray). Layout GET/PUT gains `areas`. Transplant create/delete is an immediate planting-record write. Overview, Bed View, and Transplant View share one in-memory **layout** draft until explicit Save. Pointer Events + transform pan/zoom remain. ADR 0010.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx monorepo; NestJS API; Angular standalone components; Drizzle ORM; Playwright; `@open-garden/garden-layout`, `@open-garden/seasonal-plantings`, `@open-garden/care-reminders`, `@open-garden/shared-types`

**Storage**: PostgreSQL (schema changes via migrations only). Migration `0008_planner_visualization.sql`. IndexedDB `og-layout` = last successful layout GET only (never an unsaved draft).

**Testing**: Vitest (unit, ≥80% coverage CI gate); integration tests; Playwright E2E once UI + backend are functional

**Target Platform**: Self-hosted offline-capable PWA (Docker Compose in-repo)

**Project Type**: Nx monorepo — backend API app + Angular frontend app + libs

**Performance Goals**: Overview of ≥10 sized beds and 50 placed plantings ready within 3 seconds of navigation (online, signed-in). Dragged item stays under the pointer for the gesture. `evaluateLayout` on gesture end only, not every pointermove.

**Constraints**: REST API only; library-first modules; plant providers only via internal abstraction; multi-user roles/sharing from v1; offline-capable PWA; online-only planner mutations; last-write-wins; no GraphQL/tRPC

**Scale/Scope**: Household gardens (on the order of 10 beds and 50 plantings). Not farm/GIS scale.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Library-First**: Domain in `libs/garden-layout`, `libs/seasonal-plantings`, `libs/care-reminders`; Angular pages are thin clients
- [x] **Provider Abstraction**: Spacing and care intervals from catalog columns only; no provider HTTP from this feature
- [x] **Simplicity (YAGNI)**: No new planner Nx lib; no map library; indoor tasks reuse `garden_care_events` + derive; areas have no rotate
- [x] **Multi-User**: Same garden membership (owner/collaborator mutate, viewer read, non-member 404)
- [x] **Type Safety & Shared Contracts**: DTOs in `libs/shared-types` only
- [x] **REST Boundary**: Nest REST; Angular HTTP client only
- [x] **Angular Standalone**: New Overview / Bed View / Transplant View pages are standalone
- [x] **PostgreSQL Migrations**: `0008_planner_visualization.sql` via Drizzle
- [x] **Testing Gates**: Vitest for domain helpers; Playwright for three-view flows
- [x] **Security**: AuthZ via existing garden membership guards; validate geometry and enums; no secrets
- [x] **Self-Hosted**: Existing Compose; no new infra
- [x] **ADR**: [0010](../../docs/adr/0010-two-view-planner.md)

**Post-design re-check**: Still pass. New tables/columns are required by the spec (areas, start method), not speculative. Indoor derivation is a small extension of `libs/care-reminders`, not a second reminder engine.

## Project Structure

### Documentation (this feature)

```text
specs/008-garden-planner-ux/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rest-api.md
│   ├── shared-types.ts.md
│   └── planner-ui.md
└── tasks.md                 # /speckit-tasks — not this command
```

### Source Code (repository root)

```text
apps/
├── api/src/gardens/         # layout + plantings + new areas + transplants list
└── web/src/app/gardens/     # overview, bed-view, transplant-view, shared draft

libs/
├── shared-types/            # LayoutAreaDto, StartMethod, planting/layout DTO fields
├── plant-catalog-data/      # schema + migration 0008
├── garden-layout/           # evaluate, hit-test (overview vs bed), areas, labels
├── seasonal-plantings/      # start_method rules, bed-delete cascade by start method
├── care-reminders/          # deriveIndoorReminders for unplaced transplants
└── gardens/                 # membership (unchanged)

docs/adr/0010-two-view-planner.md
```

**Structure Decision**: Do **not** add `libs/garden-planner`. Overview/Bed/Transplant UI stays in `apps/web`. Geometry, drop, hit-test, and area rectangles stay in `libs/garden-layout`. Start-method invariants stay in `libs/seasonal-plantings`. Indoor water/fertilize derivation stays in `libs/care-reminders`.

## Complexity Tracking

> No constitution violations.

## Phase 0 / Phase 1

See [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md).
