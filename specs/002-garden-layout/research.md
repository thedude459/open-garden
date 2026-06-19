# Research: Garden Layout & Planting

**Date**: 2026-06-19 | **Plan**: [plan.md](./plan.md)

## 1. Layout Editor UI

### Decision: React + SVG canvas with pointer-driven drag/resize

**Rationale**: The spec requires a proportional top-down view of rectangular
gardens, beds, paths, and plant footprints. SVG integrates natively with React,
scales cleanly for desktop and mobile, and avoids a heavy canvas dependency for
v1. Bed/path creation uses click-drag rectangles; plant placement uses
click-to-place with live validation feedback.

**Alternatives considered**:
- **HTML/CSS grid only**: Cannot represent arbitrary bed positions or circular
  spacing footprints accurately.
- **react-konva / Fabric.js**: Richer interaction model but adds bundle weight
  and complexity unnecessary for axis-aligned rectangles in v1.
- **Third-party garden planner widgets**: Poor fit for custom validation rules
  and constitution-aligned knowledge engine integration.

## 2. Layout Validation Engine

### Decision: Centralized pure-function module `lib/garden/validation.ts` backed by `lib/catalog/query.ts`

**Rationale**: Constitution Principle II requires validation against biological
constraints from the knowledge engine, not per-screen logic. All placement,
transplant, and layout-shrink checks call the same module. HTTP routes and the
layout UI both consume it; the UI mirrors validation client-side for instant
feedback by importing the same pure functions (geometry + rule evaluation).

**Validation rules**:
| Check | Scope | Hard block? |
|-------|-------|-------------|
| Bed/path within garden boundary | Per area | Yes |
| Bed/path overlap | Per garden | Yes |
| Plant inside plantable bed | Per placement | Yes |
| Minimum spacing | Garden-wide | Yes |
| Incompatible adjacency | Garden-wide | Yes (never overridable) |
| Missing spacing data | Per plant | Yes (block placement) |
| Missing incompatibility data | Per plant | No (allow; spacing still applies) |
| Bed soil type unset or set | Per bed | No (metadata only in v1) |
| Climate date outside window | Per placement | No (advisory; US5+ in dry-run) |
| Crop rotation repeat in bed | Per placement | No (advisory; US6+ in dry-run) |
| Layout shrink evicts placements | Per edit | Yes (block until resolved) |

**Spacing distance formula**:
- Convert catalog `spacing_cm.plant` to garden units (cm → feet or meters).
- Minimum center-to-center distance between two placements =
  `max(spacingA, spacingB)` in garden units.
- Placement footprint rendered as a circle with radius =
  `spacing / 2` for visual feedback.

**Alternatives considered**:
- **Client-only validation**: Rejected — server must enforce hard blocks (FR-008/009).
- **Database triggers**: Rejected — business logic belongs in application layer
  with catalog lookups.

## 3. Geometry Model

### Decision: Rectangular beds/paths; axis-aligned US2–US5; 90° rotation US6 only

**Rationale**: Clarified spec (2026-06-19) delivers geometric rotation in US6
with crop rotation. US2–US5 create axis-aligned areas (`rotation_degrees = 0`);
API rejects non-zero rotation until US6. OBB helpers exist in `lib/garden/geometry.ts`
from Phase 2 but are used for overlap/bounds only from US6 onward.

**Overlap detection**: AABB when both areas at 0°; OBB corner/separating-axis test
when either area rotated.

**Boundary check**: All OBB corners must lie within garden rectangle.

**Alternatives considered**:
- **Bed-local coordinates**: Rejected — complicates cross-bed spacing validation.
- **Centimeter normalization in DB**: Rejected — spec stores/display in user's
  chosen unit per garden; convert at validation time only.

## 4. Optimistic Concurrency

### Decision: Integer `version` column on `gardens`; client sends `expected_version` on mutating requests

**Rationale**: Spec FR-020 requires stale-edit detection without silent
last-write-wins. Increment `version` on any garden mutation (garden metadata,
areas, placements, indoor starts). If `expected_version !== current version`,
return `409 Conflict` with current garden snapshot for review UI.

**Alternatives considered**:
- **ETag/If-Match headers**: Equivalent capability; body field simpler for
  Next.js route handlers and offline sync queue.
- **Last-write-wins**: Rejected — violates clarified spec decision.

