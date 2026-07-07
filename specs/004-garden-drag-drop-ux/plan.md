# Implementation Plan: Intuitive Garden Planting Experience

**Branch**: `006-garden-drag-drop-ux` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature 004 spec (clarified 2026-07-07 — defer canvas bed/path editing, auto-save
placements, drag + click-to-place, full app design refresh, mobile click-to-place). Builds
on Feature 002 (garden layout, validation) and Feature 003 (visual planner canvas, sprites,
illustrations).

## Summary

Close the usability gap between the visual planner infrastructure (003) and what users
experience today: coordinate fields still visible, low-contrast buttons, incomplete
click-to-place, no save confirmations, and mobile view-only planting.

**Technical approach**: Extend `PlannerShell` / `VisualCanvas` with a **placement mode**
state machine (`idle` → `armed` → `placing`), wire `onGardenClick` for click-to-place
(desktop + mobile), add optimistic auto-save with toast confirmations and offline revert,
humanize validation copy, remove coordinate readouts from `PropertyPanel`, add empty-bed
canvas hints, and roll out a **semantic design system** in `globals.css` applied across
all app routes. No database schema changes; reuse existing placement APIs.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS (unchanged from 001–003)

**Primary Dependencies**: Next.js 15 (App Router), React 19, PostgreSQL 16, Drizzle ORM,
Auth.js v5, Zod (existing); no new UI libraries — CSS custom properties + lightweight
`ToastProvider` context

**Storage**: PostgreSQL unchanged; placement positions still persisted as `position_x` /
`position_y` derived from pointer events (not user-typed)

**Testing**: Vitest (unit — placement mode reducer, message mapper, contrast token audit);
Playwright (E2E — drag-drop auto-save, click-to-place desktop/mobile, offline revert,
contrast smoke on core routes); optional `axe-core` in Playwright for WCAG AA automation

**Target Platform**: Web — tablet/desktop drag-and-drop + click-to-place; phone
click-to-place + light edits (FR-018)

**Project Type**: Full-stack monolith (frontend-heavy UX pass on existing APIs)

**Performance Goals**: Placement auto-save round-trip < 500ms p95 on LAN; canvas click
feedback < 100ms; toast render non-blocking; design token migration zero runtime cost

**Verification**: T040 bench/E2E in polish phase; not a release blocker for MVP (US1–US3).
Manual timing acceptable in T038 quickstart if automated bench deferred.

**Constraints**: Preserve `lib/garden/validation.ts` hard blocks (constitution II); no
canvas bed/path draw in v1; WCAG 2.1 AA app-wide; original palette (not third-party copy)

**Scale/Scope**: ~11 app routes; 1 planner interaction overhaul; 1 design system pass;
0 new DB tables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Horticultural Knowledge Engine (I)**: Spacing/incompatibility unchanged; validation
      still calls catalog knowledge via existing `validate-placement` API
- [x] **Layout & Placement Validation (II)**: All placement paths (drag, click, transplant)
      MUST call `validate-placement` before POST; hard limits non-overridable
- [N/A] **Weather-Aware Task Scheduling (III)**: Out of scope
- [x] **Organic & Safety-First (IV)**: No new recommendation surfaces
- [x] **Persistence & Extensibility (V)**: Auto-save uses existing versioned placement APIs;
      design system tokens extensible for future modules
- [x] **Domain Requirements**: Placement validation preserved; bed/path forms unchanged (deferred)
- [x] **Spec-Driven Quality Gates**: FR/SC mapped to contracts, quickstart, data-model

**Post-design re-check**: All gates pass. UX layer does not bypass validation or knowledge
engine. `lib/garden/messages.ts` maps violation codes to human-readable copy per FR-016.

## Project Structure

### Documentation (this feature)

```text
specs/004-garden-drag-drop-ux/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1 — client state + message mapping
├── quickstart.md        # Phase 1 — manual + automated acceptance
├── contracts/
│   ├── design-system.md
│   └── planting-interaction.md
└── tasks.md             # Phase 2 — /speckit-tasks
```

