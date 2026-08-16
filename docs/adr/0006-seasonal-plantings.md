# ADR 0006: Seasonal plantings as garden-scoped records

## Status

Accepted

## Context

Household Gardens (002) share a garden among owner / collaborator / viewer.
Planting Calendar (003) is a **plan set**: at most one calendar row per catalog
variety per garden, online-only add/remove, frost-relative windows. Gardeners
also need a list of what is **actually planted** this season (optional dates,
optional named bed, duplicate varieties, offline queue). Clarify 2026-08-16:
queued edits must not resurrect a remotely deleted planting; dates may be
future; default list is grouped by named bed with empty beds visible;
Unassigned only when needed; remove is confirmed permanent delete.

## Decision

1. Persist `garden_plantings` and `garden_beds` in `plant-catalog-data`, not as
   calendar entries and not as a user-global inventory.
2. Domain rules live in `libs/seasonal-plantings` (date pair, grouping,
   bed-name uniqueness). AuthZ reuses garden membership (ADR 0004).
3. Plantings, calendar plans, and favorites are separate writes. No auto-convert.
4. Client-generated UUIDs make POST idempotent for the offline queue. PATCH or
   DELETE that returns `Planting not found` fails visibly and MUST NOT insert.
5. Confirmed remove is a hard DELETE (no archive column), matching garden
   delete (002) rather than calendar’s idempotent 204.

## Consequences

+ Layout (005) and care reminders (006) can attach to planting rows later
  without overloading calendar uniqueness
+ Duplicate tomato rows and named-bed groups are first-class
+ Offline capture in the yard matches favorites-style queue without a sync
  framework
- Two “plant lists” on a garden (calendar vs plantings) must stay labeled in
  the UI
- DELETE-missing is 404 (not 204), so clients must treat already-gone remove
  as a visible sync failure rather than silent success
