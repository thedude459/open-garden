# Data Model: Seasonal Plantings

**Feature**: `004-seasonal-plantings` | **Date**: 2026-08-16  
**Spec**: [spec.md](./spec.md)

## Entities

### NamedBed (`garden_beds`)

A label/container inside one garden. Not geometry.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK; client MAY supply on insert |
| garden_id | UUID | FK → Garden; ON DELETE CASCADE; required |
| name | text | trimmed display; 1–120 chars after trim |
| name_normalized | text | trim + lowercase; UNIQUE with garden_id |
| created_at | timestamptz | required |
| updated_at | timestamptz | required; bump on rename |

**Constraints**:
- UNIQUE `(garden_id, name_normalized)`
- Reject blank/whitespace-only name
- Reject duplicate name in the same garden (trim, case-insensitive)

**Notes**:
- Delete does not delete plantings; their `bed_id` becomes null.
- Empty beds remain rows so they can appear as empty groups.

### Planting (`garden_plantings`)

A household record that a catalog variety is in the ground or will be
(recorded on this garden’s planting list), not a planting-calendar plan.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK; client MAY supply on insert (offline idempotency) |
| garden_id | UUID | FK → Garden; ON DELETE CASCADE; required |
| plant_id | UUID | FK → Plant; ON DELETE RESTRICT; required |
| bed_id | UUID \| null | FK → NamedBed; ON DELETE SET NULL |
| planted_on | date \| null | ISO calendar date; past/today/future; null = not set |
| harvested_on | date \| null | same; null = not set |
| created_at | timestamptz | required; list “newest” uses this |
| updated_at | timestamptz | required; bump on PATCH |
| client_mutation_id | text \| null | optional idempotency from offline sync |

**Constraints**:
- No UNIQUE `(garden_id, plant_id)` — duplicates allowed (FR-013)
- If `bed_id` is set, that bed MUST belong to the same `garden_id`
- If both dates set: `harvested_on >= planted_on`
- After confirmed delete the row is gone (no status/archive column)

**Notes**:
- Distinct from a calendar plan line and from a personal favorite.
- Hard-delete of the garden removes all plantings and beds (cascade).
- Deprecated/unavailable catalog plants stay listed via `plants.status`.
- Calendar entries and favorites are not referenced.

### Computed PlantingGroup (not persisted)

Produced by `groupPlantings(plantings, beds)` for the default list.

| Field | Type | Rules |
|-------|------|-------|
| key | bed UUID or `'unassigned'` | |
| title | bed name or `Unassigned` | |
| bedId | UUID \| null | null for Unassigned |
| plantings | Planting[] | newest `created_at` first |

Empty named beds still produce a group with `plantings: []`. The Unassigned
group is omitted when no planting has `bedId === null` (including when the
garden has zero plantings).

### Garden / Membership / User / Plant (existing)

Unchanged. AuthZ is garden membership (ADR 0004). Plant identity fields
(`common_name`, `species`, `cultivar`, `plant_type`, `status`) are joined for
the list DTO. Growing-guidance / frost windows are **not** shown on this list
(calendar owns that).

## Relationships

```text
Garden 1──* NamedBed
Garden 1──* Planting *──1 Plant
NamedBed 0──* Planting          -- optional; SET NULL on bed delete
Garden 1──* GardenMembership *──1 User
User 1──* Favorite *──1 Plant   -- picker only; not garden-scoped
Garden 1──* GardenCalendarEntry -- unrelated; no auto-convert
```

## Validation rules

- Unauthenticated: all planting/bed routes 401.
- Non-member GET/POST/PATCH/DELETE: **404** `Garden not found`.
- Viewer POST/PATCH/DELETE plantings: **403** `Viewers cannot update plantings`.
- Viewer POST/PATCH/DELETE beds: **403** `Viewers cannot update beds`.
- POST planting `plantId` required UUID; unknown plant → **404** `Plant not found`.
- `bedId` set but missing or other garden → **404** `Bed not found`.
- Planting id not in this garden → **404** `Planting not found`.
- POST planting with an id that already exists in **this** garden: **200**
  existing row (idempotent retry; do not insert a second row).
- POST planting with an id that exists in **another** garden: **409**.
- Blank bed name: **400** `Bed name is required`.
- Bed name > 120: **400** `Bed name must be at most 120 characters`.
- Duplicate bed name in garden: **409** `That garden already has a bed with that name`.
- Harvest before planted: **400** `Harvest date must be on or after planted date`.
- Invalid ISO date: **400** `Date must be YYYY-MM-DD`.
- Future dates: accepted.
- PATCH planting last-write-wins; no merge editor.
- DELETE planting that exists: **204**. DELETE planting missing: **404**
  `Planting not found` (do not recreate).
- DELETE bed: **204**; assigned plantings remain with `bedId` null.

## State transitions

### Planting

- Absent → Present: POST (idempotent if client id already in this garden)
- Present → Present: PATCH dates and/or bed (including set bed to null)
- Present → Absent: confirmed DELETE (permanent)

No `status` column. Plant `deprecated` does not remove the planting.

### NamedBed

- Absent → Present: POST
- Present → Present: PATCH name
- Present → Absent: DELETE; plantings in that bed become unassigned

### Pending (client-only)

Not stored in Postgres. IndexedDB queue overlays create/update/delete until
drain. Overlay MUST NOT insert a planting after a 404 on PATCH/DELETE.

### Grouped view (client-derived)

Not stored. Recomputed at view time from beds + plantings + optional bed filter.

## Indexes

- UNIQUE `garden_beds (garden_id, name_normalized)`
- INDEX `garden_beds (garden_id)`
- INDEX `garden_plantings (garden_id, created_at DESC)`
- INDEX `garden_plantings (bed_id)`
- INDEX `garden_plantings (plant_id)`
