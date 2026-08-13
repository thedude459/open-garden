# Plant Database API Contracts

**Base path**: `/api`  
**Auth**: Session cookie required unless noted  
**Content-Type**: `application/json`  
**Shared types**: `libs/shared-types` (source of truth; this file is the human contract)

## Common

### Error shape

```json
{
  "error": {
    "code": "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "INTERNAL",
    "message": "Human-readable safe message"
  }
}
```

### Pagination query

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| page | int | 1 | 1-based |
| pageSize | int | 20 | max 100 |

### PlantType

`vegetable` | `herb` | `flower` | `fruit` | `shrub` | `tree`

### PlantSummary

```json
{
  "id": "uuid",
  "commonName": "Cherry Tomato",
  "species": "Solanum lycopersicum",
  "cultivar": "Cherry",
  "plantType": "vegetable",
  "zoneMin": 4,
  "zoneMax": 10
}
```

### PlantDetail

Extends summary:

```json
{
  "id": "uuid",
  "commonName": "Cherry Tomato",
  "species": "Solanum lycopersicum",
  "cultivar": "Cherry",
  "plantType": "vegetable",
  "zoneMin": 4,
  "zoneMax": 10,
  "sunRequirements": "Full sun",
  "waterNeeds": "Moderate",
  "daysToMaturity": 65,
  "spacingInches": 24,
  "status": "active",
  "isFavorite": false
}
```

Nullable attribute fields may be `null` (UI: Unavailable).

---

## GET /api/plants

List/browse/search local catalog. May trigger miss-fill only when `q` is
non-empty and local result count is 0.

**Auth**: required

### Query

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| q | string | no | Name search across commonName, species, cultivar |
| zone | int | no | 1–13; include plants where zoneMin ≤ zone ≤ zoneMax |
| plantType | PlantType | no | Exact type |
| page | int | no | |
| pageSize | int | no | |

### Response 200

```json
{
  "items": [ /* PlantSummary[] */ ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 142
}
```

### Errors

- `401` unauthenticated
- `400` validation (bad zone, pageSize, plantType)

---

## GET /api/plants/{id}

**Auth**: required

### Response 200

`PlantDetail` (includes `isFavorite` for current user)

### Errors

- `401`
- `404` unknown id

---

## GET /api/favorites

**Auth**: required — returns only current user's favorites

### Query

Pagination params only.

### Response 200

```json
{
  "items": [
    {
      "favoriteId": "uuid",
      "plant": { /* PlantSummary + status */ },
      "createdAt": "2026-08-01T12:00:00.000Z",
      "unavailable": false
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 3
}
```

`unavailable: true` when plant is missing or `deprecated`.

---

## PUT /api/favorites/{plantId}

Idempotent add favorite for current user.

**Auth**: required

### Headers (optional)

- `Idempotency-Key` / body `clientMutationId` for offline sync

### Body (optional)

```json
{ "clientMutationId": "string" }
```

### Response 200 / 201

```json
{
  "favoriteId": "uuid",
  "plantId": "uuid",
  "createdAt": "2026-08-01T12:00:00.000Z"
}
```

### Errors

- `401`
- `404` plant not found

---

## DELETE /api/favorites/{plantId}

Idempotent remove. **Response 204** even if favorite did not exist.

**Auth**: required

### Errors

- `401`

---

## POST /api/admin/plants/sync

Operator/scheduled baseline sync.

**Auth**: required + `admin` role

### Body (optional)

```json
{
  "provider": "perenual",
  "limit": 500
}
```

### Response 202

```json
{
  "syncRunId": "uuid",
  "status": "running"
}
```

### Errors

- `401` / `403`
- `400` validation

---

## PlantDataProvider port (internal library contract)

Not HTTP — `libs/plant-provider` public interface:

```ts
interface PlantDataProvider {
  readonly id: string;
  searchByName(query: string, options?: { limit?: number }): Promise<ProviderPlant[]>;
  listPage(options?: { cursor?: string; limit?: number }): Promise<{
    items: ProviderPlant[];
    nextCursor?: string;
  }>;
}

interface ProviderPlant {
  externalId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  zoneMin: number | null;
  zoneMax: number | null;
  sunRequirements: string | null;
  waterNeeds: string | null;
  daysToMaturity: number | null;
  spacingInches: number | null;
}
```

Mapping to `Plant` + `variety_key` happens in catalog sync service — never in
Angular or REST controllers calling vendor SDKs directly.
