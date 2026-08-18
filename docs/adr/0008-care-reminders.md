# ADR 0008: Care reminders as derived chores on planting rows

## Status

Accepted

## Context

Seasonal Plantings (004) record what is in the ground. Gardeners need shared
water / fertilize / harvest reminders from those rows, including offline
complete/dismiss in the yard. Clarify 2026-08-17: dismiss skips this
occurrence only; qualitative catalog water is omitted (not mapped to days);
repeating care has at most one open item (no stack of missed weeks); harvest
lists every unfinished planting with no day cutoff; the list is flat and
time-ordered.

Catalog `water_needs` is a qualitative string. Inventing a cadence would fail
the spec. Completing harvest must not write `harvested_on` (planting list
remains the place to record harvest). Layout (005) is online-only and must not
share this queue.

## Decision

1. Derive the open list in `libs/care-reminders` from plantings + catalog
   intervals + `garden_care_events`. GET is parameterized by client `asOf`
   (`YYYY-MM-DD`).
2. Persist complete/dismiss as events UNIQUE on
   `(planting_id, kind, occurrence_on)`. Last successful action wins.
3. Add nullable `water_interval_days` and `fertilize_interval_days` on
   `plants`. Do not parse `water_needs`. Fixture **Interval Herb** supplies
   intervals for tests; other fixtures leave them null.
4. Occurrence identity is `(plantingId, kind, dueOn)` — no extra UUID on GET.
5. Offline: IndexedDB read cache `og-reminders` plus mutation queue
   `og-reminders-queue`. Do not use `og-plantings-queue` or layout PUT.
6. AuthZ reuses garden membership (ADR 0004). Non-members 404; viewers 403 on
   mutate.

## Consequences

+ Harvest works on current fixtures (planted date + days to maturity)
+ Water/fertilize are testable without fabricating Moderate→N days
+ Completions are household-shared without overloading planting dates
- Gardeners must complete repeating care once per interval to catch up when
  behind (one open item, not a jump to today)
- Perenual-synced plants will not show watering until interval fields are
  populated in a later catalog change
