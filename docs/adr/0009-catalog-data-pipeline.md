# ADR 0009: Catalog data pipeline replaces hybrid catalog sync

## Status

Accepted

## Context

Plant Database (001) filled PostgreSQL with a hybrid path: operator
`POST /api/admin/plants/sync` (capped page upsert, single `PLANT_PROVIDER`)
and on-demand miss-fill when a name search missed locally. Clarify for 007
(2026-08-18): ingest is a full load of every configured plant source, merge
into one garden-variety catalog, no gardener sync, no miss-fill, reject
concurrent runs, operators work in the product admin area. v1 is
multi-source capable; local/CI may be fixture-only; at most one live source
is required never, optional when credentials exist.

Constitution still forbids feature-level vendor HTTP (ADR 0003). YAGNI
forbids a general ETL platform. Care reminders and calendars must keep
reading `plants` as they do today.

## Decision

1. Domain ingest lives in `libs/catalog-pipeline`. Gardener list/detail stay
   in `libs/plant-catalog` and MUST NOT call `PlantDataProvider`.
2. A source registry runs all enabled `PlantDataProvider` adapters in
   operator-configured order (last non-null field wins; blanks fill).
3. Fetch+merge in memory; one transaction publishes to `plants`. Gardeners
   see the previous catalog until commit. Interrupted fetch does not publish.
4. At most one `running` row (partial unique index). Second start is 409.
   HTTP start is 202 + in-process work; CLI `api:sync-plants` waits.
5. Schedule is a settings singleton + 60s poll inside the API process.
   Seeded `sourceOrder` is `['fixture']` (last id wins when multiple enabled).
6. Deprecate only when every previously contributing source succeeded and
   omitted the variety; reactivation updates the same row.
7. Remove `POST /api/admin/plants/sync` and miss-fill. Admin UI:
   `/admin/pipeline`. Adapters map vendor units/labels; merge does not.
   Diagnostics store counts and `fieldWinners`, not raw vendor JSON.

## Consequences

+ App lookups are independent of live plant APIs
+ Multi-source merge is testable with two fixtures
+ Operator visibility without a separate ops console
- Empty search no longer auto-fills from Perenual
- Full Perenual paging can take longer than the old 500-row cap; gardeners
  are unaffected during the run
- `catalog_sync_runs` becomes historical; new table is
  `catalog_pipeline_runs`
