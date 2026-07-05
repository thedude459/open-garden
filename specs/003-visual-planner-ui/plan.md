# Implementation Plan: Visual Garden Planner Experience

**Branch**: `005-visual-planner-ui` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature 003 spec (clarified 2026-07-05 — container/patio third type,
curated illustrations only, full orchard validation, auto-upgrade on open, phone
view+light-edits). Builds on Feature 001 (plant catalog) and Feature 002 (garden
layout, validation, indoor starts).

## Summary

Transform the functional SVG layout editor into a GrowVeg-inspired **visual planner**:
illustrated plants and structures, drag-and-drop placement, zoom/pan, template
gallery, plan thumbnails, and three **growing-area types** (vegetable garden,
orchard, container / patio garden). Existing gardens **auto-upgrade on open** with
category default illustrations; no legacy editor fork.

Backend extends the 002 garden model (`zone_type`, structure placements, illustration
refs, canvas layer order, thumbnails). Frontend replaces wireframe SVG rendering with
sprite-based canvas layers while **reusing** `lib/garden/validation.ts` for all hard
blocks. Orchard plans enable tree canopy footprints and **hard-block** rootstock/spacing
rules per constitution Principle II.

Illustrations ship as curated static assets (`public/planner/`) indexed by reference
tables—not user uploads, not photorealistic photos.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20 LTS (unchanged from 001/002)

**Primary Dependencies**: Next.js 15 (App Router), React 19, PostgreSQL 16,
Drizzle ORM, Auth.js v5, Zod (existing); **no new canvas framework** — extend SVG
with `<image>` sprites, pointer-driven drag, and viewBox zoom/pan

**Storage**: PostgreSQL (extend `gardens`, new structure + illustration tables);
static illustration assets in `public/planner/`; optional generated thumbnails in
`public/planner/thumbnails/{gardenId}.webp` or inline base64 in DB column for v1

**Testing**: Vitest (unit — illustration resolver, layer sort, zoom math, migration
mapper); Playwright (E2E — drag-drop, templates, mobile read-only, auto-upgrade);
visual regression snapshots for 3 template layouts (optional)

**Target Platform**: Web — tablet/desktop full editing; phone view + light edits only
(FR-017)

**Project Type**: Full-stack monolith (extends 002 in-place)

**Performance Goals**: Canvas drag feedback < 16ms frame budget at 50 placements;
drag pointer-up to re-render < 100ms p95 at 50 placements (SC-003a); zoom/pan 60fps
for 50×50 ft plans; thumbnail capture on save < 2s; illustration picker initial load
< 500ms (cached assets)

**Constraints**: Curated illustrations only; original styling (FR-016); preserve
002 validation semantics; auto-upgrade without data loss; phone no drag-and-drop;
orchard hard blocks non-overridable when catalog data exists

**Scale/Scope**: 3 zone types; ~30 structure types at launch; category + top-200 plant
specific illustrations; 6 starter templates; 1–5 gardens per user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Horticultural Knowledge Engine (I)**: Spacing, incompatibles, tree/rootstock
      spacing from `lib/catalog/query.ts`; illustrations are display-only layer
- [x] **Layout & Placement Validation (II)**: Reuses `lib/garden/validation.ts`
      hard blocks; orchard adds `getOrchardAdvisories()` from `lib/catalog/query.ts`
      (companions + guild-category plants) surfaced in PropertyPanel/ValidationFeedback—
      not a guild designer UI; structures metadata-only except season-extender tags
- [N/A] **Weather-Aware Task Scheduling (III)**: Out of scope; structure environment
      tags stored for future scheduler
- [x] **Organic & Safety-First (IV)**: No new recommendation surfaces; validation unchanged
- [x] **Persistence & Extensibility (V)**: Extends gardens with zone_type, structures,
      layers, thumbnails; enables constitution orchard zone requirement deferred in 002
- [x] **Domain Requirements**: Garden / orchard / container zone types; tree spacing;
      illustrated layout; climate integration unchanged from 002
- [x] **Spec-Driven Quality Gates**: FR/SC mapped to contracts, quickstart, data-model

**Post-design re-check**: All gates pass. Resolves 002 deferral of `gardens.zone_type`
and orchard layout per constitution Domain Requirements.

## Project Structure

### Documentation (this feature)