## 5. Plant Reference on Placements

### Decision: Polymorphic plant reference — `canonical_plant_id` OR `provisional_plant_id` (exactly one)

**Rationale**: FR-007 allows authoritative and provisional catalog plants.
Reuse existing `user_provisional_plants` and `canonical_plants` tables. Validation
resolves spacing via `lib/catalog/query.ts` for canonical plants and provisional
record fields for user provisionals. Auto-upsert `user_garden_plant_refs` when a
plant is placed or indoor-started so offline cache includes spacing data (extends
001 offline model).

**Alternatives considered**:
- **Denormalized plant snapshot on placement**: Rejected for v1 — stale spacing
  if catalog updates; revisit for historical audit in yield-tracking feature.

## 6. Indoor Starts

### Decision: Separate `indoor_starts` table; no bed placement until transplant

**Rationale**: Clarified spec decision — indoor starts do not occupy bed space.
Transplant endpoint validates spacing/incompatibility garden-wide, creates
`plant_placements` row, marks indoor start `transplanted`.

**Alternatives considered**:
- **Placeholder placement with `status=pending`**: Rejected — conflicts with
  clarified spec and would affect spacing calculations.

## 7. Offline Garden Layout

### Decision: Extend IndexedDB with `gardens` store; sync queue for offline mutations

**Rationale**: Spec edge case requires offline viewing/editing of cached gardens.
Mirror 001 pattern: server authoritative, client caches user's gardens on login.
Offline edits queue locally; on reconnect, replay with `expected_version` conflict
detection. Plant placement for uncached plants blocked offline (same as catalog).

**Alternatives considered**:
- **Online-only gardens**: Rejected — spec explicitly allows offline layout for
  cached gardens.
- **Full CRDT merge**: Over-engineered for v1; conflict prompt sufficient per spec.

## 8. Climate Advisory Warnings

### Decision: Reuse `lib/catalog/climate-filter.ts` date-window logic; warnings only at placement/transplant

**Rationale**: FR-017 requires advisory warnings for out-of-window dates using
user's saved location. Reuse existing location + planting window infrastructure
from 001; return `warnings[]` array alongside validation result without blocking
save when spacing/compatibility pass.

**Alternatives considered**:
- **Block out-of-window dates**: Rejected — spec and constitution allow advisory
  warnings for non-critical timing issues.

## 9. Orchard / Zone Types

### Decision: Defer orchard and mixed-use zone types to future feature

**Rationale**: Spec assumptions explicitly exclude orchard tree spacing and
non-rectangular polygon shapes. Constitution domain requirement for orchard layout
is satisfied by deferral documented in Complexity Tracking.

**Alternatives considered**:
- **Include basic orchard in v1**: Rejected — significantly expands scope.

## 10. Geometric Bed/Path Rotation

### Decision: 90° increment rotation with OBB overlap and boundary validation

**Rationale**: Clarified spec (FR-021) requires beds/paths rotate in 90° increments
only. Store `rotation_degrees` (0, 90, 180, 270) on `garden_areas`. Overlap and
boundary checks use oriented bounding boxes — for 90° increments, corners are
derived by rotating rectangle vertices about the area center (or origin corner).

**Implementation**:
- `lib/garden/geometry.ts`: `getRotatedCorners(area)`, `obbOverlaps(a, b)`,
  `isObbWithinGarden(obb, gardenBounds)`
- SVG rendering: `transform="rotate(deg cx cy)"` on bed/path groups
- UI: rotate handle or button cycles 0 → 90 → 180 → 270

**Alternatives considered**:
- **Free rotation**: Rejected — clarified spec limits to 90° increments.
- **AABB only (ignore rotation visually)**: Rejected — violates FR-021/SC-007.

## 11. Crop Rotation Planning

### Decision: Advisory warnings via bed planting history + catalog rotation identity

**Rationale**: Clarified spec (FR-022) requires history on every placement save
starting US3 (direct seed) and US5 (transplant). US6 adds **advisory rotation
warnings** (FR-023) using accumulated history — not history creation itself.
On each placement save, append `bed_planting_history` with resolved rotation
identity. On new placement (US6+), check same bed for matching rotation group
(or botanical family fallback) within lookback window.

