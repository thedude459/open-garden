# Research: Planting Calendar

**Feature**: `003-planting-calendar` | **Date**: 2026-08-16

## 1. Domain library vs app-only folders

**Decision**: New Nx lib `libs/planting-calendar` for window computation,
this-week overlap, and calendar-entry add/remove. Nest controller in
`apps/api/src/gardens/` stays thin. Angular imports only the pure helpers
(`overlapsThisWeek`, types) — not Nest, Drizzle schema, or repositories.
`CalendarService` in the same lib receives catalog-data **repository classes**
as constructor deps (mirrors `GardenService`).

**Rationale**: Constitution library-first. Frost-relative math and SC-002/SC-008
must be unit-tested without HTTP. This-week overlap must run in the browser with
the viewer’s local date (FR-013).

**Alternatives considered**:
- **App-only services**: Violates Principle I; duplicates math on client and server.
- **Fold into `libs/gardens`**: Mixes site-profile/membership with seasonal math;
  gardens lib would take a plant-catalog dependency it does not have today.
- **Compute only on the server and send `emphasized`**: Wrong timezone; fails
  offline date change (US3 scenario 4).

## 2. Persistence home

**Decision**: Add `garden_calendar_entries` and optional growing-guidance columns
on `plants` in `libs/plant-catalog-data`. Migration `0003_planting_calendar.sql`.
Do not create `libs/planting-calendar-data`.

**Rationale**: One migration pipeline, one DB client. Garden delete already
`ON DELETE CASCADE` memberships; calendar entries cascade the same way (002
research: later FKs to gardens must cascade or restrict).

**Alternatives considered**:
- **Dedicated data lib**: Extra Nx project for one table.
- **Store computed dates on the entry row**: Stale when frost dates change;
  spec requires windows to follow current garden frost on refresh.

## 3. Growing guidance shape

**Decision**: For each of indoor start, outdoor sow, and transplant, persist:

- `frost_anchor`: `'last' | 'first' | null`
- `weeks_earliest`, `weeks_latest`: signed smallints (`null` together with
  anchor). Negative = weeks **before** the named frost; positive = weeks
  **after**. `weeks_earliest <= weeks_latest` (in numeric order, which is also
  chronological). A single source number stores equal earliest and latest.

Harvest is **not** stored as frost-relative weeks: use existing
`plants.days_to_maturity` applied to the start window (transplant if known,
else sow, else indoor).

Missing anchor or missing weeks → that window is unavailable (do not assume
last frost). If `|weeks| > 52` or earliest > latest, persist that window as
all-null (unknown) instead of failing operator sync. Direct-sow missing indoor
start is the same unavailable state (no separate N/A enum).

**Rationale**: Matches clarify B (per-window frost anchor) and date ranges.
Signed weeks avoid a separate before/after enum. Perenual’s current mapper has
no sowing weeks — fields stay null (FR-005). Fixture provider supplies
deterministic last-frost and first-frost plants for tests.

**Alternatives considered**:
- **Unsigned weeks + direction enum**: More columns, same information.
- **Store ISO dates on the plant**: Not garden-specific; breaks per-garden frost.
- **Curated default weeks in the app**: Rejected in clarify (never invent).

## 4. Annual month-day arithmetic

**Decision**: Compute in a leap-safe reference year (**2024**) from the garden’s
`MonthDay` frost pair: `Date.UTC(2024, month-1, day)` + `weeks * 7` days (or
`daysToMaturity` for harvest). Convert the result back to `{ month, day }` plus
`wrapsYear` when the end instant falls in a later calendar year than the start.
Feb 29 frost is valid (002). Overlap and display treat ranges as **recurring
annual month-days** (a late-December this-week can overlap an early-January
window).

Do **not** clip ranges to last/first frost.

**Rationale**: Frost dates have no year. A fixed leap year keeps Feb 29. Client
and server share the same pure functions.

**ADR**: `docs/adr/0005-planting-calendar-windows.md`

**Alternatives considered**:
- **Day-of-year integers**: Worse leap-day handling.
- **Clip to first frost**: Rejected in clarify.
- **Civil-year Date columns**: Invents a year the spec does not have.

## 5. This-week emphasis

**Decision**: “This week” is today through today+6 on the **viewer’s local
calendar date** (not UTC, not locale week-start). The API returns window
`MonthDay` ranges only. The web client calls `overlapsThisWeek` on indoor, sow,
and transplant (not harvest) and applies a visual class. Type filter does not
strip emphasis. Empty emphasis is not an empty calendar.

Offline: recompute emphasis from cached windows + current local today.

**Rationale**: FR-013 / SC-008. Server “today” would disagree across timezones.

**Alternatives considered**:
- **ISO week containing today**: Needs locale week-start; rejected in clarify.
- **Server-computed `emphasized` flag**: Breaks FR-013 offline date movement.

## 6. Calendar set vs catalog

**Decision**: `garden_calendar_entries` is `(garden_id, plant_id)` UNIQUE.
POST add is **idempotent** (return the existing row; no CONFLICT). DELETE
removes the entry only. Catalog plant and favorites are unchanged. Deprecated
plants remain listed with `status: 'deprecated'` / unavailable-variety
indicator. Plant rows are not hard-deleted in 001, so FK `ON DELETE RESTRICT`
on `plant_id` is enough.

**Rationale**: Spec: one entry per variety per garden; calendar is not a
planting.

