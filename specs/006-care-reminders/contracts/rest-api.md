# Care Reminders API Contracts

**Base path**: `/api`  
**Auth**: Session cookie (`og_session`, SameSite=Lax). `SessionGuard` uses
`@Inject(AuthService)`. `GardenMembershipGuard` uses `@Inject(DATABASE)` and
`params.id` as garden id.  
**Content-Type**: `application/json`  
**Shared types**: `libs/shared-types` (source of truth)

Error shape matches 001/002/004:
`UNAUTHORIZED` | `FORBIDDEN` | `NOT_FOUND` | `VALIDATION_ERROR` | `CONFLICT` | `INTERNAL`.

Non-members receive **404** (no existence leak).

### Reminder error messages

Clients MUST surface these `error.message` strings.

| Code | When | Message |
|------|------|---------|
| `NOT_FOUND` | Missing garden or caller is not a member | `Garden not found` |
| `NOT_FOUND` | Planting missing or not in this garden | `Planting not found` |
| `FORBIDDEN` | Viewer POST complete or dismiss | `Viewers cannot update reminders` |
| `VALIDATION_ERROR` | Missing or malformed `asOf` / `dueOn` | `Date must be YYYY-MM-DD` |
| `VALIDATION_ERROR` | Missing or invalid `kind` | `Care kind is required` |

---

## Types

Reuse `GardenRole`, `PlantStatus`, `PlantType` from 001/002. Dates are ISO
calendar dates `YYYY-MM-DD`.

### CareKind / ReminderUrgency / CareAction

```ts
type CareKind = 'water' | 'fertilize' | 'harvest';
type ReminderUrgency = 'overdue' | 'dueToday' | 'upcoming';
type CareAction = 'completed' | 'dismissed';
```

### ReminderItemDto

```json
{
  "plantingId": "uuid",
  "kind": "harvest",
  "dueOn": "2026-07-16",
  "urgency": "upcoming",
  "intervalDays": null,
  "plantId": "uuid",
  "commonName": "Cherry Tomato",
  "species": "Solanum lycopersicum",
  "cultivar": "Cherry",
  "plantType": "vegetable",
  "status": "active"
}
```

`intervalDays` is the catalog interval for water/fertilize, or `null` for
harvest. `status` of `deprecated` is the unavailable-variety indicator; the
item remains complete/dismissable.

### ReminderListDto

```json
{
  "gardenId": "uuid",
  "myRole": "collaborator",
  "asOf": "2026-08-17",
  "items": []
}
```

`items` is already sorted: overdue (oldest `dueOn` first), then due today, then
upcoming (soonest `dueOn` first). Same `dueOn`: `plantingId` then kind
`harvest`, `water`, `fertilize`. The API MUST NOT send `pending` — the client
overlays the queue.

### ReminderMutationDto

```json
{
  "plantingId": "uuid",
  "kind": "water",
  "dueOn": "2026-08-17"
}
```

---

## GET /api/gardens/:id/reminders

List derived open reminders for a garden the caller belongs to.

**Auth**: member (owner, collaborator, viewer)

**Query**: `asOf` (required, `YYYY-MM-DD`)

**Response**: `ReminderListDto`

**Errors**: `401`, `404`, `400` (bad `asOf`)

Qualitative `waterNeeds` without `waterIntervalDays` MUST NOT produce a water
item. Missing fertilize interval MUST NOT produce a fertilize item. Calendar
plans and layout placements MUST NOT appear. Two plantings of the same variety
MUST yield two harvest items when both are dated.

---

## POST /api/gardens/:id/reminders/complete

Mark the occurrence completed (care performed). Last-write-wins if an event
already exists for the same `(plantingId, kind, dueOn)`.

The server **accepts** the posted `(plantingId, kind, dueOn)` and returns **204**
even when that `dueOn` is not the currently derived open occurrence. Derivation
on the next GET MUST NOT recreate an item the household already cleared: for
harvest, **any** prior complete or dismiss for that planting hides harvest; for
repeating kinds, the cursor is the event with the greatest `occurrence_on`.

**Auth**: owner or collaborator

**Body**: `ReminderMutationDto`

**Response**: `204`

MUST NOT update the planting’s `harvestedOn` or `plantedOn`. MUST NOT delete
the planting.

**Errors**: `401`, `403`, `404`, `400`

---

## POST /api/gardens/:id/reminders/dismiss

Skip this occurrence. Same persistence as complete with `action = dismissed`.
Harvest dismiss hides harvest for that planting (one-shot: **any** harvest event
for that planting). Repeating kinds advance from the posted `dueOn` by
`intervalDays` using the greatest `occurrence_on` cursor on GET.

The server **accepts** the posted `(plantingId, kind, dueOn)` and returns **204**
even when that `dueOn` is not the currently derived open occurrence (same
derivation rules as complete above).

**Auth**: owner or collaborator

**Body**: `ReminderMutationDto`

**Response**: `204`

**Errors**: `401`, `403`, `404`, `400`

---

## Out of scope for this API

Layout PUT, planting PATCH, calendar add/remove, favorites, push
notifications. Reminder routes MUST NOT accept those bodies.
