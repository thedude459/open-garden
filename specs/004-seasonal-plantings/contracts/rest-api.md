# Seasonal Plantings API Contracts

**Base path**: `/api`  
**Auth**: Session cookie (`og_session`, SameSite=Lax) required on all planting
and bed routes. The PWA calls relative `/api` (dev proxy to Nest). `SessionGuard`
uses `@Inject(AuthService)`. `GardenMembershipGuard` uses `@Inject(DATABASE)`
and `params.id` as garden id.  
**Content-Type**: `application/json`  
**Shared types**: `libs/shared-types` (source of truth; this file is the human contract)

Error shape and pagination match [001 rest-api](../../001-plant-database/contracts/rest-api.md)
and [002 rest-api](../../002-household-gardens/contracts/rest-api.md):
`UNAUTHORIZED` | `FORBIDDEN` | `NOT_FOUND` | `VALIDATION_ERROR` | `CONFLICT` | `INTERNAL`.

Non-members requesting a garden’s plantings receive **404** (no existence leak).

### Planting error messages

Clients MUST surface these `error.message` strings.

| Code | When | Message |
|------|------|---------|
| `NOT_FOUND` | Missing garden or caller is not a member | `Garden not found` |
| `NOT_FOUND` | `plantId` is not in the catalog | `Plant not found` |
| `NOT_FOUND` | Planting missing or not in this garden | `Planting not found` |
| `NOT_FOUND` | Bed missing or not in this garden | `Bed not found` |
| `VALIDATION_ERROR` | Missing or invalid `plantId` | `Plant is required` |
| `VALIDATION_ERROR` | Invalid or malformed date | `Date must be YYYY-MM-DD` |
| `VALIDATION_ERROR` | Both dates set and harvest < planted | `Harvest date must be on or after planted date` |
| `VALIDATION_ERROR` | Blank or whitespace-only bed name | `Bed name is required` |
| `VALIDATION_ERROR` | Bed name longer than 120 characters | `Bed name must be at most 120 characters` |
| `CONFLICT` | Duplicate bed name in this garden | `That garden already has a bed with that name` |
| `CONFLICT` | Client-supplied planting or bed id belongs to another garden | `That id is already in use` |
| `FORBIDDEN` | Viewer POST/PATCH/DELETE planting | `Viewers cannot update plantings` |
| `FORBIDDEN` | Viewer POST/PATCH/DELETE bed | `Viewers cannot update beds` |

---

## Types

Reuse `PlantType`, `PlantStatus`, `GardenRole`, `PageDto` from 001/002.

Dates are ISO calendar dates `YYYY-MM-DD` or `null`. No time-of-day.

### NamedBedDto

```json
{
  "id": "uuid",
  "name": "Raised bed 1",
  "createdAt": "2026-08-16T16:00:00.000Z",
  "updatedAt": "2026-08-16T16:00:00.000Z"
}
```

### PlantingDto

```json
{
  "id": "uuid",
  "plantId": "uuid",
  "commonName": "Cherry Tomato",
  "species": "Solanum lycopersicum",
  "cultivar": "Cherry",
  "plantType": "vegetable",
  "status": "active",
  "plantedOn": "2026-05-12",
  "harvestedOn": null,
  "bedId": "uuid-or-null",
  "createdAt": "2026-08-16T16:00:00.000Z",
  "updatedAt": "2026-08-16T16:00:00.000Z"
}
```

`plantedOn` / `harvestedOn` may be `null` (display as not set). `status` of
`deprecated` is the unavailable-variety indicator; the row remains.

The API MUST NOT send grouped structure, `pending`, or Unassigned — the client
builds groups with `groupPlantings`.

### PlantingListDto

```json
{
  "gardenId": "uuid",
  "myRole": "collaborator",
  "beds": [],
  "plantings": [],
  "page": 1,
  "pageSize": 200,
  "total": 3
}
```

`beds` is the full named-bed set for the garden (including empty beds), ordered
by `name` ascending (stable). `plantings` is newest-first (`createdAt` DESC).

