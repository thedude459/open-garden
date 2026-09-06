# Data Model: Garden Planner UX

**Feature**: `008-garden-planner-ux` | **Date**: 2026-08-21  
**Spec**: [spec.md](./spec.md)  
**Depends on**: [005 data-model](../005-garden-layout/data-model.md),
[004 data-model](../004-seasonal-plantings/data-model.md),
[006 data-model](../006-care-reminders/data-model.md)

## New / extended persisted entities

### NonPlantingArea (`garden_non_planting_areas`) — new

Named rectangle on Garden Overview. Never a bed. Never has plantings.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK; client MAY supply on PUT upsert |
| garden_id | UUID | FK Garden; ON DELETE CASCADE |
| name | text | trimmed 1–120 chars |
| name_normalized | text | trim + lowercase; UNIQUE with garden_id |
| origin_x_inches | int | required; plan-space origin |
| origin_y_inches | int | required |
| length_inches | int | ≥ 1 |
| width_inches | int | ≥ 1 |
| created_at / updated_at | timestamptz | bump on geometry or name change |

**Constraints**: Always complete geometry (no null size). Axis-aligned; no
orientation column. Unique name per garden among **areas** (beds may reuse a
name). Delete does not affect beds or plantings.

### NamedBed (`garden_beds`) — unchanged columns

Planner create still requires length and width. Leftover `geometry: null`
rows are **deleted** by migration `0008` (same start-method cascade as bed
DELETE). After migrate they MUST NOT exist. Confirmed DELETE: see
start-method rules under Planting.

### Planting (`garden_plantings`) — extended

| Field | Type | Rules |
|-------|------|-------|
| (all 004/005 columns) | | unchanged |
| start_method | text | `'direct_seed'` \| `'transplant'`; NOT NULL; existing rows default `direct_seed` |
| indoor_started_on | date \| null | required for transplant at create; MUST be null for direct_seed |

**Constraints**:

- Direct seed: `indoor_started_on` null. May have bed + placement (Bed View).
- Transplant: `indoor_started_on` set. Unplaced (`layout` both null, `bed_id`
  null) → tray + Transplant View. Placed → Bed View only (not indoor list).
- Layout coords still both null or both set; if set, `bed_id` required and
  that bed must have geometry.

**Bed DELETE** (same transaction):

1. DELETE all plantings in that bed with `start_method = direct_seed`.
2. For plantings in that bed with `start_method = transplant`: SET `bed_id`
   NULL and clear layout coords (keep `indoor_started_on` and care events).

### CareEvent (`garden_care_events`) — unchanged

Indoor complete/dismiss writes the same rows (`kind` water | fertilize).
Harvest is never derived for indoor-only plantings.

### Indoor reminder item (derived, not a table)

Produced by `deriveIndoorReminders` for Transplant View only.

| Field | Meaning |
|-------|---------|
| plantingId | unplaced transplant |
| kind | `'water'` \| `'fertilize'` |
| dueOn / urgency / intervalDays | same as 006 repeating rules, cursor from events, start date = `indoor_started_on` |

Omitted when the matching catalog interval is null. Never produced for
direct seed or for **placed** transplants.

## Client-only entities

### DraftLayout

Working copy of `GardenLayoutDto` plus local metadata.

| Field | Type | Rules |
|-------|------|-------|
| base | GardenLayoutDto | Last successful GET (hydrated from layout cache / GET; not written to IndexedDB here) |
| beds / areas / plantings / flags | DTOs | Working snapshot; flags on **gesture end** |
| dirty | boolean | True if layout draft ≠ last save |
| newBedIds | UUID[] | POST at Save then PUT |
| newDirectSeedIds | UUID[] | POST plantings at Save then PUT placements |
| pendingDirectSeedDeletes | UUID[] | DELETE plantings at Save (remove from bed) |

**Constraints**: Viewers have no draft. Leave/reload discards draft.
`garden-layout-cache.service.ts` is the only IndexedDB writer (last
successful GET). Draft is memory-only. Offline: no draft mutation. Navigating
Overview ↔ Bed View ↔ Transplant View MUST NOT discard the draft.

Transplant POST/DELETE and area DELETE and bed DELETE are **not** draft
fields; they hit the network immediately (online-required).

### PlanView

Pan/zoom of the Overview inch plan (`panX`, `panY`, `scale`). Not persisted.
Bed View has its own scale for the single bed (fit-to-bed).

### Gesture

| kind | View |
|------|------|
| `'pan'` | Overview empty space |
| `'move-bed'` / `'resize-bed'` | Overview |
| `'move-area'` / `'resize-area'` | Overview |
| `'open-bed'` | Overview pointerup on bed with no drag |
| `'move-planting'` / `'tray-drag'` / `'place-direct-seed'` | Bed View |

## Relationships

```text
Garden 1──* NamedBed
Garden 1──* NonPlantingArea
Garden 1──* Planting *──1 Plant
NamedBed 0──* Planting          -- bed_id; start_method rules on bed delete
Planting 0──1 Placement         -- layout_x/y
Planting 1──* CareEvent
Editor session 0──1 DraftLayout
```

## Validation rules

Server AuthZ unchanged: 401 unauthenticated; 404 non-member `Garden not found`;
403 viewer mutate; owner/collaborator write.

**Areas**: name empty → 400; duplicate area name in garden → 409; length/width
&lt; 1 → 400; viewer DELETE/PUT area → 403.

**Plantings**: `start_method` invalid → 400; transplant without
`indoor_started_on` → 400; direct_seed with `indoor_started_on` → 400;
direct seed create without a sized bed placement is refused on Save.

**Beds**: POST without length/width → 400. After `0008`, no `geometry` null
rows remain.

**Layout PUT**: blocking flags → 422, no write. Areas in PUT upserted.
Omitted areas are **not** deleted (only DELETE endpoint). Omitted placements
clear x/y (005). Direct-seed pending deletes run in the Save transaction
after evaluate.

## State transitions

### Area

- Absent → on draft (client UUID, viewport-center origin) → Save PUT upsert
- Sized → move/resize on draft → Save PUT
- Present → absent: confirm → immediate DELETE (not PUT omit)

### Bed (planner)

Unchanged from 008-08-18 except **create origin** = viewport center in plan
inches, DELETE applies start-method planting rules, and unsized beds are
gone after `0008` (no leftover-size state).

### Planting

- Transplant create (Transplant View) → unplaced row → tray
- Transplant full-delete (Transplant View) → row gone (CASCADE events)
- Tray → placed: Bed View drop (draft) → Save PUT
- Placed transplant → tray: remove from bed / drop on tray (draft)
- Direct seed create in Bed View → draft row+placement → Save POST+PUT
- Direct seed remove from bed (confirm) → pending delete → Save DELETE
- Direct seed drop on tray → no-op (must not silent-delete)
