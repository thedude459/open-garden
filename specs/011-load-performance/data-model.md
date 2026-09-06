# Data model: Load Performance

**Feature**: `011-load-performance` | **Date**: 2026-08-23

No new PostgreSQL tables. No new columns. Membership, beds, plantings, layout GET/PUT, catalog admission (010), and IndexedDB layout cache stay as in 002–010.

This feature changes **how list and search payloads are assembled**, and **adds count + illustration fields on existing DTOs**.

## Garden list item

A garden the current user belongs to (owner, collaborator, or viewer).

| Field | Source | Rules |
|-------|--------|--------|
| `id`, `name`, `hardinessZone`, `myRole` | Existing `listForUser` join | Unchanged |
| `bedCount` | Aggregate `garden_beds` for ids on **this page** | Integer ≥ 0; gardens with no beds → `0` |
| `placementCount` | Aggregate placed `garden_plantings` for those ids | Integer ≥ 0; placed = `bed_id`, `layout_x_inches`, `layout_y_inches` all non-null. Unplaced / tray-only rows do **not** count |

**Validation**: Server assembly MUST match stored rows at read time (no guessed defaults on `GET /api/gardens`). Batching MUST use only garden ids from the caller’s membership page.

**Client cache**: Offline IndexedDB may still hold list/detail payloads from before this DTO change. The garden list MUST treat missing `bedCount` / `placementCount` as `0` (or skip rendering counts) so a previously cached list remains readable. Online reload replaces the cache with real counts. Do not fail the list on missing fields.

**List query budget**: Page of gardens + totalCount + **constant** count lookups (one or two aggregates for the whole page). MUST NOT be one COUNT per garden.

`GardenDetailDto` extends `GardenSummaryDto`, so GET garden-by-id also returns the two counts. Fill with the **same** helper for a single-id list (one aggregate pass, not a different code path that loops).

## Garden detail (Overview + Bed View)

Unchanged persisted shape: beds, non-planting areas, plantings with placement, `spacingInches` from the plants join.

| Derived (not stored) | Rule |
|----------------------|------|
| Canopy / footprint radius | `plantingFootprintRadius(spacingInches)` in `libs/garden-layout` (null spacing → existing default 6). Computed in one pass over joined rows. |

**Load query budget**: Membership + `Promise.all` of list-beds, `listAllForLayout` (join plants for spacing), list-areas. MUST NOT resolve spacing or canopy per planting via extra queries.

**Authorization**: Unchanged. Non-members 404. Viewers GET layout; cannot PUT.

## Plant search result

Catalog list item (`PlantSummaryDto`) after 010 admission (`spacingInches` required / non-null).

| Field | Rules |
|-------|--------|
| Existing identity | `commonName`, `species`, `cultivar`, `plantType`, `zoneMin`, `zoneMax`, `spacingInches` |
| `illustrationUrl` | `string \| null`. **Null** until a later feature stores art. Client: URL → `<img src>`; null → existing `.plant-stand-in`. MUST be present on every list item (not omitted) |

**Miss-fill** (name search, zero local hits): provider search (existing abstraction) then **one** multi-row upsert of spaced plants, then one `list`. MUST NOT await upsert per remote row.

Favorites remain out of scope except that `illustrationUrl` may appear on nested plant objects if they share `PlantSummaryDto`; UI need not change.

## State transitions

None. Read-path batching only. Save/draft/offline rules unchanged.

## Isolation

- List counts: only gardens the actor belongs to.  
- Layout snapshot: only that garden’s rows.  
- Catalog search: shared reference data; no household leak via batch upsert (upsert is by variety key on the global `plants` table, same as today).
