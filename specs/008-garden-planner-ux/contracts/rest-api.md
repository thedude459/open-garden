# Garden Planner API Contracts

**Base path**: `/api`  
**Auth / error shape**: Same as [005 rest-api](../005-garden-layout/contracts/rest-api.md)
and [004 rest-api](../004-seasonal-plantings/contracts/rest-api.md).  
**Shared types**: `libs/shared-types`.

## Layout

| Method | Path | Use |
|--------|------|-----|
| GET | `/api/gardens/:id/layout` | Last successful plan including **areas**; offline cache |
| PUT | `/api/gardens/:id/layout` | Save draft: sized beds, **areas upsert**, placements. 422 if blocking flags |

PUT body adds `areas: LayoutAreaPutDto[]`. Each listed area is inserted or
updated. Areas **not** listed are left unchanged (delete is a separate
endpoint). `placements` semantics unchanged from 005 (listed = placed;
omitted planting with existing coords = unplace / restore transplant).

GET `GardenLayoutDto` adds `areas` and planting `startMethod`,
`indoorStartedOn`. `plantings` with `startMethod: "transplant"` and
`placement: null` are the Bed View tray. Overview MUST NOT use them as
drag targets on the map.

## Beds (unchanged paths; delete semantics extended)

| Method | Path | Use |
|--------|------|-----|
| POST | `/api/gardens/:id/beds` | Save of new beds (`id` + `name`) |
| DELETE | `/api/gardens/:id/beds/:bedId` | Confirmed immediate delete |

On bed DELETE: **direct_seed** plantings in that bed are deleted;
**transplant** plantings in that bed are unassigned and unplaced (tray).
POST without length and width MUST be refused (400). After migration `0008`,
unsized beds MUST NOT exist.

## Non-planting areas

| Method | Path | Use |
|--------|------|-----|
| DELETE | `/api/gardens/:id/areas/:areaId` | Confirmed immediate delete |

Viewer DELETE 403 `Viewers cannot update layout`. Missing area or other
garden: 404 `Area not found`. Non-member: 404 `Garden not found`.

Create/move/resize: **PUT layout `areas`**, not a separate POST. Empty area
name → 400; duplicate area name in garden → 409.

## Plantings (004 paths; body extended)

| Method | Path | Use |
|--------|------|-----|
| POST | `/api/gardens/:id/plantings` | Transplant create (immediate) **or** Save of draft direct seed |
| DELETE | `/api/gardens/:id/plantings/:plantingId` | Transplant full-delete (immediate) **or** Save of direct-seed remove |
| GET | `/api/gardens/:id/plantings` | List includes `startMethod` |

`PlantingCreateDto` adds required `startMethod`. If `transplant`,
`indoorStartedOn` required (YYYY-MM-DD). If `direct_seed`, `indoorStartedOn`
must be absent/null. Transplant POST MUST NOT set placement; `bedId` null.
Direct-seed POST used at Save MAY include `bedId`; placement still applied
via layout PUT.

## Transplants (read model)

| Method | Path | Use |
|--------|------|-----|
| GET | `/api/gardens/:id/transplants` | Unplaced transplants + indoor reminder items |

```json
{
  "gardenId": "uuid",
  "myRole": "owner",
  "plantings": [ { "id": "uuid", "startMethod": "transplant", "indoorStartedOn": "2026-08-21", "placement": null } ],
  "indoorReminders": [ { "plantingId": "uuid", "kind": "water", "dueOn": "2026-08-21", "urgency": "dueToday", "intervalDays": 3 } ]
}
```

`indoorReminders` items are `ReminderItemDto` (006) with `kind` water or
fertilize only. Viewer GET 200; non-member 404.

## Reminders (unchanged)

| Method | Path | Use |
|--------|------|-----|
| POST | `/api/gardens/:id/reminders` | Complete/dismiss indoor or in-ground occurrence |

Indoor items use the same body as 006. Garden reminders **GET** MUST NOT
include indoor-only items (still `planted_on` derivation only).

## Save orchestration (client)

1. Offline → online-required; no writes; draft unchanged.
2. `evaluateLayout(draft)` blocking flags → no POST/PUT; `Layout has spacing or fit problems`.
3. POST each `newBedIds`.
4. POST each `newDirectSeedIds` (`startMethod: direct_seed`, `bedId` set).
5. PUT layout (sized beds, areas, placements). Do **not** include pending
   direct-seed deletes in `placements`.
6. DELETE each `pendingDirectSeedDeletes`.
7. On PUT 200: replace draft from GET (or PUT response); write IndexedDB.
8. On PUT failure after POSTs: DELETE beds **and** direct-seed plantings
   created in this Save; keep in-memory draft; do not write IndexedDB.

Transplant POST/DELETE and area/bed DELETE are **not** part of this Save
pipeline.

## Not in this feature

- Auto-save; layout mutation queue; snap-to-grid API; companion/favorites
- Area rotate; mixing indoor items into garden reminders GET