```text
specs/003-visual-planner-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── planner-api.md
│   ├── illustration-assets.md
│   └── planner-ui.md
└── tasks.md             # Phase 2 — /speckit-tasks
```

### Source Code (repository root — additions / changes to 002)

```text
public/planner/
├── plants/                 # SVG/WebP per plant or category default
├── structures/             # beds, greenhouses, pots, paths, trellises
└── templates/              # preview images for starter templates

lib/planner/
├── illustrations.ts        # resolve plant/structure image URL + fallback
├── templates.ts            # load template snapshots
├── thumbnail.ts            # capture/regenerate plan thumbnail
├── layers.ts               # z-order sort, lock state
├── migration.ts            # auto-upgrade 002 garden → visual v1 projection
└── types.ts

lib/garden/
├── validation.ts           # extend: tree canopy spacing (orchard)
├── orchard-advisories.ts   # companion + understory guild suggestions (FR-014a)
├── geometry.ts             # canopy circle footprints for trees
└── ... (existing)

lib/db/schema/
├── gardens.ts              # + zone_type, thumbnail_key, visual_version
├── planner.ts              # illustrations, structures, templates (new)
└── index.ts

components/planner/
├── PlannerShell.tsx        # toolbar, panels, responsive layout
├── VisualCanvas.tsx        # zoom/pan SVG + sprite layers (replaces LayoutCanvas UX)
├── PlantLibrary.tsx        # illustrated picker, drag source
├── StructureLibrary.tsx
├── TemplateGallery.tsx
├── LayerPanel.tsx
├── PropertyPanel.tsx
├── MobilePlannerView.tsx   # phone: view + light edits
└── sprites/
    ├── PlantSprite.tsx
    └── StructureSprite.tsx

components/garden/            # legacy panels adapted or wrapped by planner/
app/(garden)/gardens/[gardenId]/page.tsx  # mounts PlannerShell

app/api/gardens/[gardenId]/
├── structures/             # CRUD structure placements
├── thumbnail/              # POST regenerate thumbnail
└── ... (existing routes)

scripts/
└── seed-planner-assets.ts  # map catalog plants → illustration paths
```

**Structure Decision**: Extend the existing monolith in-place. New code lives under
`lib/planner/` and `components/planner/`; `components/garden/LayoutCanvas.tsx` is
superseded by `VisualCanvas.tsx` but geometry helpers remain shared.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|--------------------------------------|
| Orchard validation in visual feature | Spec + constitution require hard-block tree spacing in v1 orchard plans | Visual-only trees would violate Principle II |
| Separate `garden_structures` table | Structures overlay beds, have layers, differ from plantable areas | Overloading `garden_areas` conflates plantable beds with decorative objects |
| Illustration reference tables | 500+ plants need category fallbacks + specific overrides without DB blobs | Hard-coding paths in components breaks catalog growth |
| Auto-upgrade migration module | FR-013 requires seamless open with illustrations | Opt-in migration adds UX friction spec rejected |
| Orchard advisory suggestions | Constitution II MUST suggest companions/guild members | Hard blocks alone do not satisfy "suggest" requirement |

## Implementation Phasing (for /speckit-tasks)

| Phase | Scope | Delivers |
|-------|-------|----------|
| 1 | Setup (T001–T004) | Asset dirs, design tokens, gitignore |
| 2 | Foundational (T005–T016) | Schema, migration, illustration seed, resolver |
| 3 | US1 P1 (T017–T027, T023a–d) | VisualCanvas, drag-drop, 002 parity, page swap |
| 4 | US2 P2 (T028–T037, T031a–c) | zone_type, orchard validation + advisories |
| 5 | US3 P3 (T036–T044) | Structure library, layers, lock |
| 6 | US4 P4 (T045–T050, T049a) | Template gallery + 6 templates |
| 7 | US5 P5 (T051–T057, T056a–c) | Toolbar chrome, thumbnails, mobile, a11y |
| 8 | Polish (T058–T064) | E2E, rotation, perf bench, docs |

**MVP note**: US1 includes canvas-level pan/zoom (T018); toolbar zoom +/- ships in US5 (T051).

**Task ID note**: Letter-suffixed subtasks (T023a–d, T031a–c, T049a, T056a–c) are listed
in the phase of their parent user story.

**Dependency note**: Feature 002 US6 (rotation) may land before or in parallel; visual
canvas MUST respect `rotation_degrees` when non-zero (render rotated sprites).