**Alternatives considered**: Duplicate rows for succession (out of scope; 004
owns in-ground records). Soft-delete entries (YAGNI).

## 7. AuthZ

**Decision**: Reuse `SessionGuard` + `GardenMembershipGuard` (`params.id` =
garden id). Any member: GET calendar. Owner + collaborator: POST/DELETE.
Viewer POST/DELETE → **403** `Viewers cannot update this calendar`. Non-member
→ **404** `Garden not found` (same existence policy as 002). Unauthenticated →
401.

Favorites used as a picker call the existing favorites API (private to the
session user). Calendar responses never include another user’s favorites list.

**Rationale**: Principle V; FR-006/FR-009. Do not invent a calendar-specific
role.

**Alternatives considered**: Separate calendar ACL table (YAGNI).

## 8. Concurrent edits and last-write-wins

**Decision**: No ETag. Two members adding different plants: both succeed.
Two members removing the same plant: second DELETE is idempotent success (or
404-as-gone that the client treats as already removed — **idempotent 204**).
No merge UI.

**Rationale**: FR-012; matches garden PATCH policy.

## 9. Offline

**Decision**: IndexedDB store `og-calendar` keyed by user id + garden id +
list query. Read-through when GET succeeds; serve cache when GET fails and
cache exists. Garden 404 deletes that garden’s calendar cache. Mutations check
`navigator.onLine` and failed fetch: online-required; do **not** enqueue.

Playwright: abort `**/api/gardens/**/calendar**` (dev server has no service
worker). Do not `setOffline` + full reload.

**Rationale**: Same pattern as 002 garden cache; spec forbids a mutation queue.

## 10. Provider and sync

**Decision**: Extend `ProviderPlant` with optional `growingGuidance` (the three
windows). `FixturePlantProvider` fills cherry tomato and basil (last-frost
indoor/transplant), marigold (last-frost sow, indoor unavailable), a new
spinach fixture (first-frost sow), a no-guidance tree (Red Maple), and
**Papaya** (fruit, zones 9–11, no guidance) so a zone-7 garden can show
zone-mismatch. `PerenualPlantProvider`
maps guidance as null unless a future source field exists — **do not invent
weeks from cycle text**. `CatalogSyncService` / `PlantRepository.upsertByVarietyKey`
persist the new columns. On-demand miss-fill follows the same upsert path.

**Rationale**: Clarify B. Constitution: no direct Perenual calls from the
calendar feature.

**Alternatives considered**: Hard-coded vegetable table in the calendar lib
(vendor lock-in / invented data).

## 11. API shape and filtering

**Decision**: Nested REST under the garden:

- `GET /api/gardens/:id/calendar`
- `POST /api/gardens/:id/calendar` `{ plantId }`
- `DELETE /api/gardens/:id/calendar/:plantId`

GET returns garden frost completeness, zone, and entries with **computed**
windows plus plant identity (`status` included so deprecated varieties stay
listed). Default `pageSize` 100, max 200 (household calendar set). Type filter
is **client-side** on the loaded/cached set so offline filter works without a
new request and does not mutate the saved set. A type filter with no matches
shows an empty state and a control to clear the filter.

Add-plant UI: paged catalog search (`GET /api/plants`) and `GET /api/favorites`
as a picker — no unbounded dump.

**Rationale**: Spec scale; reuse catalog/favorites APIs (YAGNI).

**Alternatives considered**: Server `plantType` query only (breaks offline
filter of a cached unfiltered page). GraphQL calendar (constitution).

## 12. UI

**Decision**: Route `gardens/:id/calendar`. Link from garden detail. Native
controls (no `[ngValue]`). Missing-frost banner still allows managing the
plant list. Viewer hides add/remove. Current-week rows get a non-color-only
emphasis (class + prefix text such as “This week”) so SC-007 is not
color-dependent.

Default **client** sort: emphasized first, then earliest upcoming start
window (min of known indoor/sow/transplant), then common name.

**Rationale**: 002 Playwright lesson on native selects; accessibility for
emphasis; SC-001 findability.

## 13. Testing split

**Decision**: Vitest in `libs/planting-calendar` for math and domain.
Zod smokes in `apps/api-e2e`. Playwright UI + HTTP against Compose, including
frost-shift fixtures and role matrix.

**Rationale**: Same split as 002 (unit job has no Postgres).

## Resolved Technical Context unknowns

| Topic | Resolution |
|-------|------------|
| Performance | <2s calendar first load local household; client this-week, no extra GET |
| Scale | Tens–low hundreds of plants/garden; pageSize 100 (max 200) |
| Domain lib | `libs/planting-calendar` |
| Persistence | Extend `plant-catalog-data`; migration 0003 |
| Guidance | Signed weeks + last/first anchor per window; harvest from days_to_maturity |
| Date math | Reference year 2024; annual MonthDay; no clip |
| This week | Local today .. today+6; client-only emphasis |
| AuthZ | Reuse garden membership; 404/403 as 002 |
| Offline | Read cache; abort calendar API in Playwright |
| Provider | Optional fields on port; fixture fills tomato/basil/marigold/spinach/maple plus Papaya (zones 9–11) for zone-mismatch; Perenual null |
| Filter | Client-side type filter; empty-filter state + clear |
| Invalid weeks | `\|weeks\| > 52` or earliest > latest → store window as unknown |
| Domain service | `CalendarService` injects catalog-data repositories (not Nest/Drizzle schema) |
