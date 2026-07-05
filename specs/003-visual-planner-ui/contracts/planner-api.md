# Planner API Contract

**Feature**: 003-visual-planner-ui | **Extends**: [garden-api.md](../../002-garden-layout/contracts/garden-api.md)

## Overview

Extends Feature 002 garden API with zone types, illustrated responses, structure
placements, templates, and thumbnails. All existing placement validation endpoints
unchanged; responses gain illustration URLs and visual metadata.

## Extended Types

### `GardenSummary` (list)

```json
{
  "id": "uuid",
  "name": "Backyard",
  "zone_type": "vegetable_garden",
  "length": 20,
  "width": 10,
  "unit": "feet",
  "version": 3,
  "thumbnail_url": "/planner/thumbnails/{gardenId}.webp",
  "visual_version": 1,
  "updated_at": "2026-07-05T12:00:00Z",
  "bed_count": 4,
  "placement_count": 12
}
```

### `GardenDetail` (extends 002)

Additional top-level fields:

```json
{
  "zone_type": "orchard",
  "visual_version": 1,
  "thumbnail_url": "/planner/thumbnails/{gardenId}.webp",
  "structures": [ "GardenStructure" ],
  "placements": [
    {
      "id": "uuid",
      "illustration_url": "/planner/plants/tomato.svg",
      "z_index": 2,
      "locked": false,
      "rootstock_id": "uuid-or-null"
    }
  ]
}
```

Each placement and structure includes resolved `illustration_url` (never null —
category fallback applied server-side).

### `GardenStructure`

```json
{
  "id": "uuid",
  "structure_type": {
    "slug": "greenhouse",
    "name": "Greenhouse",
    "category": "protection",
    "illustration_url": "/planner/structures/greenhouse.svg",
    "environment_tag": "greenhouse"
  },
  "origin_x": 2,
  "origin_y": 2,
  "length": 8,
  "width": 12,
  "rotation_degrees": 0,
  "z_index": 0,
  "locked": false
}
```

## Endpoints

### POST `/api/gardens` (extend)

**Body** (additional fields):

```json
{
  "name": "Balcony",
  "length": 12,
  "width": 8,
  "unit": "feet",
  "zone_type": "container_patio",
  "template_id": "uuid-optional"
}
```

When `template_id` provided, instantiate from `plan_templates.layout_snapshot`.

**Response 201**: `GardenDetail` with structures/placements from template.

### GET `/api/planner/templates`

**Response 200**:

```json
{
  "templates": [
    {
      "id": "uuid",
      "slug": "beginner-vegetable",
      "name": "Beginner Vegetable Garden",
      "description": "Four raised beds with reliable crops",
      "zone_type": "vegetable_garden",
      "preview_image_url": "/planner/templates/beginner-vegetable.webp"
    }
  ]
}
```

### GET `/api/planner/structures`

Query: `zone_type=orchard` (optional filter)

**Response 200**: `{ "structure_types": [...] }` with illustration URLs.

### GET `/api/planner/plants/:plantId/illustration`

**Response 200**:

```json
{
  "plant_id": "uuid",
  "illustration_url": "/planner/plants/tomato.svg",
  "fallback_category": "vegetable"
}
```

### POST `/api/gardens/:gardenId/structures`

**Body**:

```json
{
  "expected_version": 3,
  "structure_type_slug": "raised_bed",
  "origin_x": 0,
  "origin_y": 0,
  "length": 4,
  "width": 8,
  "rotation_degrees": 0,
  "z_index": 0
}
```

**Response 201**: `GardenDetail`

### PUT `/api/gardens/:gardenId/structures/:structureId`

Update position, size, z_index, locked, rotation.

**Response 200**: `GardenDetail`

### DELETE `/api/gardens/:gardenId/structures/:structureId`

**Body**: `{ "expected_version": 3 }`

**Response 200**: `GardenDetail`

### PATCH `/api/gardens/:gardenId/layers`

Batch update z_index and locked for placements + structures.

**Body**:

```json
{
  "expected_version": 3,
  "items": [
    { "type": "placement", "id": "uuid", "z_index": 5, "locked": true },
    { "type": "structure", "id": "uuid", "z_index": 1 }
  ]
}
```

### POST `/api/gardens/:gardenId/thumbnail`

**Body**:

```json
{
  "expected_version": 3,
  "image_data": "data:image/webp;base64,..."
}
```

**Response 200**: `{ "thumbnail_url": "/planner/thumbnails/{gardenId}.webp" }`

### PATCH `/api/gardens/:gardenId` (extend)

**Body** may include `zone_type` change — triggers incompatible placement cleanup
after user confirmation (422 with `zone_change_conflicts` if not confirmed).

## Validation Errors (extend 422)

```json
{
  "error": "tree_spacing_violation",
  "violations": [
    {
      "code": "TREE_SPACING",
      "message": "Too close to Apple (Standard)",
      "other_placement_id": "uuid"
    }
  ]
}
```

## Auto-Upgrade Behavior

- `GET /api/gardens/:id` on `visual_version = 0` returns full `GardenDetail` with
  resolved illustration URLs; no separate migration endpoint
- First mutating request after visual editor ships may bump `visual_version` to 1

## Mobile API Notes

No separate API for mobile; client disables drag mutations based on viewport.
Light edits use existing placement PATCH and DELETE routes from 002.
