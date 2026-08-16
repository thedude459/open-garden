# Research: Seasonal Plantings

**Feature**: `004-seasonal-plantings` | **Date**: 2026-08-16

## 1. Domain library vs app-only folders

**Decision**: New Nx lib `libs/seasonal-plantings` for date-pair validation,
bed-name normalize/uniqueness rules, grouped-list assembly, and planting/bed
CRUD. Nest controllers in `apps/api/src/gardens/` stay thin. Angular imports
only the pure helpers (`assertDatePair`, `groupPlantings`, `normalizeBedName`,
types) — not Nest, Drizzle schema, or repositories. `PlantingService` in the
same lib receives catalog-data **repository classes** as constructor deps
(mirrors `GardenService` / `CalendarService`).

**Rationale**: Constitution library-first. SC-002 date rules and SC-003 grouping
must be unit-tested without HTTP. Grouping must run in the browser on a cached
payload (empty beds, Unassigned only when needed, newest-recorded-first, bed filter).

**Alternatives considered**:
- **App-only services**: Violates Principle I; duplicates grouping on client
  and would skip domain tests for FR-015.
- **Fold into `libs/gardens`**: Mixes membership/site profile with in-ground
  records; gardens would take a plant-catalog dependency it does not have.
- **Fold into `libs/planting-calendar`**: Spec forbids conflating plans and
  plantings; calendar add/remove is online-only and unique-per-variety.

## 2. Persistence home

**Decision**: Add `garden_beds` and `garden_plantings` in
`libs/plant-catalog-data`. Migration `0004_seasonal_plantings.sql`. Do not
create `libs/seasonal-plantings-data`. Garden delete `ON DELETE CASCADE` both
tables. Plant FK `ON DELETE RESTRICT` (catalog rows are not hard-deleted in
001). Bed FK on plantings is `ON DELETE SET NULL` (delete-bed keeps plantings,
unassigned).

**Rationale**: One migration pipeline, one DB client. Matches 002/003 research:
later FKs to gardens cascade.

**Alternatives considered**:
- **Dedicated data lib**: Extra Nx project for two tables.
- **Store plantings on calendar entries**: Violates FR-010 (plans ≠ plantings;
  calendar is unique per variety, plantings allow duplicates).

## 3. Plantings vs calendar vs favorites

**Decision**: Separate `garden_plantings` rows. Recording a planting MUST NOT
insert/delete `garden_calendar_entries` or `favorites`. Removing a planting
MUST NOT touch those tables. The add-planting picker MAY read `GET /api/plants`
and `GET /api/favorites`; favorites stay session-private. No “convert calendar
row” action.

**Rationale**: FR-010 / clarify. Layout and care later consume plantings, not
calendar plans.

**ADR**: `docs/adr/0006-seasonal-plantings.md`

**Alternatives considered**: Auto-create a calendar plan when recording a
planting (rejected in spec). Soft-link the same row (wrong uniqueness rules).

## 4. Named beds as labels

**Decision**: `garden_beds` is a named container: `name` (trimmed display) plus
`name_normalized` (trim + case-fold) UNIQUE per garden. Max 120 characters after
trim (same as garden names). No size, shape, map position, or color. A planting
has optional `bed_id`. Deleting a bed SET NULL on plantings.

**Rationale**: FR-005/FR-006; layout geometry is 005.

**Alternatives considered**: Polygons now (out of scope). Encode bed as a free
string on the planting (rename/delete-bed would not be a first-class action).

## 5. Dates

**Decision**: Persist `planted_on` and `harvested_on` as PostgreSQL `date`.
JSON uses ISO `YYYY-MM-DD` (household local calendar date, no time, no TZ).
Each may be null, past, today, or future. Unset stays null (never coerced to
today). If both are set, `harvested_on >= planted_on`; otherwise
`VALIDATION_ERROR` `Harvest date must be on or after planted date`. Harvest
without planted is allowed. `assertDatePair` is a pure function shared by API
and UI.

**Rationale**: Clarify: future dates allowed; unset ≠ today; harvest-before-
planted rejected.

**Alternatives considered**: `timestamptz` (invents a time). Month-day without
year (that is calendar frost math, not this feature). Server “today” default.

## 6. Identity and duplicates