**Rotation identity resolution** (via `lib/garden/rotation.ts` + catalog):
1. Curated `rotation_group` from `plant_rotation_metadata` reference table
2. Fallback: `botanical_family` on `canonical_plants` (ingested from Trefle taxonomy)
3. If both missing: skip rotation warning

**Lookback window**: Per-group `rotation_window_years` from reference table when
available; otherwise **3-year default**.

**Warning delivery**: Return `warnings[]` with code `CROP_ROTATION` alongside
validation result; same pattern as climate warnings. Never blocks save when spacing
and incompatibility pass.

**Alternatives considered**:
- **Hard block on repeat family**: Rejected — clarified advisory-only decision.
- **Botanical family only**: Rejected — gardeners use rotation groups (nightshades);
  curated group with family fallback matches clarify session answer.

## 12. Catalog Extension for Rotation (Feature 001 dependency)

### Decision: Curated `plant_rotation_metadata` reference table + botanical_family column

**Rationale**: Principle I requires rotation data in knowledge engine, not
hard-coded. Extend 001 reference layer (same pattern as `plant_relationships`):

| Field | Source |
|-------|--------|
| `botanical_family` | Trefle taxonomy on ingest → `canonical_plants.botanical_family` |
| `rotation_group` | Curated reference (nightshades, brassicas, legumes, …) |
| `rotation_window_years` | Curated per rotation_group default; override per plant optional |

Expose via `getRotationMetadata(plantId)` in `lib/catalog/query.ts`.

**Alternatives considered**:
- **Hard-coded rotation map in garden module**: Rejected — violates Principle I.
- **User-entered rotation group on provisional only**: Insufficient for catalog plants.

## 13. Bed Soil Type (USDA Texture Triangle)

### Decision: 12-class USDA enum; grouped bed editor; canvas abbreviated labels; metadata-only in v1

**Rationale**: Clarified spec (FR-006, FR-018) replaces the initial 4-value list
with the full USDA soil texture triangle. Soil type is optional bed metadata with
no validation impact in v1 — future soil testing and plant-matching features can
consume the same enum. Users select from texture groups (sand-, loam-, silt-,
clay-dominant) in the bed create/edit form; when set, an abbreviated label
renders on the bed in the SVG canvas only.

**Implementation**:
- `lib/garden/enums.ts`: `SOIL_TYPES`, `SOIL_TYPE_GROUPS`, `SOIL_CANVAS_ABBREV`
- `lib/garden/schemas.ts`: Zod enum of 12 values; `soil_type` nullable on area bodies
- `components/garden/AreaLayer.tsx`: render soil + sun abbrevs when set
- `components/garden/AreaEditor.tsx`: grouped soil `<select>`; flat sun selector; rotate US6
- API: accept `soil_type: null` on PUT to clear

**Alternatives considered**:
- **4-value list (clay/loam/sandy/silt)**: Rejected — superseded by clarify session.
- **Soil validation warnings in v1**: Rejected — no catalog soil preferences in 001.
- **Detail panel display**: Rejected — canvas-only visibility per clarify session.

## 14. Feature Delivery Phasing (2026-06-19 clarify session)

### Decision: US2–US5 axis-aligned; US6 rotation + crop warnings; history US3; validate-placement preview

| Capability | Delivered in | Notes |
|------------|--------------|-------|
| Axis-aligned beds/paths | US2 | AABB validation; `rotation_degrees = 0` |
| Soil/sun metadata + canvas labels | US2 | USDA grouped soil; sun abbrev on canvas |
| Planting history write | US3, US5 | On direct seed and transplant |
| validate-placement dry-run | US3 | `violations[]` hard blocks |
| Climate warnings | US5 | In save + validate-placement `warnings[]` |
| Geometric rotation + OBB | US6 | UI + API accept non-zero rotation |
| Crop rotation warnings | US6 | validate-placement + save `warnings[]` |
| Companion hints | Deferred | Incompatibility blocks only |

**Rationale**: Resolves analyze findings I1–I3, I7; enables incremental delivery
without FR-022 gaps or API/OBB mismatches.

**Alternatives considered**:
- **Rotation in US2**: Rejected — clarify session chose US6 bundle with crop rotation.
- **History in US6 only**: Rejected — loses history for US3–US5 incremental releases.
- **Companion hints in v1**: Rejected — spec assumption defers to future UX.
