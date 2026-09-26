# Implementation Plan: Garden View Clarity

**Branch**: `014-garden-view-clarity` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-garden-view-clarity/spec.md`

## Summary

Make the garden **map** the thing you open, and make **Bed View** readable. Garden list (and `/gardens/:id`) land on Garden Overview. Name, notes, zone, frost, members, invite, leave, and delete move to **`/gardens/:id/configure`**. In Bed View, planting marks show a **truncated common name on the circle**; selecting a mark shows the full name in one status line off the plan; clicking empty plan clears it. Bed name/size stay on the Overview drawing; Bed View may keep the bed name in you-are-here / heading only. Overview planting inventory is **name×count on the bed** — `[showPlantingMarks]="false"` so the map does not draw in-bed circles or beside-mark names.

No new API, tables, or DTOs. Label truncation lives in `libs/garden-layout`. Routing and chrome live in `apps/web`. Existing Playwright that assumes settings-on-open must follow the new destinations.

## Technical Context

**Language/Version**: TypeScript (strict mode mandatory; `any` disallowed)

**Primary Dependencies**: Nx apps `web` (Angular standalone) and existing `@open-garden/garden-layout`; Playwright. No new npm packages.

**Storage**: PostgreSQL unchanged. **No migration.** IndexedDB layout cache unchanged.

**Testing**: Vitest for mark-name truncation. Playwright: list → Overview (no settings form, empty garden included); Configuration still saves facts / invite / delete (owner, collaborator, viewer); Bed View on-mark labels + select / empty-plan clear; Overview has no in-bed marks. Host `npm run e2e` stays the merge gate. No new API e2e.

**Target Platform**: Self-hosted PWA (existing Compose). No new infra.

**Project Type**: Nx monorepo — no new app or lib.

**Performance Goals**: Same Overview budget as 008 (map of ~10 beds / 50 plantings stays usable). Truncation is O(name length) per mark.

**Constraints**: REST unchanged; library-first for label math; no new membership rules; offline read of layout unchanged; planner mutations still online-required.

**Scale/Scope**: Presentation and navigation of the existing household garden planner (Overview / Bed View / lists). Not a new visualization engine.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Library-First**: Truncate-to-fit is a pure function in `libs/garden-layout` (next to `layoutPlantingLabels`). Pages stay thin.
- [x] **Provider Abstraction**: No provider calls.
- [x] **Simplicity (YAGNI)**: No new Nx lib, no map library, no nickname field, no ADR for a route move. Reuse `garden-detail.page.ts` as the configure screen.
- [x] **Multi-User**: Same owner/collaborator/viewer rules; sharing controls only relocate.
- [x] **Type Safety & Shared Contracts**: No new API types.
- [x] **REST Boundary**: Existing garden REST only.
- [x] **Angular Standalone**: Optional small `GardenNav` standalone component; no NgModules.
- [x] **PostgreSQL Migrations**: None.
- [x] **Testing Gates**: Vitest on truncation; Playwright for landing, configure, Bed View labels (constitution E2E).
- [x] **Security**: Same membership guards; delete still confirms; no secrets.
- [x] **Self-Hosted**: No infra change.
- [x] **ADR**: None — route and label presentation are not a new architecture.

**Post-design re-check**: Still pass. Redirect `/gardens/:id` → layout is the smallest landing fix. Configuration is the existing detail page at a new path.

## Project Structure

### Documentation (this feature)

```text
specs/014-garden-view-clarity/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── garden-ui.md
└── tasks.md                 # /speckit-tasks — not this command
```

### Source Code (repository root)

```text
apps/web/src/app/
├── app.routes.ts                          # /gardens/:id → layout; /configure
└── gardens/
    ├── garden-list.page.ts                # links to layout
    ├── garden-layout.page.ts              # garden nav; showPlantingMarks false
    ├── garden-detail.page.ts              # becomes configure screen
    ├── garden-bed-view.page.ts            # status line; no size chrome
    ├── garden-plan-canvas.ts              # on-mark text when marks shown; showBedCaption
    ├── garden-nav.ts                      # shared destinations (new, tiny)
    ├── garden-plantings.page.ts           # nav → Overview in one click
    ├── garden-calendar.page.ts
    ├── garden-reminders.page.ts
    └── garden-transplants.page.ts
apps/web/src/app/ui/place-marker.ts        # garden home → layout
libs/garden-layout/src/lib/planting-labels.ts   # shortenPlantingMarkName
apps/web-e2e/src/                          # landing, site, share, place-marker, helpers
```

**Structure Decision**: Do not add `libs/garden-nav`. Navigation is Angular-only. Label truncation is domain-ish geometry (fit text in a mark radius) so it belongs in `garden-layout` with Vitest.

## Complexity Tracking

> No constitution violations.
