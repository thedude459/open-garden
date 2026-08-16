# Planting Calendar API Contracts

**Base path**: `/api`  
**Auth**: Session cookie (`og_session`, SameSite=Lax) required on all calendar
routes. The PWA calls relative `/api` (dev proxy to Nest). `SessionGuard` uses
`@Inject(AuthService)`. `GardenMembershipGuard` uses `@Inject(DATABASE)` and
`params.id` as garden id.  
**Content-Type**: `application/json`  
**Shared types**: `libs/shared-types` (source of truth; this file is the human contract)

Error shape and pagination match [001 rest-api](../../001-plant-database/contracts/rest-api.md)
and [002 rest-api](../../002-household-gardens/contracts/rest-api.md):
`UNAUTHORIZED` | `FORBIDDEN` | `NOT_FOUND` | `VALIDATION_ERROR` | `CONFLICT` | `INTERNAL`.

Non-members requesting a garden calendar receive **404** (no existence leak).

### Calendar error messages

Clients MUST surface these `error.message` strings.

| Code | When | Message |
|------|------|---------|
| `NOT_FOUND` | Missing garden or caller is not a member | `Garden not found` |
| `NOT_FOUND` | `plantId` is not in the catalog | `Plant not found` |
| `VALIDATION_ERROR` | Missing or invalid `plantId` | `Plant is required` |
| `FORBIDDEN` | Viewer POST or DELETE | `Viewers cannot update this calendar` |

---

## Types

Reuse `MonthDay`, `PlantType`, `PlantStatus`, `GardenRole`, `PageDto` from 001/002.

### FrostAnchor

`last` | `first`

### SeasonalWindowDto

```json
{
  "earliest": { "month": 3, "day": 1 },
  "latest": { "month": 3, "day": 15 },
  "wrapsYear": false
}
```

`null` on a parent field means that window is unavailable or not applicable.

### GrowingGuidanceDto

Catalog facts (also appear on plant detail). Any window may be `null`.

```json
{
  "indoorStart": {
    "frostAnchor": "last",
    "weeksEarliest": -8,
    "weeksLatest": -6
  },
  "outdoorSow": null,
  "transplant": {
    "frostAnchor": "last",
    "weeksEarliest": 1,
    "weeksLatest": 2
  }
}
```

### CalendarEntryDto

```json
{
  "plantId": "uuid",
  "commonName": "Cherry Tomato",
  "species": "Solanum lycopersicum",
  "cultivar": "Cherry",
  "plantType": "vegetable",
  "status": "active",
  "zoneMin": 4,
  "zoneMax": 10,
  "zoneMismatch": false,
  "windows": {
    "indoorStart": { "earliest": { "month": 2, "day": 18 }, "latest": { "month": 3, "day": 4 }, "wrapsYear": false },
    "outdoorSow": null,
    "transplant": { "earliest": { "month": 4, "day": 22 }, "latest": { "month": 4, "day": 29 }, "wrapsYear": false },
    "harvest": { "earliest": { "month": 6, "day": 26 }, "latest": { "month": 7, "day": 3 }, "wrapsYear": false }
  }
}
```

`zoneMismatch` is `true` when the garden zone is set and the plant range does
not include it; `null` when the garden has no zone; `false` when the zone is
in range.

The API MUST NOT send an `emphasized` flag (client computes this week).

### CalendarDto

```json
{
  "gardenId": "uuid",
  "myRole": "collaborator",
  "windowsAvailable": true,
  "hardinessZone": 7,
  "lastFrost": { "month": 4, "day": 15 },
  "firstFrost": { "month": 10, "day": 20 },
  "entries": [],
  "page": 1,
  "pageSize": 100,
  "total": 3
}
```

`windowsAvailable` is true only when both last and first frost pairs are set.
When false, every entry’s `windows.*` are `null` and the client shows the
missing-frost explanation; `entries` may still be non-empty.

`hardinessZone`, `lastFrost`, `firstFrost` may be `null`.

---

## GET /api/gardens/:id/calendar

List calendar entries for a garden the caller belongs to, with computed
windows when frost dates are complete.

**Auth**: member (owner, collaborator, viewer)

**Query**: `page` (default 1), `pageSize` (default 100, max 200)

**Response**: `CalendarDto`

Server order: `commonName` ascending (stable). Client may re-sort (emphasized
first, then next start window).

Type filter is **not** a query param; the client filters `entries` by
`plantType` without a new request.

**Errors**: `401`, `404`

---

## POST /api/gardens/:id/calendar

Add a catalog plant to the garden calendar. Idempotent if already present.

**Auth**: owner or collaborator

**Body**:

```json
{ "plantId": "uuid" }
```

**Response**: `201` on first insert, `200` if already present — body is the
updated `CalendarDto` (same shape as GET, default first page).

**Errors**: `401`, `404` (garden or plant), `403` (viewer), `VALIDATION_ERROR`

---

## DELETE /api/gardens/:id/calendar/:plantId

Remove a plant from the garden calendar. Idempotent if already absent.

**Auth**: owner or collaborator

**Response**: `204` No Content

**Errors**: `401`, `404` (garden / non-member only — missing entry is still
204), `403` (viewer)

---

## Plant detail (001 extension)

`GET /api/plants/:id` `PlantDetailDto` MUST include `growingGuidance:
GrowingGuidanceDto` (required object; indoor/sow/transplant windows may each
be `null`). Existing fields unchanged. The plant detail page MAY show those
fields or keep displaying only 001 attributes; calendar MUST NOT require a
live provider call; guidance comes from the local catalog row.

---

## Unchanged

- `GET /api/plants`, `GET /api/favorites` — used as add-plant pickers
- Garden create/patch/membership routes from 002
- No calendar routes under `/api/calendar` (not user-global)
