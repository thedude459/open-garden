# Data Model: Visual Garden Planner Experience

**Date**: 2026-07-05 | **Plan**: [plan.md](./plan.md)

## Overview

Extends Feature 002 garden layout with visual presentation metadata, growing-area
types, structure placements, illustration references, canvas layering, and plan
thumbnails. Validation rules remain in `lib/garden/validation.ts`; this model adds
display and zone-type fields only.

## Entity Relationship Diagram

```text
users ──┬── gardens (+ zone_type, thumbnail_key, visual_version)
        │     ├── garden_areas (bed | path)          [002 unchanged]
        │     ├── garden_structures ──► structure_types
        │     ├── plant_placements (+ rootstock_id?, z_index, locked)
        │     ├── bed_planting_history               [002 unchanged]
        │     └── indoor_starts                      [002 unchanged]
        │
        ├── canonical_plants ◄── plant_illustrations
        └── plan_templates (reference, read-only)

structure_types (reference)
illustration_category_defaults (reference)
```

## Enums

### `garden_zone_type` (new on `gardens`)

| Value | Display | Purpose |
|-------|---------|---------|
| `vegetable_garden` | Vegetable garden | Beds, paths, annuals (default for migrated 002 gardens) |
| `orchard` | Orchard | Tree canopies, rootstock spacing |
| `container_patio` | Container / patio | Pots, planters, small-space layouts |

**Rules**:
- Required on create; default `vegetable_garden` for migrated rows
- Changing type on existing plan triggers confirmation + incompatible placement cleanup (spec edge case)
- `mixed` permaculture deferred

### `structure_category` (on `structure_types`)

`bed_frame` | `container` | `protection` | `vertical` | `access` | `amenity` | `other`

### `illustration_category` (fallback keys)

Maps to 001 `plant_category` plus `default_tree`, `default_shrub`, `default_flower`

## Table Changes

### `gardens` (extend)

| Column | Type | Notes |
|--------|------|-------|
| zone_type | garden_zone_type NOT NULL DEFAULT vegetable_garden | NEW |
| thumbnail_key | VARCHAR(256) | NEW — path under `public/planner/thumbnails/` |
| visual_version | SMALLINT NOT NULL DEFAULT 0 | NEW — 0 = pre-visual, 1+ = visual planner |

Existing columns unchanged.

### `plant_placements` (extend)

| Column | Type | Notes |
|--------|------|-------|
| rootstock_id | UUID FK → rootstock_options | NEW — orchard trees; null for annuals |
| z_index | INTEGER NOT NULL DEFAULT 0 | NEW — canvas layer order |
| locked | BOOLEAN NOT NULL DEFAULT false | NEW — prevent accidental drag |

### `structure_types` (reference, new)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| slug | VARCHAR(64) UNIQUE | e.g., `greenhouse`, `raised_bed`, `terracotta_pot` |
| name | VARCHAR(128) | Display name |
| category | structure_category | Library grouping |
| default_length | DECIMAL(10,2) | Default footprint |
| default_width | DECIMAL(10,2) | |
| illustration_path | VARCHAR(256) | Under `public/planner/structures/` |
| environment_tag | VARCHAR(32) | nullable — `greenhouse`, `cold_frame`, etc. |
| allowed_zone_types | garden_zone_type[] | Filter by garden type |

### `garden_structures` (new)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| garden_id | UUID FK → gardens | cascade delete |
| structure_type_id | UUID FK → structure_types | |
| origin_x | DECIMAL(10,2) | Garden coordinates |
| origin_y | DECIMAL(10,2) | |
| length | DECIMAL(10,2) | > 0 |
| width | DECIMAL(10,2) | > 0 |
| rotation_degrees | SMALLINT DEFAULT 0 | 0, 90, 180, 270 |
| z_index | INTEGER NOT NULL DEFAULT 0 | |
| locked | BOOLEAN NOT NULL DEFAULT false | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes**: `(garden_id)`

### `plant_illustrations` (reference, new)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| canonical_plant_id | UUID FK → canonical_plants UNIQUE | One illustration per plant |
| illustration_path | VARCHAR(256) | Under `public/planner/plants/` |
| updated_at | TIMESTAMPTZ | |

### `illustration_category_defaults` (reference, new)

| Column | Type | Notes |
|--------|------|-------|
| category | illustration_category PK | |
| illustration_path | VARCHAR(256) | Fallback sprite |

### `plan_templates` (reference, new)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| slug | VARCHAR(64) UNIQUE | e.g., `beginner-vegetable` |
| name | VARCHAR(128) | |
| description | TEXT | |
| zone_type | garden_zone_type | |
| preview_image_path | VARCHAR(256) | Gallery thumbnail |
| layout_snapshot | JSONB | Areas, structures, sample placements |
| sort_order | SMALLINT | Gallery ordering |

## Validation Rules (Application Layer)

| Rule | Module | Hard block? |
|------|--------|-------------|
| Existing 002 spacing/incompatibility | `validation.ts` | Yes |
| Tree canopy spacing (orchard) | `validation.ts` + rootstock catalog | Yes |
| Structure within garden bounds | `geometry.ts` | Yes |
| Structure overlap with beds | Advisory in v1 (visual only) | No |
| Illustration missing | `illustrations.ts` fallback | No — category default |
| Phone drag-and-drop | UI guard | N/A — disabled client-side |

### Orchard canopy spacing

- Canopy radius from rootstock `spacing_cm` or catalog mature spread ÷ 2
- Center-to-center distance ≥ `max(radiusA, radiusB)` (same pattern as 002 annual spacing)
- Hard block when catalog provides data; skip only when both plants lack data

## State Transitions

### Garden visual_version

```text
0 (legacy 002) ──open in visual planner──► displayed with resolved illustrations
0 ──first save in visual editor──► 1
```

### Structure / placement layer

```text
unlocked ──user locks──► locked (no drag until unlocked)
any ──send backward/forward──► z_index updated
```

## Migration from Feature 002

1. Add columns with defaults (`zone_type = vegetable_garden`, `visual_version = 0`)
2. Existing gardens open in visual planner without migration script
3. Illustration URLs resolved at read time via `plant_illustrations` + category fallback
4. `thumbnail_key` populated on first post-visual save
5. No changes to `bed_planting_history` or indoor start semantics

## Future Extensibility

- `garden_zone_type.mixed` for permaculture patches
- User-uploaded illustration overrides (out of scope v1)
- Polygon bed shapes (separate feature)
- Structure-to-scheduler environment effects (tag already stored)
