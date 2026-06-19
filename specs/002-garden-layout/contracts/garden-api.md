# Contract: Garden Layout API

**Version**: 1.0 | **Base path**: `/api/gardens`

All endpoints require authenticated session. Responses are JSON. Mutating requests
accept optional `expected_version` (integer) for optimistic concurrency; mismatch
returns `409 Conflict`.

Shared types reference [data-model.md](../data-model.md).

### `soil_type` (beds only)

Optional; `null` when unset. One of:

`sand` | `loamy_sand` | `sandy_loam` | `loam` | `silt_loam` | `silt` |
`sandy_clay_loam` | `clay_loam` | `silty_clay_loam` | `sandy_clay` |
`silty_clay` | `clay`

Metadata only in v1 — does not affect validation or warnings. Send `"soil_type": null`
on PUT to clear. MUST be omitted or null on paths.

## Garden

### GET `/api/gardens`

List user's gardens (summary).

**Response 200**:

```json
{
  "gardens": [
    {
      "id": "uuid",
      "name": "Backyard",
      "length": 30,
      "width": 20,
      "unit": "feet",
      "version": 3,
      "updated_at": "2026-06-19T12:00:00Z",
      "bed_count": 2,
      "placement_count": 8
    }
  ]
}
```

### POST `/api/gardens`

Create garden.

**Body**:

```json
{
  "name": "Backyard",
  "length": 30,
  "width": 20,
  "unit": "feet",
  "description": "optional"
}
```

**Response 201**: `GardenDetail` (see below)

**Errors**: `401`; `422` invalid dimensions (≤ 0)

### GET `/api/gardens/:gardenId`

Full garden with areas, placements, indoor starts.

**Response 200**: `GardenDetail`

```json
{
  "id": "uuid",
  "name": "Backyard",
  "length": 30,
  "width": 20,
  "unit": "feet",
  "description": null,
  "version": 3,
  "areas": [
    {
      "id": "uuid",
      "area_type": "bed",
      "name": "Bed A",
      "origin_x": 2,
      "origin_y": 2,
      "length": 8,
      "width": 4,
      "rotation_degrees": 0,
      "soil_type": "loam",
      "sun_exposure": "full_sun"
    },
    {
      "id": "uuid",
      "area_type": "path",
      "name": "Main path",
      "origin_x": 10,
      "origin_y": 0,
      "length": 2,
      "width": 20,
      "rotation_degrees": 90,
      "soil_type": null,
      "sun_exposure": null
    }
  ],
  "placements": [
    {
      "id": "uuid",
      "bed_area_id": "uuid",
      "plant": { "id": "uuid", "common_name": "Tomato", "provenance": "authoritative" },
      "position_x": 4,
      "position_y": 4,
      "status": "direct_seeded",
      "planted_on": "2026-05-15",
      "spacing_radius": 0.75
    }
  ],
  "indoor_starts": [
    {
      "id": "uuid",
      "plant": { "id": "uuid", "common_name": "Pepper", "provenance": "authoritative" },
      "target_bed_area_id": "uuid",
      "started_on": "2026-03-01",
      "status": "active"
    }
  ]
}
```

`spacing_radius` is in garden units (half of catalog plant spacing) for UI rendering.

**Errors**: `401`; `404` not found or not owned by user

### PUT `/api/gardens/:gardenId`

Update garden metadata (name, dimensions, description).

**Body**:

```json
{
  "expected_version": 3,
  "name": "Backyard Garden",
  "length": 32,
  "width": 20,
  "description": "Updated"
}
```

**Response 200**: `GardenDetail`

**Errors**: `401`; `404`; `409` version conflict (includes `current` snapshot);
`422` beds extend outside new bounds

### DELETE `/api/gardens/:gardenId`

**Body**: `{ "expected_version": 3 }`

**Response 204**

**Errors**: `401`; `404`; `409`

## Garden Areas (Beds & Paths)

### POST `/api/gardens/:gardenId/areas`

**Body**:

```json
{
  "expected_version": 3,
  "area_type": "bed",
  "name": "Bed A",
  "origin_x": 2,
  "origin_y": 2,
  "length": 8,
  "width": 4,
  "rotation_degrees": 0,
  "soil_type": "loam",
  "sun_exposure": "full_sun"
}
```

`rotation_degrees` MUST be one of `0`, `90`, `180`, `270`. Omitted on create defaults to `0`.
**US2–US5**: non-zero `rotation_degrees` MUST be rejected with `422` (rotation UI is US6).
`soil_type` optional on beds; omit or null for unset. Invalid enum → `422`.

**Response 201**: `GardenDetail`

**Errors**: `409`; `422` boundary violation, overlap, or invalid rotation

### PUT `/api/gardens/:gardenId/areas/:areaId`

Update area geometry or attributes.

**Body**: partial fields + `expected_version` (e.g. `rotation_degrees`, geometry, soil/sun)

```json
{
  "expected_version": 3,
  "rotation_degrees": 90,
  "soil_type": null
}
```

Sending `"soil_type": null` clears a previously set value.

**Response 200**: `GardenDetail`

**Errors**: `409`; `422` boundary/overlap/placement eviction conflict or invalid rotation

### DELETE `/api/gardens/:gardenId/areas/:areaId`

**Body**: `{ "expected_version": 3, "confirm": true }`

**Response 200**: `GardenDetail` (placements in deleted bed removed)

