# Garden Layout API Contracts

**Base path**: `/api`  
**Auth**: Session cookie (`og_session`, SameSite=Lax). `SessionGuard` uses
`@Inject(AuthService)`. `GardenMembershipGuard` uses `@Inject(DATABASE)` and
`params.id` as garden id.  
**Content-Type**: `application/json`  
**Shared types**: `libs/shared-types` (source of truth)

Error shape matches 001/002/004:
`UNAUTHORIZED` | `FORBIDDEN` | `NOT_FOUND` | `VALIDATION_ERROR` | `CONFLICT` | `INTERNAL`.

Non-members receive **404** (no existence leak).

### Layout error messages

Clients MUST surface these `error.message` strings.

| Code | When | Message |
|------|------|---------|
| `NOT_FOUND` | Missing garden or caller is not a member | `Garden not found` |
| `NOT_FOUND` | Bed missing, other garden, or placement references a bed without geometry | `Bed not found` |
| `NOT_FOUND` | Planting missing or not in this garden | `Planting not found` |
| `FORBIDDEN` | Viewer PUT layout | `Viewers cannot update layout` |
| `VALIDATION_ERROR` | Geometry incomplete | `Bed size and position are required` |
| `VALIDATION_ERROR` | length or width < 1 | `Bed length and width must be at least 1 inch` |
| `VALIDATION_ERROR` | orientation not 0/90/180/270 | `Bed rotation must be 0, 90, 180, or 270 degrees` |
| `VALIDATION_ERROR` | only one of layout x/y set | `Placement position is required` |
| `VALIDATION_ERROR` | blocking spacing or fit flags | `Layout has spacing or fit problems` |

Use HTTP **422** for the spacing/fit save gate (still `VALIDATION_ERROR` in the
JSON body) so the client can tell “fix the plan” from “malformed inches.”
Incomplete geometry and bad orientation remain **400**.

004 bed/planting messages are unchanged (`Viewers cannot update beds`, etc.).

---

## Types

Reuse `GardenRole`, `PlantStatus`, `PlantType` from 001/002. Inches are JSON
numbers (integers). Orientation is `0 | 90 | 180 | 270`.

### BedGeometryDto

```json
{
  "originXInches": 0,
  "originYInches": 12,
  "lengthInches": 96,
  "widthInches": 48,
  "orientation": 0
}
```

All five fields required when geometry is present. `orientation` is degrees.

### LayoutBedDto

```json
{
  "id": "uuid",
  "name": "Raised bed 1",
  "geometry": null
}
```

`geometry` is `BedGeometryDto` or `null` (needs size).

### LayoutPlacementDto

```json
{
  "plantingId": "uuid",
  "bedId": "uuid",
  "xInches": 24,
  "yInches": 12
}
```

`xInches` / `yInches` are the plant center in **bed-local** inches.

### LayoutPlantingDto

Identity for the unplaced tray and for labels on the plan. Not a calendar plan.

```json
{
  "id": "uuid",
  "plantId": "uuid",
  "commonName": "Cherry Tomato",
  "species": "Solanum lycopersicum",
  "cultivar": "Cherry",
  "plantType": "vegetable",
  "status": "active",
  "bedId": "uuid-or-null",
  "spacingInches": 24,
  "placement": null
}
```

`spacingInches` is catalog spacing or `null` (unavailable). `placement` is
`LayoutPlacementDto` or `null` (unplaced). When `placement` is set it MUST
match this planting’s `id` and `bedId`.

### LayoutFlagDto

```json
{
  "kind": "spacing",
  "plantingIds": ["uuid-a", "uuid-b"],
  "blocking": true
}
```

`kind`: `"spacing"` | `"fit"` | `"unavailable"`.  
`unavailable` has `blocking: false` and one planting id.  
`fit` has `blocking: true` and one planting id.  
`spacing` has `blocking: true` and two planting ids.

### GardenLayoutDto

```json
{
  "gardenId": "uuid",
  "myRole": "collaborator",
  "beds": [],
  "plantings": [],
  "flags": []
}
```

`beds` is every named bed (including unsized and empty). `plantings` is every
seasonal planting in the garden (placed and unplaced). `flags` is the result of
`evaluateLayout` on this payload (empty after a successful PUT).

### LayoutPutDto

```json
{
  "beds": [
    {
      "id": "uuid",
      "originXInches": 0,
      "originYInches": 0,
      "lengthInches": 96,
      "widthInches": 48,
      "orientation": 90
    }
  ],
  "placements": [
    {
      "plantingId": "uuid",
      "bedId": "uuid",
      "xInches": 24,
      "yInches": 12
    }
  ]
}
```

`beds` lists **only** beds that should have geometry. Named beds not listed
keep their names and have geometry cleared.  
`placements` lists **only** placed plantings. Omitted plantings are unplaced
(`placement` null); their `bedId` on the planting list is unchanged unless
they appear here (then `bedId` becomes this `bedId`).

---

## GET /api/gardens/:id/layout

Return the garden layout for a member.

**Auth**: member (owner, collaborator, viewer)

**Response**: `200` `GardenLayoutDto`

**Errors**: `401`, `404`

The client MAY cache this body for offline read. It MUST NOT treat cache as
authorization to PUT.

---

## PUT /api/gardens/:id/layout

Replace bed geometry and placements in one transaction. Last successful PUT
wins. Refused when `evaluateLayout` would produce any blocking flag.

**Auth**: owner or collaborator

**Body**: `LayoutPutDto`

**Response**: `200` `GardenLayoutDto` (flags empty)

**Errors**: `401`, `404` (garden / bed / planting), `403` (viewer),
`400` validation, `422` spacing/fit (`Layout has spacing or fit problems`)

A 422 MUST NOT write. The previous stored plan remains.

---

## Unchanged (still used by this feature)

- `POST/PATCH/DELETE /api/gardens/:id/beds` — create/rename/delete named beds
  (004). Layout UI uses POST to add a named bed, DELETE after confirm to remove
  the household bed. DELETE also unplaces those plantings.
- `GET /api/gardens/:id/plantings` — list stays the source of plantings; placing
  on the layout updates `bedId` via PUT layout, not via a second planting PATCH.
- `PATCH /api/gardens/:id/plantings/:plantingId` — if `bedId` changes or is
  cleared, layout coords MUST be cleared (list reassignment).
- Calendar and favorites routes MUST NOT be written by this feature.

## Not in this feature

- No `GET /api/gardens/:id/layout/flags` (flags are on GET/PUT body)
- No layout mutation queue endpoint
- No companion-planting or care-reminder routes
