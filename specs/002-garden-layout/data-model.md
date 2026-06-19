# Data Model: Garden Layout & Planting

**Date**: 2026-06-19 | **Plan**: [plan.md](./plan.md)

## Overview

Garden layout data extends the existing user-data layer from Feature 001. All
garden entities are per-user, server-persisted in PostgreSQL. Validation reads
plant spacing and relationships from the catalog layer via `lib/catalog/query.ts`.

## Entity Relationship Diagram

```text
users ──┬── gardens ──┬── garden_areas (bed | path, rotation_degrees)
        │             ├── plant_placements ──► canonical_plants | user_provisional_plants
        │             ├── bed_planting_history ──► garden_areas (bed)
        │             └── indoor_starts ─────► canonical_plants | user_provisional_plants
        │                                        └── target: garden_areas (bed)
        └── user_garden_plant_refs (auto-updated on placement/indoor start)

canonical_plants ◄── plant_rotation_metadata (curated rotation_group, window)
```

## Enums

### `measurement_unit`
`feet` | `meters`

### `garden_area_type`
`bed` | `path`

### `soil_type`

USDA soil texture triangle (12 classes). Stored as snake_case enum values; API
and DB use the same strings.

| Value | Display name | Canvas abbrev | UI group |
|-------|--------------|---------------|----------|
| `sand` | Sand | Sand | sand-dominant |
| `loamy_sand` | Loamy sand | L. sand | sand-dominant |
| `sandy_loam` | Sandy loam | S. loam | sand-dominant |
| `sandy_clay_loam` | Sandy clay loam | Sa. cl loam | sand-dominant |
| `sandy_clay` | Sandy clay | Sa. clay | sand-dominant |
| `loam` | Loam | Loam | loam |
| `silt_loam` | Silt loam | Si. loam | silt-dominant |
| `silt` | Silt | Silt | silt-dominant |
| `silty_clay_loam` | Silty clay loam | Si. cl loam | silt-dominant |
| `silty_clay` | Silty clay | Si. clay | silt-dominant |
| `clay_loam` | Clay loam | C. loam | clay-dominant |
| `clay` | Clay | Clay | clay-dominant |

**Rules**:
- Optional on beds (`null` = unset / "Not set"); clearable after set
- MUST be null on paths
- Metadata only in v1 — does not affect placement, spacing, incompatibility,
  climate, or rotation validation
- Display on layout canvas only (abbreviated label when set); edited via bed
  create/edit form with grouped selector (FR-006, FR-018)

### `bed_sun_exposure`

| Value | Display name | Canvas abbrev |
|-------|--------------|---------------|
| `full_sun` | Full sun | Sun |
| `partial_shade` | Partial shade | Part sh |
| `full_shade` | Full shade | Shade |

**Rules** (same as soil_type):
- Optional on beds; clearable to null; null on paths
- Metadata only in v1 — no validation impact
- Canvas abbreviated label when set; not in detail panel (FR-006, FR-018)

### `placement_status`
`direct_seeded` | `transplanted`

### `indoor_start_status`
`active` | `transplanted` | `cancelled`

## Tables

### `gardens`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | cascade delete |
| name | VARCHAR(128) NOT NULL | |
| description | TEXT | optional |
| length | DECIMAL(10,2) NOT NULL | > 0 |
| width | DECIMAL(10,2) NOT NULL | > 0 |
| unit | measurement_unit NOT NULL | feet or meters |
| version | INTEGER NOT NULL DEFAULT 1 | optimistic concurrency |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes**: `(user_id)`, `(user_id, updated_at DESC)`

### `garden_areas`

Unified table for plantable beds and non-plantable paths.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| garden_id | UUID FK → gardens | cascade delete |
| area_type | garden_area_type NOT NULL | bed or path |
| name | VARCHAR(128) | optional label |
| origin_x | DECIMAL(10,2) NOT NULL | offset from garden top-left |
| origin_y | DECIMAL(10,2) NOT NULL | |
| length | DECIMAL(10,2) NOT NULL | > 0 |
| width | DECIMAL(10,2) NOT NULL | > 0 |
| rotation_degrees | SMALLINT NOT NULL DEFAULT 0 | 0, 90, 180, or 270 only |
| soil_type | soil_type | beds only; null for paths |
| sun_exposure | bed_sun_exposure | beds only; null for paths |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes**: `(garden_id)`

**Constraints** (enforced in application layer):
- Rectangle fully within parent garden bounds (AABB when `rotation_degrees = 0`;
  OBB when rotated — US6 only)
- No overlap with sibling areas (AABB US2–US5; OBB US6)
- `rotation_degrees` IN (0, 90, 180, 270); **US2–US5 API MUST reject non-zero**
  with `422` until US6 rotation UI enabled
- `soil_type` / `sun_exposure` MUST be null when `area_type = path`

### `bed_planting_history`

Retained when placements deleted; powers crop rotation checks (FR-022). **Written
on every direct seed (US3) and transplant (US5)**; rotation **warnings** evaluated
in US6 (FR-023).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| garden_id | UUID FK → gardens | |
| bed_area_id | UUID FK → garden_areas | bed only |
| canonical_plant_id | UUID FK → canonical_plants | exactly one plant ref |
| provisional_plant_id | UUID FK → user_provisional_plants | |
| rotation_group | VARCHAR(64) | resolved at save time; nullable |
| botanical_family | VARCHAR(128) | fallback identity; nullable |
| planted_on | DATE NOT NULL | |
| created_at | TIMESTAMPTZ | |

**Indexes**: `(bed_area_id, planted_on DESC)`, `(garden_id)`

**Constraints**:
- CHECK: exactly one of `canonical_plant_id`, `provisional_plant_id` is non-null
- At least one of `rotation_group`, `botanical_family` SHOULD be non-null when
  catalog provides data (not enforced — rotation check skipped if both null)

