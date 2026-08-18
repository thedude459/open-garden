# Research: Care Reminders

**Feature**: `006-care-reminders` | **Date**: 2026-08-17

## 1. Domain library vs app-only folders

**Decision**: New Nx lib `libs/care-reminders` for ISO date arithmetic,
harvest/water/fertilize derivation, one-open-repeating-item rules, sort order,
and complete/dismiss application. Nest controllers in
`apps/api/src/gardens/` stay thin. Angular imports only the pure helpers
(`deriveReminders`, `sortReminders`, `addIsoDateDays`, types) — not Nest,
Drizzle schema, or repositories. `CareReminderService` in the same lib
receives catalog-data **repository classes** as constructor deps (same pattern
as `PlantingService` / `LayoutService`).

**Rationale**: Constitution library-first. SC-002 derivation fixtures and
SC-006 sort must be unit-tested without HTTP. The PWA must apply the same
derive/sort to a cached GET plus pending queue overlays.

**Alternatives considered**:
- **App-only services**: Violates Principle I; client and API would drift on
  due dates.
- **Fold into `libs/seasonal-plantings`**: Mixes planting CRUD with chore
  derivation. The planting list must not import reminder cadence. Angular
  already cannot import the seasonal-plantings barrel.
- **Fold into `libs/planting-calendar`**: Spec forbids calendar plans as
  reminder sources.

## 2. Persistence home

**Decision**: Extend `libs/plant-catalog-data`. Migration
`0006_care_reminders.sql`:

- Nullable `water_interval_days` and `fertilize_interval_days` on `plants`
  (integer, > 0 when set).
- New table `garden_care_events`: one row per `(planting_id, kind,
  occurrence_on)` with `action` `completed` | `dismissed`. Planting delete
  CASCADE. Do not create `libs/care-reminders-data`.

The open reminder list is **derived** on GET, not stored as a document.

**Rationale**: Completions must be garden-shared (FR-004) without writing
`harvested_on` (FR-005). One migration pipeline.

**Alternatives considered**:
- **Store the full due list**: Would fight “one open repeating item” as dates
  move with `asOf`.
- **Flags on `garden_plantings`**: Cannot represent repeating water skips.
- **Dedicated data lib**: Extra Nx project for one table and two columns.

**ADR**: `docs/adr/0008-care-reminders.md`

## 3. Catalog intervals vs qualitative waterNeeds

**Decision**: Do **not** map `waterNeeds` strings (Low / Moderate / High) to a
number of days. Watering and fertilizing rows exist only when
`water_interval_days` / `fertilize_interval_days` is a positive integer.
Existing fixture plants keep qualitative `waterNeeds` and **null** intervals
so harvest remains the default demonstrable reminder. Add one fixture plant
**Interval Herb** with `waterIntervalDays: 7`, `fertilizeIntervalDays: 21`, and
known `daysToMaturity` for repeating-care tests (same idea as Unknown Herb for
null spacing). Perenual mapping leaves the new fields null.

**Rationale**: Clarify 2026-08-17 omit; spec forbids fabricating a cadence.

**Alternatives considered**:
- Map Moderate → 3 days (rejected in spec).
- Show unavailable rows (rejected in clarify).
- Skip water/fertilize code paths until a future catalog (would leave FR-003
  untestable in e2e).

## 4. Derivation and `asOf`

**Decision**: GET requires query `asOf=YYYY-MM-DD` (household local calendar
date when the list is opened). The Angular client sends today’s local date.
Tests freeze `asOf`. The API MUST NOT use server-local midnight as a silent
default that would shift “due today” across regions.

Date math is calendar-day on ISO dates (UTC date construction, no DST).
`addIsoDateDays` / `diffIsoDateDays` live in the domain lib.

**Harvest** (one-shot per planting):

1. If `harvestedOn` is set → omit.
2. If any care event exists for `(planting, harvest)` → omit.
3. If `plantedOn` or `daysToMaturity` is missing → omit.
4. Else `dueOn = addIsoDateDays(plantedOn, daysToMaturity)` — list even if far
   in the future.

**Water / fertilize** (at most one open item per kind per planting):

1. If `plantedOn` missing or interval missing/≤0 → omit.
2. Let `cursor` be the event with the **greatest** `occurrence_on` for that
   planting and kind, if any.
3. If no cursor: if `plantedOn > asOf`, `dueOn = plantedOn` (upcoming); else
   `dueOn` is the latest interval boundary on or before `asOf` (anchor
   `plantedOn`, step `intervalDays`). That is one overdue/due-today item, not
   a stack.
4. If cursor exists: `dueOn = addIsoDateDays(cursor.occurrence_on, interval)`.
   That single item may still be overdue (catch-up one interval per complete).

