# Data Model: Care Reminders

**Feature**: `006-care-reminders` | **Date**: 2026-08-17  
**Spec**: [spec.md](./spec.md)

Reminders are **derived** from Seasonal Plantings plus catalog intervals plus
care events. There is no stored “due list” document.

## Entities

### Plant (extended `plants`)

Existing catalog variety, plus optional numeric care intervals.

| Field | Type | Rules |
|-------|------|-------|
| (all existing columns) | | unchanged, including `water_needs` text |
| water_interval_days | int \| null | > 0 when set; null = omit watering reminders |
| fertilize_interval_days | int \| null | > 0 when set; null = omit fertilizing reminders |

**Notes**:
- `water_needs` remains qualitative and MUST NOT be parsed into an interval.
- `days_to_maturity` (existing) is the harvest offset when planted date is set.
- Fixture **Interval Herb** sets both interval columns; other fixtures leave
  them null.

### Planting (existing `garden_plantings`)

Unchanged. Source of `planted_on`, `harvested_on`, variety identity, garden.
Completing a reminder MUST NOT update these columns.

### CareEvent (`garden_care_events`)

Garden-shared complete or dismiss of one occurrence.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK |
| planting_id | UUID | FK `garden_plantings` ON DELETE CASCADE |
| kind | text | `'water'` \| `'fertilize'` \| `'harvest'` |
| occurrence_on | date | the occurrence’s due date (`YYYY-MM-DD`) |
| action | text | `'completed'` \| `'dismissed'` |
| created_at / updated_at | timestamptz | bump `updated_at` on last-write-wins |

**Constraints**:
- UNIQUE `(planting_id, kind, occurrence_on)`.
- Kind and action MUST be the enums above.
- A planting in garden A cannot receive events from a request for garden B
  (service checks garden membership + planting.garden_id).

**Notes**:
- Harvest is one-shot: any event for `(planting, harvest)` hides harvest on
  GET, regardless of `occurrence_on`.
- Repeating kinds: the event with the greatest `occurrence_on` is the cursor
  for the next due date.

### Reminder item (derived, not a table)

Produced for GET (and for client overlay of the queue):

| Field | Meaning |
|-------|---------|
| plantingId | seasonal planting id |
| kind | water / fertilize / harvest |
| dueOn | ISO date of this open occurrence |
| urgency | `'overdue'` \| `'dueToday'` \| `'upcoming'` vs `asOf` |
| intervalDays | repeating interval, or null for harvest |
| identity | variety names + `status` (deprecated still listed) |

### Garden / Membership (existing)

Unchanged. AuthZ is garden membership (ADR 0004).

## Relationships

```text
Garden 1──* Planting *──1 Plant
Planting 1──* CareEvent     -- CASCADE on planting delete
Plant.water_interval_days / fertilize_interval_days / days_to_maturity
        used at derive time (not copied onto events)
```

Calendar plans, favorites, and layout placements are not related.

## Validation rules

- Unauthenticated reminder routes: **401**.
- Non-member GET/POST: **404** `Garden not found`.
- Viewer POST complete/dismiss: **403** `Viewers cannot update reminders`.
- Viewer GET: **200**.
- Missing/malformed `asOf` or `dueOn`: **400** `Date must be YYYY-MM-DD`.
- `kind` not water/fertilize/harvest: **400** `Care kind is required`.
- Planting missing or other garden: **404** `Planting not found`.
- Last successful complete/dismiss for the same occurrence key wins; no merge
  editor.
- POST complete/dismiss **accepts** the posted `(plantingId, kind, dueOn)` and
  returns **204** even when that `dueOn` is not the currently derived open
  occurrence. GET derivation MUST NOT recreate cleared items (harvest: any event
  for that planting; repeating: greatest `occurrence_on` cursor).
- Completing harvest MUST NOT write `harvested_on`.

## State transitions

### Harvest item

- Absent → Listed: planting has `plantedOn` + `daysToMaturity`, no
  `harvestedOn`, no harvest event
- Listed → Hidden: harvest complete or dismiss (event), or planting list sets
  `harvestedOn`, or planting deleted
- Completing does **not** set `harvestedOn`

### Repeating item (water / fertilize)

- Absent → Open: planted date + positive interval; no stack of missed weeks
- Open → Open (next): complete or dismiss current `dueOn`; next is
  `dueOn + interval` (may still be overdue)
- Open → Absent: planting deleted, or interval later null (omit)

### Urgency (vs `asOf`)

- `dueOn < asOf` → overdue
- `dueOn = asOf` → due today
- `dueOn > asOf` → upcoming

## Indexes

- UNIQUE `(planting_id, kind, occurrence_on)` on `garden_care_events`
- Index `(planting_id)` already implied by FK; sufficient for GET derive
