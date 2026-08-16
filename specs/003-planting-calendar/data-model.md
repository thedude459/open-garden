# Data Model: Planting Calendar

**Feature**: `003-planting-calendar` | **Date**: 2026-08-16  
**Spec**: [spec.md](./spec.md)

## Entities

### GardenCalendarEntry

One catalog variety on one garden’s calendar. Not an in-ground planting.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK, generated |
| garden_id | UUID | FK → Garden; ON DELETE CASCADE; required |
| plant_id | UUID | FK → Plant; ON DELETE RESTRICT; required |
| created_at | timestamptz | required |

**Constraints**:
- UNIQUE `(garden_id, plant_id)` — at most one row per variety per garden

**Notes**:
- Add is idempotent: inserting an existing pair returns the existing row.
- Delete removes this row only. Catalog plant and favorites are unchanged.
- Hard-delete of the garden removes all entries (cascade).

### Growing guidance (on Plant)

Optional catalog enrichment. Null means unknown (calendar window unavailable).
Existing plant fields (`days_to_maturity`, `zone_min`/`zone_max`, `plant_type`,
`status`) stay as in 001.

| Field | Type | Rules |
|-------|------|-------|
| indoor_frost_anchor | `'last' \| 'first' \| null` | null iff indoor weeks are null |
| indoor_weeks_earliest | smallint \| null | signed weeks; null with latest and anchor |
| indoor_weeks_latest | smallint \| null | >= earliest when both set |
| sow_frost_anchor | `'last' \| 'first' \| null` | same pairing rule |
| sow_weeks_earliest | smallint \| null | |
| sow_weeks_latest | smallint \| null | |
| transplant_frost_anchor | `'last' \| 'first' \| null` | |
| transplant_weeks_earliest | smallint \| null | |
| transplant_weeks_latest | smallint \| null | |

**Signed weeks**: `-8` = 8 weeks before the named frost; `+2` = 2 weeks after.

**Pairing**: For each window, either all three of (anchor, earliest, latest)
are null (unavailable) or all three are set. A single source number stores
equal earliest and latest.

**Harvest**: not a column. Computed from `days_to_maturity` and the start
window (transplant if guidance present, else outdoor sow, else indoor start).
If no start window or `days_to_maturity` is null, harvest is unavailable.

### Computed SeasonalWindow (not persisted)

Produced by `computeWindows(gardenFrost, guidance, daysToMaturity)`.

| Field | Type | Rules |
|-------|------|-------|
| earliest | MonthDay | month 1–12, valid day |
| latest | MonthDay | |
| wrapsYear | boolean | true when the range crosses 31 Dec → 1 Jan |

Indoor, sow, transplant, harvest are each `SeasonalWindow | null`.

### Garden / Membership / User (existing)

Unchanged. Calendar GET requires both last and first frost **pairs** to produce
windows; incomplete frost still allows listing/editing entries. Zone missing:
windows still compute; `zoneMismatch` is null (unknown), not a false mismatch.

`zoneMismatch` is true when garden `hardiness_zone` is set and the plant’s
`zone_min`–`zone_max` does not include it.

## Relationships

```text
Garden 1──* GardenCalendarEntry *──1 Plant
Garden 1──* GardenMembership *──1 User     -- unchanged; authZ for calendar
User 1──* Favorite *──1 Plant              -- picker only; not garden-scoped
Plant.growingGuidance  ──used by──> computeWindows(Garden.siteProfile)
```

## Validation rules

- Unauthenticated: all calendar routes 401.
- Non-member GET/POST/DELETE: **404** `Garden not found`.
- Viewer POST/DELETE: **403** `Viewers cannot update this calendar`.
- POST body `plantId` required UUID; unknown plant → **404** `Plant not found`.
- POST duplicate: success, single entry (no CONFLICT).
- DELETE missing entry: **204** idempotent (already absent).
- Weeks pairing / `earliest <= latest` enforced at catalog upsert (provider
  mapper), not by the gardener. Invalid provider data is stored as unknown
  (all-null window) rather than crashing sync.
- Signed weeks magnitude: reject at upsert if `|weeks| > 52` (treat as unknown).
- Calendar does not validate or write garden frost dates (002 owns that).

## State transitions

### GardenCalendarEntry

- Absent → Present: add (idempotent if present)
- Present → Absent: remove (idempotent if absent)

No status column. Plant `deprecated` does not remove the entry.

### Seasonal windows (derived)

- Garden frost incomplete → all windows null; `windowsAvailable: false`
- Frost complete + guidance present → window computed
- Frost complete + guidance missing → that window null (`unavailable`)

### This-week emphasis (client-derived)

- Not stored. Recomputed at view time from start windows + local today.

## Indexes

- UNIQUE `garden_calendar_entries (garden_id, plant_id)`
- INDEX `garden_calendar_entries (garden_id)` (list by garden)
- INDEX `garden_calendar_entries (plant_id)` (optional; catalog integrity)