### Source Code (repository root — additions / changes)

```text
app/globals.css                    # Semantic design tokens, contrast fixes, focus rings
app/layout.tsx                     # ToastProvider wrapper
app/(auth)/**                      # Apply design system
app/(catalog)/**                   # Apply design system
app/(garden)/**                    # Apply design system

lib/planner/
├── placement-mode.ts              # idle | armed | dragging state machine
└── types.ts                       # + PlacementMode, Toast types

lib/garden/
├── messages.ts                    # violation/warning code → human copy (FR-016)
└── validation.ts                  # unchanged semantics; export codes only

components/ui/
├── Toast.tsx                      # Non-intrusive confirmation stack
└── ToastProvider.tsx              # Context + aria-live region

components/planner/
├── PlannerShell.tsx               # Auto-save toasts, click-to-place, offline revert
├── VisualCanvas.tsx               # onGardenClick, empty-bed hints, drop highlight
├── PlantLibrary.tsx               # Select/arm plant (click + drag), mobile sheet
├── PropertyPanel.tsx              # Remove coordinates; show bed name, spacing label
├── MobilePlannerView.tsx          # Plant library + click-to-place on phone

components/garden/
├── ValidationFeedback.tsx         # Hide raw codes; gardening language only (T028)
├── IndoorStartsPanel.tsx          # Transplant via canvas click/drop (no coord form)
└── AreaEditor.tsx                 # unchanged in v1 (bed/path forms retained)

tests/unit/
├── placement-mode.test.ts
├── garden-messages.test.ts
└── design-tokens-contrast.test.ts

tests/e2e/
├── planting-interaction.spec.ts
├── mobile-click-place.spec.ts
└── accessibility-contrast.spec.ts
```

**Structure Decision**: Extend existing monolith in-place. All new interaction logic
lives in `lib/planner/placement-mode.ts` and `PlannerShell`; design system centralized
in `globals.css` with route-level class adoption only where needed.

## Complexity Tracking

> No constitution violations requiring justification.

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|-------------------------------------|
| Placement mode state machine | Drag + click-to-place + mobile share validation/save paths | Ad-hoc booleans (`pendingPlantId` alone) already incomplete and error-prone |
| Toast provider | FR-015 requires non-intrusive save confirmations | `alert()` blocks interaction; inline text easy to miss |
| `lib/garden/messages.ts` | FR-016 hides `SPACING`, `INCOMPATIBLE` codes from users | Changing server messages breaks API consumers; map at UI boundary |
| Full-app token pass | Clarified full refresh; patchwork garden-only fix leaves contrast failures elsewhere | User explicitly chose option C in clarify session |
| Offline revert snapshot | Spec edge case: false success on failed save | Optimistic-only UI loses trust when network fails |

## Implementation Phasing (for /speckit-tasks)

| Phase | Scope | Delivers |
|-------|-------|----------|
| 1 | Setup | Design tokens in `globals.css`, `ToastProvider`, `placement-mode.ts` scaffold |
| 2 | Foundational | messages.ts, ValidationFeedback humanization, placement-mode tests |
| 3 | US1 P1 | Click-to-place wired, auto-save toasts, remove coordinate UI, transplant canvas flow |
| 4 | US2 P2 | Full-app design system rollout, planner page/chrome, region labels, contrast audit |
| 5 | US3 P3 | Empty-bed hints, drop-target highlight, motion-safe feedback |
| 6 | Mobile (FR-018) | `MobilePlannerView` plant library + click-to-place |
| 7 | Polish | E2E, axe contrast tests, perf bench (T040), quickstart sign-off |

**MVP note**: Phase 3 (US1) alone delivers core user ask — drag/click planting without
coordinates. Humanized validation ships in Phase 2 (T028). Phase 4 (design system) can
parallelize after T008 token scaffold lands.

**Dependency note**: Requires 003 `PlannerShell` / `VisualCanvas` baseline. No migration.