### `plant_placements`

One row = one plant instance occupying bed space.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| garden_id | UUID FK → gardens | denormalized for garden-wide queries |
| bed_area_id | UUID FK → garden_areas | must reference a bed |
| canonical_plant_id | UUID FK → canonical_plants | exactly one plant ref |
| provisional_plant_id | UUID FK → user_provisional_plants | |
| position_x | DECIMAL(10,2) NOT NULL | garden coordinates |
| position_y | DECIMAL(10,2) NOT NULL | |
| status | placement_status NOT NULL | direct_seeded or transplanted |
| planted_on | DATE NOT NULL | sow or transplant date |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes**: `(garden_id)`, `(bed_area_id)`

**Constraints**:
- CHECK: exactly one of `canonical_plant_id`, `provisional_plant_id` is non-null
- `bed_area_id` MUST reference area with `area_type = bed`
- `(position_x, position_y)` MUST lie within bed rectangle

### `indoor_starts`

Separate from bed layout until transplant.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| garden_id | UUID FK → gardens | parent garden context |
| target_bed_area_id | UUID FK → garden_areas | nullable if bed deleted |
| canonical_plant_id | UUID FK → canonical_plants | exactly one plant ref |
| provisional_plant_id | UUID FK → user_provisional_plants | |
| started_on | DATE NOT NULL | indoor start date |
| status | indoor_start_status NOT NULL DEFAULT active | |
| transplanted_placement_id | UUID FK → plant_placements | set on transplant |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes**: `(garden_id, status)`, `(target_bed_area_id)`

**Constraints**:
- CHECK: exactly one of `canonical_plant_id`, `provisional_plant_id` is non-null

## Validation Rules (Application Layer)

### Geometry (`lib/garden/geometry.ts`)

| Rule | Function |
|------|----------|
| Area within garden bounds | `isWithinBounds(area, garden)` — AABB when 0°; OBB US6 |
| Two areas overlap | `areasOverlap(a, b)` — AABB US2–US5; OBB US6 |
| Point within bed | `isPointInBed(x, y, bed)` — accounts for rotation |
| Rotated corners | `getRotatedCorners(area)` |

### Placement (`lib/garden/validation.ts`)

| Rule | Input | Output |
|------|-------|--------|
| Spacing violation | candidate placement + all garden placements | `{ valid, violations[] }` |
| Incompatible adjacency | candidate plant ID + garden placements | `{ valid, incompatibles[] }` |
| Missing spacing data | plant record | block if null |
| Layout shrink conflict | proposed area geometry + placements | `{ affectedPlacementIds[] }` |
| validate-placement dry-run | candidate + garden | `{ valid, violations[], warnings[] }` — FR-017a |

**validate-placement response** (FR-017a):
- `violations[]`: spacing, incompatibility (hard blocks)
- `warnings[]`: `CLIMATE_DATE` (US5+), `CROP_ROTATION` (US6+); never blocks save alone

### Rotation (`lib/garden/rotation.ts`)

| Rule | Input | Output |
|------|-------|--------|
| Resolve identity | plant ID | `{ rotation_group?, botanical_family? }` |
| Append history | placement save (US3/US5) | insert `bed_planting_history` row |
| Rotation conflict | bed ID + candidate identity + history | `{ warning? }` advisory only (US6+) |

Lookback: `rotation_window_years` from `plant_rotation_metadata` per group;
3-year default when unavailable. Match on `rotation_group` first; if candidate
has no group, match on `botanical_family`.

Spacing: center-to-center distance ≥ `max(spacingA, spacingB)` (converted to
garden units from catalog `spacing_cm.plant`).

Incompatibility: block if any garden placement within combined spacing zone has
a plant ID in candidate's incompatible list (via `getRelationships()`).

### Versioning

Any mutation to garden, areas, placements, or indoor starts increments
`gardens.version` and updates `gardens.updated_at` within a transaction.

## State Transitions

**Note**: `placement_status` and `indoor_start_status` satisfy FR-014 lifecycle
tracking. Phenological growth stage (seedling, flowering, etc.) is out of scope
for this feature and deferred to task scheduling.

### Indoor Start

```text
active ──transplant (valid position)──► transplanted
active ──cancel──► cancelled
active ──target bed deleted──► active (target_bed_area_id = null; user reassigns via PATCH or removes)
```

### Plant Placement

```text
(direct seed) ──create──► direct_seeded
(indoor start) ──transplant──► transplanted
any ──bed deleted / layout evicted──► deleted
```

## Offline Cache Projection (IndexedDB)

Extends Feature 001 cache with:

| Store | Key | Value |
|-------|-----|-------|
| `gardens` | garden_id | Full garden snapshot (areas, placements, indoor starts) |
| `garden_sync_queue` | auto | Pending mutations with expected_version |

Cache manifest extended with `garden_ids[]` and `garden_version`.

## Migration from Feature 001

- `user_garden_plant_refs` already exists for offline pinning
- New trigger: upsert ref when plant placed or indoor-started in any garden
- **Extend 001 catalog** (same migration or follow-on):
  - Add `botanical_family` VARCHAR to `canonical_plants` (Trefle ingest)
  - Add curated `plant_rotation_metadata` table (plant_id, rotation_group,
    rotation_window_years)
  - Seed rotation groups for top edible species in `scripts/seed-reference-data.ts`
  - Expose `getRotationMetadata(plantId)` in `lib/catalog/query.ts`

## Future Extensibility (Not This Feature)

- `gardens.zone_type` enum (`garden`, `orchard`, `mixed`) — deferred
- `plant_placements.rootstock_id` — for orchard tree placements
- Denormalized placement snapshots for historical yield tracking