**Decision**: Planting identity is the planting row UUID. UNIQUE is **not**
`(garden_id, plant_id)` — the same variety MAY appear many times. Client MAY
supply the planting UUID on POST so offline retries are idempotent: same id in
the same garden returns the existing row (`200`); same id in another garden is
`CONFLICT`. A retry MUST NOT apply as a create of a second row.

**Rationale**: FR-013; offline queue needs a stable id before the server ack.

**Alternatives considered**: Server-only ids plus temp client ids (mapping
table). Quantity column (rejected in spec; two rows instead).

## 7. AuthZ

**Decision**: Reuse `SessionGuard` + `GardenMembershipGuard` (`params.id` =
garden id). Any member: GET plantings (includes beds). Owner + collaborator:
POST/PATCH/DELETE plantings and beds. Viewer mutate → **403**
`Viewers cannot update plantings` / `Viewers cannot update beds`. Non-member →
**404** `Garden not found`. Unauthenticated → 401. Planting that is not in this
garden → **404** `Planting not found` (no existence leak across gardens). Bed
not in this garden → **404** `Bed not found`.

**Rationale**: Principle V; FR-004/FR-007. Same existence policy as 002/003.

**Alternatives considered**: Separate planting ACL (YAGNI).

## 8. Concurrent edits and last-write-wins

**Decision**: No ETag / merge UI. Two members PATCHing the same planting: later
successful save wins. PATCH returns the stored planting. List GET after save
shows that result (SC-008).

**Rationale**: FR-003; matches garden PATCH and calendar add/remove.

## 9. Remove lifecycle

**Decision**: Hard DELETE after an explicit in-page confirm (same two-step
pattern as garden delete: Cancel leaves the row). No `status`, archive, or
undelete column. Cancel never hits the API. After confirm, the row is gone;
the same variety MAY be recorded again as a **new** planting. Catalog, favorites,
and calendar plans are unchanged. DELETE of a missing planting (member of the
garden) returns **404** `Planting not found` — not calendar-style idempotent
204 — so a queued remove/update of a remotely deleted row can fail visibly.

**Rationale**: Clarify Q5; FR-003; no-resurrect (Q1).

**Alternatives considered**: Soft-delete (restore UI + sync complexity).
Idempotent 204 DELETE (hides remote-delete vs our-delete for the queue).

## 10. Offline queue and no-resurrect

**Decision**: IndexedDB `og-plantings`:

- **Cache**: last successful GET keyed by user id + garden id.
- **Queue**: one pending record per entity key `planting:<id>` or `bed:<id>`.
  Fields: `op` (`create` | `update` | `delete`), body, `clientMutationId`,
  `updatedAt`. Rapid repeats **overwrite** (last intent wins).

Rules:

1. Viewer never enqueues (controls hidden, same as calendar).
2. Mutations apply to the on-device list immediately and show **pending**.
3. On `online` / drain: play queue in updatedAt order. Failed items show
   **needs-attention** with the error (not success, not pending-only).
4. `create` → POST with client UUID. Still syncs even if some other planting
   was remotely deleted.
5. `update` → PATCH. If 404 `Planting not found` (or garden 404): **fail
   visibly**, drop that queue item, **do not POST a replacement**.
6. `delete` → DELETE after confirm already happened. If 404: fail visibly, drop
   item, do not recreate.
7. Unsynced `create` followed by `delete` of that same client id: drop the
   queue entry (net zero; do not round-trip a DELETE that would 404).
8. Garden 404 on drain (removed from garden / garden gone): drop that garden’s
   cache and queue; user sees they no longer have access. Do not keep applying.
9. Playwright: abort `**/api/gardens/**/plantings**` and
   `**/api/gardens/**/beds**` (dev server has no service worker). Do not
   `setOffline` + full reload.

**Rationale**: US3; favorites queue pattern; clarify Q1 (no resurrect). Calendar
and membership stay online-only — this queue MUST NOT call those APIs.

**Alternatives considered**: Online-only (rejected in spec). CRDT / generic sync
framework (YAGNI). Treat PATCH 404 as insert (resurrects; forbidden).

## 11. List grouping and filter

**Decision**: GET returns `beds` (all named beds for the garden) and paged
`plantings` (default `pageSize` 200, max 500, `created_at DESC`). The client
requests `pageSize=200` and, if `total` exceeds the first page, fetches remaining
pages, then calls `groupPlantings(concatenatedPlantings, beds)`:

- One group per named bed, **including empty beds**, sorted by name
  (`localeCompare` base sensitivity).
- **Unassigned** group only when at least one planting has `bedId === null`.
- Within a group: newest **recorded** first (`createdAt` DESC, then `id` DESC —
  not `plantedOn`).
- Bed filter is client-side on the loaded set; it does not mutate. Filter with
  no rows: empty state + clear control. Saved set unchanged.

US1 may render a flat list. FR-015 grouped default is complete only after US2.

A garden with zero plantings still shows empty bed groups if beds exist;
Unassigned is omitted. Zero plantings and zero beds: empty-list CTA.

**Rationale**: FR-015; empty beds must be assignable/renamable/deletable from
the list. Server-side group-by would break offline filter.

**Alternatives considered**: Flat list with a bed column (weaker SC-006).
Server `bedId` query only (breaks offline filter of a cached unfiltered page).

## 12. API shape

**Decision**: Nested REST under the garden:

- `GET /api/gardens/:id/plantings`
- `POST /api/gardens/:id/plantings` `{ id?, plantId, plantedOn?, harvestedOn?, bedId? }`
- `PATCH /api/gardens/:id/plantings/:plantingId` `{ plantedOn?, harvestedOn?, bedId? }`
- `DELETE /api/gardens/:id/plantings/:plantingId`
- `POST /api/gardens/:id/beds` `{ id?, name }`
- `PATCH /api/gardens/:id/beds/:bedId` `{ name }`
- `DELETE /api/gardens/:id/beds/:bedId`

GET includes beds + plantings + `myRole`. POST planting `201` on first insert,
`200` on idempotent id retry. PATCH returns the updated planting. DELETE
planting `204` when the row existed; `404` when it did not. DELETE bed `204`;
plantings in that bed become `bedId: null`.

Add-plant UI: paged catalog search and favorites picker — no unbounded dump.

**Rationale**: Spec scale; reuse catalog/favorites APIs (YAGNI).

**Alternatives considered**: GraphQL (constitution). User-global `/api/plantings`
(violates garden isolation).

## 13. UI

**Decision**: Route `gardens/:id/plantings`. Link from garden detail (alongside
Calendar). Native `<input type="date">` and native selects (no `[ngValue]`).
Viewer hides add/edit/remove/bed-manage. Unavailable catalog variety: still
listed with a non-color-only indicator; owner/collaborator can still confirm-
remove. Confirm remove uses the in-page Cancel / Confirm pattern from garden
delete (not `window.confirm`). Pending rows show a visible pending/needs-
attention state.

**Rationale**: 002 Playwright lesson on native controls; SC-001 findability;
FR-012 unavailable variety.

## 14. Testing split

**Decision**: Vitest in `libs/seasonal-plantings` for date pair, grouping, names,
and service authZ. Zod smokes in `apps/api-e2e`. Playwright UI + HTTP against
Compose, including role matrix, confirm/cancel, empty-bed groups, offline queue,
and no-resurrect.

**Rationale**: Same split as 002/003 (unit job has no Postgres).

## Resolved Technical Context unknowns

| Topic | Resolution |
|-------|------------|
| Performance | <2s first load is a **manual** quickstart check, not CI; grouping uses concatenated pages |
| Scale | Tens of beds; tens–low hundreds of rows/garden; pageSize 200 (max 500); client fetches remaining pages when `total` exceeds first page |
| Domain lib | `libs/seasonal-plantings` |
| Persistence | Extend `plant-catalog-data`; migration 0004 |
| Dates | SQL `date` / ISO `YYYY-MM-DD`; future allowed; null stays unset |
| Duplicates | No unique (garden, plant); client UUID for idempotent POST |
| AuthZ | Reuse garden membership; 404/403 as 002 |
| Grouping | Client concatenates pages then `groupPlantings`; empty beds shown; Unassigned only if needed; newest = `createdAt` |
| Offline | Cache + queue; pending vs failed distinct; PATCH/DELETE 404 does not recreate |
| Remove | Confirm then hard delete; no archive |
| Provider | None; existing catalog rows only |
| Calendar | Unchanged; no auto-convert |
| Domain service | `PlantingService` injects catalog-data repositories (not Nest/Drizzle schema) |
