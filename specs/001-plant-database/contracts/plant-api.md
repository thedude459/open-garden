# Contract: Plant Catalog API

**Version**: 1.0 | **Base path**: `/api/plants`

All endpoints require authenticated session unless noted. Responses are JSON.

## GET `/api/plants/search`

Search and browse the full server-side catalog (online only).

**Query parameters**:

| Param | Type | Description |
|-------|------|-------------|
| q | string | Common or botanical name search |
| category | enum | Plant category filter |
| sun | enum | `full`, `partial`, `shade` |
| spacing_min | number | Minimum plant spacing (cm) |
| climate_filter | boolean | Apply hard-exclude climate filter (requires user location) |

**Response 200**:

```json
{
  "results": [
    {
      "id": "uuid",
      "common_name": "Tomato",
      "botanical_name": "Solanum lycopersicum",
      "variety": "Cherokee Purple",
      "plant_category": "vegetable",
      "days_to_maturity": 80,
      "provenance": "authoritative",
      "field_gaps": []
    }
  ],
  "total": 42,
  "climate_filter_active": true
}
```

Includes user's provisional plants in results for authenticated user.

**Errors**: `401` unauthenticated; `422` climate_filter=true but no user location

## GET `/api/plants/:id`

Full plant detail with merged reference data.

**Response 200**: `PlantDetail` (see [data-model.md](../data-model.md))

**Side effect**: Upserts `user_recently_viewed` for authenticated user.

**Errors**: `401`; `404` not found

## GET `/api/plants/:id/relationships`

Queryable companion/incompatible links (FR-015).

**Response 200**:

```json
{
  "plant_id": "uuid",
  "companions": [{ "id": "uuid", "common_name": "Basil", "relationship_type": "companion" }],
  "incompatibles": [{ "id": "uuid", "common_name": "Fennel", "relationship_type": "incompatible" }]
}
```

## GET `/api/plants/:id/rootstocks`

Curated rootstock options for tree records (FR-005).

**Response 200**:

```json
{
  "plant_id": "uuid",
  "rootstocks": [
    {
      "id": "uuid",
      "name": "M.9",
      "vigor": "dwarf",
      "mature_height_cm": 250,
      "mature_spread_cm": 200,
      "spacing_cm": 300
    }
  ]
}
```

## PlantDetail schema (shared)

```json
{
  "id": "uuid",
  "provenance": "authoritative",
  "botanical_name": "string",
  "common_name": "string",
  "variety": "string|null",
  "plant_category": "vegetable",
  "days_to_maturity": 80,
  "seed_start_window": { "start_week": 8, "end_week": 12 },
  "transplant_rules": { "weeks_before_last_frost": 2 },
  "direct_seed_rules": { "weeks_after_last_frost": 0 },
  "spacing_cm": { "row": 90, "plant": 45 },
  "sun_exposure": "full",
  "watering_needs": { "frequency": "moderate" },
  "fertilizer_needs": "compost at planting",
  "fertilizer_data_gap": false,
  "pest_disease_notes": ["early blight"],
  "harvest_window": { "start_week": 30, "end_week": 40 },
  "hardiness_min_zone": 5,
  "hardiness_max_zone": 9,
  "companions": [{ "id": "uuid", "common_name": "Basil" }],
  "incompatibles": [{ "id": "uuid", "common_name": "Fennel" }],
  "rootstocks": [],
  "field_gaps": [],
  "location_context": {
    "recommended_seed_start": "2026-03-01",
    "recommended_transplant": "2026-05-15"
  }
}
```

`location_context` populated when user has saved location (US3).

## Programmatic Query Interface (FR-015)

Downstream features (layout validation, task scheduling) MUST consume plant data
via the shared server module `lib/catalog/query.ts` rather than UI components.
The module exposes:

- `getPlantById(id)` → `PlantDetail`
- `getRelationships(id)` → `{ companions, incompatibles }` with plant IDs
- `getRootstocks(id)` → `RootstockOption[]`
- `searchPlants(params)` → paginated results

HTTP routes (`/api/plants/*`) wrap this module for client and external access.