## Plant Placements

### POST `/api/gardens/:gardenId/placements`

Direct seed into bed (occupies space immediately).

**Body**:

```json
{
  "expected_version": 3,
  "bed_area_id": "uuid",
  "plant_id": "uuid",
  "plant_provenance": "authoritative",
  "position_x": 4,
  "position_y": 4,
  "planted_on": "2026-05-15"
}
```

`plant_provenance`: `authoritative` (canonical) or `provisional`.

**Response 201**:

```json
{
  "garden": "GardenDetail",
  "warnings": [
    { "code": "CLIMATE_DATE", "message": "Sow date is 2 weeks before recommended window for your zone." },
    { "code": "CROP_ROTATION", "message": "Nightshades were planted in this bed 1 year ago. Recommended wait: 3 years.", "conflict_planted_on": "2025-05-15", "rotation_group": "nightshades" }
  ]
}
```

`warnings` entries with code `CROP_ROTATION` are **advisory** — save proceeds when
spacing and incompatibility pass (FR-023).

**Errors**: `409`; `422` validation failure:

```json
{
  "error": "validation_failed",
  "violations": [
    { "code": "SPACING", "message": "Too close to Tomato", "other_placement_id": "uuid" },
    { "code": "INCOMPATIBLE", "message": "Incompatible with Fennel", "other_plant_id": "uuid" }
  ]
}
```

### DELETE `/api/gardens/:gardenId/placements/:placementId`

**Body**: `{ "expected_version": 3 }`

**Response 200**: `GardenDetail`

## Validation Preview

### POST `/api/gardens/:gardenId/validate-placement`

Dry-run validation without persisting (FR-017a; live UI preview per SC-002).

**Body**: same as placement create (without `expected_version`)

**Response 200**:

```json
{
  "valid": true,
  "violations": [],
  "warnings": [
    { "code": "CLIMATE_DATE", "message": "..." },
    { "code": "CROP_ROTATION", "message": "...", "rotation_group": "nightshades" }
  ]
}
```

- `valid`: `true` when `violations[]` is empty (warnings do not affect `valid`)
- `violations[]`: hard blocks — spacing, incompatibility (US3+)
- `warnings[]`: advisory only — `CLIMATE_DATE` (US5+), `CROP_ROTATION` (US6+)

Does not persist; mirrors save response warning shape.

## Shared Warning Codes

| Code | Hard block? | Description |
|------|-------------|-------------|
| `CLIMATE_DATE` | No | Planting date outside recommended window |
| `CROP_ROTATION` | No | Same rotation group/family in bed within lookback window |

## Indoor Starts

### POST `/api/gardens/:gardenId/indoor-starts`

**Body**:

```json
{
  "expected_version": 3,
  "target_bed_area_id": "uuid",
  "plant_id": "uuid",
  "plant_provenance": "authoritative",
  "started_on": "2026-03-01"
}
```

**Response 201**: `GardenDetail` (indoor start in list; no bed placement created)

**Errors**: `409`; `422` invalid bed, missing planting method support

### POST `/api/gardens/:gardenId/indoor-starts/:startId/transplant`

**Body**:

```json
{
  "expected_version": 5,
  "position_x": 6,
  "position_y": 4,
  "planted_on": "2026-05-20"
}
```

**Response 200**: `GardenDetail` with new placement + indoor start marked transplanted

**Errors**: `409`; `422` spacing/incompatibility/bed missing

### PATCH `/api/gardens/:gardenId/indoor-starts/:startId`

Reassign target bed for an active indoor start (e.g., after target bed deleted).

**Body**:

```json
{
  "expected_version": 3,
  "target_bed_area_id": "uuid"
}
```

**Response 200**: `GardenDetail`

**Errors**: `409`; `422` if start not active or bed invalid/not plantable

### DELETE `/api/gardens/:gardenId/indoor-starts/:startId`

Cancel active indoor start.

**Body**: `{ "expected_version": 3 }`

**Response 200**: `GardenDetail`

## Programmatic Module Interface

Downstream features and route handlers MUST use `lib/garden/` modules:

- `getGardenDetail(userId, gardenId)` → `GardenDetail`
- `validatePlacement(garden, candidate)` → `{ valid, violations[], warnings[] }` (FR-017a)
- `validateAreaGeometry(garden, areas, candidate)` → `GeometryResult` (AABB US2–US5; OBB US6)
- `appendPlantingHistory(placement)` — called from `createDirectSeed` / `transplantIndoorStart` (US3/US5)
- `checkCropRotation(bedId, plantId, plantedOn)` → `RotationWarning | null` (US6+)
- `createDirectSeed(...)` / `deletePlacement(...)` / `transplantIndoorStart(...)` /
  `reassignIndoorStart(...)` — transactional with version bump + history append
- `resolvePlantSpacing(plantId, provenance, gardenUnit)` → radius in garden units
- `getRotationMetadata(plantId)` → `{ rotation_group?, botanical_family?, rotation_window_years? }` (catalog)

HTTP routes wrap these modules. Layout UI imports pure validation functions for
client-side preview (same rules, server authoritative on save).

## Side Effects

- Successful placement or indoor start upserts `user_garden_plant_refs` for offline cache
- Any mutation increments `gardens.version`
- Cache manifest (`/api/users/me/cache/manifest`) extended with `garden_ids`