Complete or dismiss writes/updates the event for the **posted** `dueOn`.
Derivation then uses the new cursor. Completing harvest does not PATCH the
planting.

**Rationale**: Clarify stacking / harvest horizon / household local date.

**Alternatives considered**: Server “today” (rejected in spec). Jump repeating
due to “now” after one complete (would skip catch-up). Stack missed weeks
(rejected in clarify).

## 5. Occurrence identity and last-write-wins

(See also spec FR-004.)

**Decision**: The occurrence key is `(plantingId, kind, dueOn)`. GET returns
that triple (no extra UUID). POST complete/dismiss uses the same triple.
UNIQUE `(planting_id, kind, occurrence_on)` : concurrent posts UPDATE `action`
and `updated_at` (last successful save wins; no merge UI). A POST for a
planting not in this garden is 404 `Planting not found`. A POST whose `dueOn`
is not the currently derived open occurrence is still accepted (records the
event); derivation uses the latest `occurrence_on` cursor so a stale older
complete cannot recreate a cleared newer item.

**Rationale**: Offline queue needs a stable key before persist. Matches 004
last-write-wins.

**Alternatives considered**: Server-generated occurrence UUIDs (cannot identify
a derived-but-not-yet-acted item). ETags (YAGNI).

## 6. Offline cache and queue

**Decision**: IndexedDB:

- **`og-reminders`**: last successful GET keyed by user id + garden id.
- **`og-reminders-queue`**: one pending record per occurrence key
  `plantingId:kind:dueOn`. Fields: `action` (`complete` | `dismiss`),
  `clientMutationId`, `updatedAt`. Rapid repeats **overwrite**.

Rules (mirrors 004 plantings, not 005 layout):

1. Viewer never enqueues.
2. Complete/dismiss apply on-device immediately and show **pending**. Repeating
   next due is `addIsoDateDays(dueOn, intervalDays)` using `intervalDays` on
   the DTO (`null` for harvest).
3. Drain on `online` in `updatedAt` order. Failed items show **needs-attention**.
4. Garden 404 on drain: drop that garden’s cache and queue; user sees
   not-found. Do not keep applying.
5. Planting 404: fail visibly, drop that queue item, do not recreate a
   planting or a reminder.
6. Playwright: abort `**/api/gardens/**/reminders**`. Do not `setOffline` +
   full reload.
7. MUST NOT write `og-plantings-queue` or layout PUT.

**Rationale**: US3 / FR-007.

**Alternatives considered**: Online-only complete (rejected in spec). Share the
planting queue (would mix entity types and violate FR-007).

## 7. AuthZ and errors

**Decision**: Reuse `SessionGuard` + `GardenMembershipGuard` (`params.id` =
garden id). Non-member GET/POST: **404** `Garden not found`. Viewer GET: 200.
Viewer POST: **403** `Viewers cannot update reminders`. Unauthenticated: 401.
Invalid `asOf` / `dueOn`: **400** `Date must be YYYY-MM-DD`. Nest: explicit
`@Inject(...)`.

**Rationale**: Same as 004; constitution multi-user; no existence leak.

## 8. UI

**Decision**: Route `gardens/:id/reminders` **before** `gardens/:id`. Link from
garden detail next to Plantings / Calendar / Layout. Flat list (not grouped by
bed). Native buttons for Complete / Dismiss (no `[ngValue]`). Overdue vs due
today vs upcoming are distinct labels (not color-only). Empty garden: CTA to
record plantings. Plantings but nothing derivable: nothing due / not ready.
Viewer hides mutate controls.

**Rationale**: FR-010 order; 002 native-control lesson; SC-001 findability.

## 9. What this feature does not do

No layout editing, planting-calendar generation, purchasing, weather-based
irrigation, companion rules, OS push notifications, pruning/pest/succession
kinds, qualitative→days mapping, auto-fill of `harvestedOn` on harvest
complete, or merging reminder mutations into the planting or layout queues.

## Resolved Technical Context unknowns

| Topic | Resolution |
|-------|------------|
| Performance | <2s first load is a **manual** quickstart check, not CI |
| Scale | Tens–low hundreds of plantings/garden; at most 3 open items per planting |
| Domain lib | `libs/care-reminders` |
| Persistence | Extend `plant-catalog-data`; migration 0006 |
| Intervals | Nullable integer columns; fixture Interval Herb; no Moderate map |
| Today | Client `asOf` YYYY-MM-DD |
| AuthZ | Reuse garden membership; 404/403 as 004 |
| Offline | `og-reminders` cache + `og-reminders-queue`; abort reminders URLs |
| Harvest complete | Event only; planting dates unchanged |
| Provider | No new HTTP; fixture fields only |
| Domain service | `CareReminderService` injects catalog-data repositories |