---

## GET /api/gardens/:id/plantings

List plantings and named beds for a garden the caller belongs to.

**Auth**: member (owner, collaborator, viewer)

**Query**: `page` (default 1), `pageSize` (default 200, max 500)

**Response**: `PlantingListDto`

Bed filter is **not** a query param; the client filters groups without a new
request. For the grouped UI, the client MUST call this endpoint with
`pageSize=200` (the default) and, if `total` is greater than `plantings.length`,
request subsequent pages and concatenate before `groupPlantings`.

**Errors**: `401`, `404`

---

## POST /api/gardens/:id/plantings

Add a planting. Duplicate variety in the same garden creates a **new** row
unless the client retries the same `id`.

**Auth**: owner or collaborator

**Body**:

```json
{
  "id": "uuid",
  "plantId": "uuid",
  "plantedOn": "2026-05-12",
  "harvestedOn": null,
  "bedId": null,
  "clientMutationId": "string"
}
```

`id` is optional; when present it is the planting UUID (offline idempotency).
`plantedOn`, `harvestedOn`, `bedId`, `clientMutationId` are optional.
Omitted dates are stored as unset (`null`), never as today.

**Response**: `201` on first insert, `200` if `id` already exists in this
garden — body is `PlantingListDto` (default first page) so the client can
refresh groups in one round trip.

**Errors**: `401`, `404` (garden, plant, or bed), `403` (viewer),
`VALIDATION_ERROR`, `CONFLICT`

---

## PATCH /api/gardens/:id/plantings/:plantingId

Update planted date, harvest date, and/or bed assignment. Last successful
write wins. JSON `null` on a date or `bedId` **clears** that field. Omitted
fields stay unchanged.

**Auth**: owner or collaborator

**Body**:

```json
{
  "plantedOn": "2026-06-01",
  "harvestedOn": null,
  "bedId": "uuid-or-null",
  "clientMutationId": "string"
}
```

**Response**: `200` `PlantingDto`

**Errors**: `401`, `404` (garden / planting / bed), `403` (viewer),
`VALIDATION_ERROR`

A 404 `Planting not found` MUST NOT create a planting.

---

## DELETE /api/gardens/:id/plantings/:plantingId

Permanently delete a planting. Confirm is a client UX step; this endpoint is
the confirmed action. Catalog plant, favorites, and calendar plans are
unchanged.

**Auth**: owner or collaborator

**Response**: `204` No Content when the row existed

**Errors**: `401`, `404` (garden, or planting already absent / other garden),
`403` (viewer)

Unlike calendar DELETE, a missing planting is **404**, not 204, so offline
sync can fail visibly without resurrecting the row.

---

## POST /api/gardens/:id/beds

Create a named bed.

**Auth**: owner or collaborator

**Body**:

```json
{ "id": "uuid", "name": "Raised bed 1" }
```

`id` optional (same idempotency rule as plantings). `name` required.

**Response**: `201` on first insert, `200` if `id` already exists in this
garden — body is `NamedBedDto`.

**Errors**: `401`, `404`, `403`, `VALIDATION_ERROR`, `CONFLICT`

---

## PATCH /api/gardens/:id/beds/:bedId

Rename a bed. Assigned plantings stay assigned and show the new name.

**Auth**: owner or collaborator

**Body**: `{ "name": "Patio pots" }`

**Response**: `200` `NamedBedDto`

**Errors**: `401`, `404` (garden / bed), `403`, `VALIDATION_ERROR`, `CONFLICT`

---

## DELETE /api/gardens/:id/beds/:bedId

Delete a named bed. Plantings in that bed remain in the garden with
`bedId: null`.

**Auth**: owner or collaborator

**Response**: `204` No Content

**Errors**: `401`, `404` (garden / bed), `403` (viewer)

---

## Unchanged

- `GET /api/plants`, `GET /api/favorites` — used as add-planting pickers
- Garden create/patch/membership routes from 002
- Calendar routes from 003 — MUST NOT be written by this feature
- No `/api/plantings` user-global inventory
