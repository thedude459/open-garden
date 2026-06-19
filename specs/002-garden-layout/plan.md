# Implementation Plan: Garden Layout & Planting

**Branch**: `004-garden-layout` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature 002 spec (clarified 2026-06-19 — rotation phasing, USDA soil,
validate-placement preview, companion hints deferred). Builds on Feature 001
(Next.js + PostgreSQL plant database).

## Summary

Implement garden layout and planting as an extension of the existing Next.js
monolith. Users create axis-aligned gardens with beds and paths (US2–US5); **90°
geometric rotation** and **crop rotation warnings** ship together in US6. Optional
bed **USDA soil texture** (12 classes) and **sun exposure** display as abbreviated
canvas labels when set — metadata only in v1. Plant placement validates spacing
and incompatible adjacency garden-wide via `lib/catalog/query.ts`. **Bed planting
history** is written on every direct seed (US3) and transplant (US5); US6 evaluates
rotation warnings against accumulated history. **validate-placement** dry-run
returns hard-block `violations[]` plus advisory `warnings[]` (climate from US5,
rotation from US6). Indoor starts are separate until transplant. Optimistic
concurrency (409) on all mutations. Offline cache extends Feature 001.

Companion planting **hints** deferred to a future feature (incompatibility hard
blocks only in v1).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS (unchanged from 001)

**Primary Dependencies**: Next.js 15 (App Router), React 19, PostgreSQL 16,
Drizzle ORM, Auth.js v5, Zod validation (existing stack)

**Storage**: PostgreSQL (gardens, garden_areas, plant_placements, indoor_starts,
bed_planting_history); IndexedDB offline extension; curated rotation metadata in 001

**Testing**: Vitest (unit — geometry/OBB, validation, rotation, enums),
Playwright (E2E), MSW (API mocks)

**Target Platform**: Web (desktop + mobile browsers)

**Project Type**: Full-stack web application (monolithic Next.js — extends 001)

**Performance Goals**: validate-placement preview p95 < 2s (SC-002); target p95
< 200ms for ≤ 100 placements (T057 bench); crop rotation warning path p95 < 2s
(SC-008, same T057 bench); garden detail load p95 < 500ms; layout canvas 60fps
for 50×50 ft gardens

**Constraints**: Auth required; spacing/incompatibility hard blocks; climate and
rotation warnings advisory; soil/sun metadata-only; US2–US5 axis-aligned areas
only (`rotation_degrees = 0`; API rejects non-zero until US6); history from US3;
companion hints out of scope; silent last-write-wins prohibited (FR-020)

**Scale/Scope**: 1–5 gardens, 2–20 beds, 10–200 placements, multi-year history per bed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Horticultural Knowledge Engine (I)**: Spacing, relationships, rotation
      metadata from `lib/catalog/query.ts`; soil/sun user-entered metadata in v1
- [x] **Layout & Placement Validation (II)**: Central `lib/garden/validation.ts`;
      garden-wide hard blocks; AABB US2–US5, OBB US6; crop rotation advisory;
      companion hints deferred (incompatibility blocks only)
- [N/A] **Weather-Aware Task Scheduling (III)**: Out of scope; climate warnings
      advisory at placement only
- [x] **Organic & Safety-First (IV)**: No harmful recommendations; validation
      prevents biologically harmful layouts
- [x] **Persistence & Extensibility (V)**: Gardens, planting history from US3,
      version tracking; extensible for soil testing and companion hints
- [x] **Domain Requirements**: Beds/paths, USDA soil, sun, rotation (US6); spacing;
      climate/rotation advisory warnings; orchard deferred
- [x] **Spec-Driven Quality Gates**: FR/SC mapped to contracts, validation module,
      quickstart flows

**Post-design re-check**: All gates pass. Companion hints and soil-plant matching
explicitly deferred per clarified spec.

## Project Structure

### Documentation (this feature)

```text
specs/002-garden-layout/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── garden-api.md
│   └── offline-garden-cache.md
└── tasks.md
```

### Source Code (repository root — additions to 001)

```text
lib/garden/
├── types.ts, enums.ts          # SOIL_*, SUN_* groups and canvas abbreviations
├── geometry.ts                 # AABB (US2–US5) + OBB (US6)
├── validation.ts
├── rotation.ts                 # US6 warnings; history read
├── spacing.ts, climate-warnings.ts
├── service.ts                  # history write US3/US5; rotation warn US6
├── schemas.ts, version.ts

components/garden/
├── AreaLayer.tsx               # soil + sun canvas labels
├── AreaEditor.tsx              # grouped soil, sun selector; rotate US6
├── ValidationFeedback.tsx      # violations + warnings from dry-run
├── RotationFeedback.tsx        # US6 crop rotation advisories
```

**Structure Decision**: Extends monolithic Next.js App Router. Pure validation
shared between validate-placement API and client preview (FR-017a).

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Rotation deferred to US6 | Clarified delivery phasing | US2 rotation split from crop rotation breaks independent story tests |
| History US3, warnings US6 | History must accumulate before rotation checks | Deferring history to US6 loses data for incremental US3–US5 releases |
| validate-placement warnings | SC-002 live preview UX | Save-only warnings require extra round-trips |
| Companion hints deferred | Clarified spec (2026-06-19) | Advisory companion UI deferred; v1 enforces incompatibility hard blocks and spacing only |
| USDA 12-class soil enum | Clarified spec | 4-value list insufficient |
| Catalog rotation extension | FR-024 Principle I | Hard-coded rotation map rejected |

## Phase 0 & 1 Artifacts

- [research.md](./research.md) — phasing, OBB, history, validate-placement, soil/sun UX
- [data-model.md](./data-model.md) — enums, history lifecycle, geometry rules
- [contracts/](./contracts/) — garden API including validate-placement (FR-017a)
- [quickstart.md](./quickstart.md) — phased manual validation flows
