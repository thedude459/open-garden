# Data Model: Garden Layout Designer

**Feature**: `005-garden-layout` | **Date**: 2026-08-16  
**Spec**: [spec.md](./spec.md)

Geometry is extra information on Seasonal Plantings entities. There is no
separate “layout document” row.

## Entities

### NamedBed (extended `garden_beds`)

Same household bed as 004, plus optional rectangle on the garden plan.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | existing PK |
| garden_id | UUID | existing FK |
| name / name_normalized | text | existing 004 rules |
| origin_x_inches | int \| null | plan-space origin of local (0,0); required iff geometry set |
| origin_y_inches | int \| null | same |
| length_inches | int \| null | local x extent; ≥ 1 when geometry set |
| width_inches | int \| null | local y extent; ≥ 1 when geometry set |
| orientation | smallint | `0`, `90`, `180`, or `270`; ignored when geometry is unset; default `0` |
| created_at / updated_at | timestamptz | bump `updated_at` on geometry or name change |

**Constraints**:
- Geometry is **all null** (`origin_x`, `origin_y`, `length`, `width`) **or**
  all four set with `length_inches ≥ 1`, `width_inches ≥ 1`, and `orientation`
  in `{0,90,180,270}`.
- Name uniqueness unchanged (trim, case-insensitive per garden).
- Delete still SET NULL on plantings’ `bed_id` and MUST clear planting layout
  coords in the same transaction.

**Notes**:
- Unsized beds (geometry all null) still appear on the planting list as empty
  groups and on the layout as “needs size.”
- Rotate 90° writes a new `orientation` only. Do not swap stored length/width
  and do not rewrite placements.
- Rename of an existing bed is not stored via layout PUT; use 004 PATCH `/beds/:bedId`.

### Planting (extended `garden_plantings`)

Same seasonal planting as 004, plus optional placement (plant center in
**bed-local** inches).

| Field | Type | Rules |
|-------|------|-------|
| (all 004 columns) | | unchanged |
| layout_x_inches | int \| null | local x of plant center; both layout cols null = unplaced |
| layout_y_inches | int \| null | local y |

**Constraints**:
- Layout coords are **both null** or **both set**.
- If both set: `bed_id` MUST be non-null and that bed MUST have geometry.
- No UNIQUE on variety. Duplicate plantings are two placements.
- Unplace = set both layout cols null; do **not** clear `bed_id`.
- Place = set `bed_id` + both layout cols.
- Planting-list PATCH that changes `bed_id` (including to null) MUST clear
  layout cols.

**Notes**:
- Calendar plans and favorites are not referenced.
- Spacing is not stored; it is read from `plants.spacing_inches` at evaluate
  time.

### Layout snapshot (not a table)

Produced for GET/PUT and for `evaluateLayout`:

| Field | Meaning |
|-------|---------|
| beds | every named bed; geometry present or null |
| placements | plantings that have both layout cols set |
| unplaced | plantings with layout cols null (still listed with identity + bedId) |

### SpacingFlag / FitFlag (computed, not persisted)

| Field | Rules |
|-------|-------|
| kind | `'spacing'` \| `'fit'` \| `'unavailable'` |
| plantingIds | one (fit/unavailable) or two (spacing pair) |
| blocking | `true` for spacing/fit; `false` for unavailable |

A PUT is refused if any blocking flag exists. Unavailable never blocks.

### Garden / Membership / Plant (existing)

Unchanged. AuthZ is garden membership (ADR 0004). `plants.spacing_inches`
(`int \| null`, > 0 when set) is the spacing source. No provider calls.

## Relationships

```text
Garden 1──* NamedBed          -- optional geometry on the bed
Garden 1──* Planting *──1 Plant
NamedBed 0──* Planting        -- bed_id; SET NULL on bed delete
Planting 0──1 Placement       -- layout_x/y on the same row; requires bed + geometry
```

## Validation rules

- Unauthenticated layout routes: **401**.
- Non-member GET/PUT: **404** `Garden not found`.
- Viewer PUT: **403** `Viewers cannot update layout`.
- Viewer GET: **200**.
- PUT body bed id missing or other garden: **404** `Bed not found`.
- PUT body planting id missing or other garden: **404** `Planting not found`.
- Placement `bedId` not in this garden or without geometry: **404** `Bed not found`.
- Geometry partially set (some of origin/length/width null): **400**
  `Bed size and position are required`.
- length/width < 1: **400** `Bed length and width must be at least 1 inch`.
- orientation not 0/90/180/270: **400** `Bed rotation must be 0, 90, 180, or 270 degrees`.
- layout x/y only one set: **400** `Placement position is required`.
- Blocking spacing or fit flags: **422** `Layout has spacing or fit problems`
  (no write).
- Last successful PUT wins; no merge editor.
- DELETE bed (004): plantings unassigned **and** unplaced.

## State transitions

### Bed geometry

- Unsized → Sized: included in PUT with origin, length, width, orientation
- Sized → Sized: PUT new origin/size/orientation
- Sized → Unsized: omitted from PUT `beds` (name remains)
- Present → Absent: confirmed DELETE `/beds/:bedId` (004); plantings unassigned
  and unplaced

### Placement

- Unplaced → Placed: included in PUT `placements` (sets bedId + local x/y)
- Placed → Placed: same planting listed with new bed and/or coords
- Placed → Unplaced: omitted from PUT `placements` (clears x/y only)
- Planting absent: 004 DELETE planting; placement gone with the row

### Evaluated layout (derived)

Recomputed on GET (should be flag-free if last PUT succeeded) and on the
client for unsaved edits. Not stored.

## Indexes

Existing 004 indexes remain.

- No extra unique indexes (multiple plantings per bed; multiple unsized beds).
