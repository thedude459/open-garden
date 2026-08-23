# Research: Catalog Data Pipeline

**Feature**: `007-data-pipeline` | **Date**: 2026-08-18

## 1. Domain library vs extending CatalogSyncService

**Decision**: New Nx lib `libs/catalog-pipeline` for fetch → normalize →
merge → publish, run locking, deprecation/reactivation, and schedule
eligibility. `CatalogService` stays in `libs/plant-catalog` and becomes
**local-only** (no provider). `CatalogSyncService.runOperatorSync(limit)` is
retired. Persistence stays in `libs/plant-catalog-data`. Nest controllers in
`apps/api` stay thin. Angular imports DTOs and the admin page only — not
repositories, Drizzle, or provider adapters.

**Rationale**: Constitution library-first. Ingest is a different bounded
context from gardener search. Unit tests for merge, lock, and deprecation
must not boot Nest or HTTP.

**Alternatives considered**:
- **Grow `CatalogSyncService` in place**: Mixes query and ingest; the current
  service page-upserts with a 500 cap and a single provider — the opposite of
  full multi-source publish.
- **App-only pipeline in `apps/api`**: Violates Principle I.
- **General ETL framework / extra Nx “pipeline-runtime”**: Spec is plant
  catalog only (FR-017); YAGNI.

**ADR**: `docs/adr/0009-catalog-data-pipeline.md`

## 2. Provider registry (not a single env provider)

**Decision**: Keep `PlantDataProvider` in `libs/plant-provider` (ADR 0003).
Introduce a **source registry**: an ordered list of port implementations. A
run iterates **every enabled source**. v1 adapters:

| id | Adapter | When registered |
|----|---------|-----------------|
| `fixture` | `FixturePlantProvider` | Always |
| `fixture-b` | Second fixture dataset (overlap + unique varieties) | Always (tests / optional operator enable) |
| `perenual` | `PerenualPlantProvider` | When `PERENUAL_API_KEY` is set |

Seeded settings `sourceOrder`: `['fixture']`. Last in `sourceOrder` wins on
conflicting non-null fields; earlier sources fill blanks. When
`PERENUAL_API_KEY` is set, an operator MAY set `['fixture', 'perenual']`
(live source last). `fixture-b` is not in the default order. SC-002 unit
tests merge a **controlled 10+10+10 pair**. Full-catalog e2e with
`['fixture', 'fixture-b']` asserts overlap keys appear once and B-uniques
appear; it MUST NOT expect the whole catalog to contain only 30 rows.

`CatalogService` MUST NOT call `searchByName`. Leave `searchByName` on the
port so adapters stay intact; miss-fill is removed. Adapters (not the
pipeline merge) map vendor field names, units, and labels into
`ProviderPlant`.

Full load: page `listPage` until `nextCursor` is absent. **No `limit` cap.**
A source that throws or is interrupted is failed/incomplete, not a successful
prefix.

**Rationale**: FR-004 / FR-018 / FR-020. Constitution forbids feature-level
vendor HTTP. Two fixture sources prove merge without a second live vendor.

**Alternatives considered**:
- Keep `PLANT_PROVIDER` single-adapter env (cannot satisfy multi-source).
- Require two live vendors in v1 (rejected in clarify).
- Incremental/delta ingest (rejected in clarify).

## 3. Publish cutover (no gardener-visible half catalog)

**Decision**: Fetch and merge **in memory**, then persist in **one database
transaction**: upsert merged plants (status `active`, refresh attributes),
rewrite source-link rows, deprecate eligible missing varieties. Until that
commit, `GET /api/plants` keeps reading the previous `plants` rows.

Household scale is thousands of varieties — safe in memory. Do not
page-upsert into `plants` the way `CatalogSyncService` does today. If fetch
is interrupted, skip the publish transaction; gardeners keep the previous
catalog. Operator GET while `running` may show zero counts until the
terminal publish.

**Rationale**: Edge case “gardeners do not see a half-updated catalog
mid-write.” Failed transactions leave the last successful catalog.

**Alternatives considered**:
- Staging tables + rename (heavier; not needed at this scale).
- Per-page upsert to `plants` (violates the half-update rule).

## 4. Concurrency: reject, do not queue

**Decision**: At most one `running` pipeline run. Partial unique index on
`catalog_pipeline_runs (status) WHERE status = 'running'`. A second
operator POST or scheduled tick that cannot insert returns **409 CONFLICT**
`A pipeline run is already running`. No queue, no cancel-and-replace.

On API boot: any `running` row older than a stale threshold (or any
`running` row if the process died) is marked `failed` with a safe message so
a new run can start.

**Rationale**: Clarify 2026-08-18 reject. Full loads must not stack.

**Alternatives considered**: Queue one waiter; cancel in-flight (both
rejected in clarify).

## 5. HTTP start is async; CLI waits

**Decision**: `POST /api/admin/pipeline/runs` authenticates admin, inserts
`running`, returns **202** with the run id, then continues ingest
**in-process** (no Redis/Bull). `GET` is the status channel (SC-006).

`npm run api:sync-plants` calls `runAndWait()` on the same service so
quickstart/CI seed still blocks until the fixture full load finishes.

**Rationale**: Live full pages can exceed a request timeout; fixture-scale
still finishes quickly for e2e that poll GET.

**Alternatives considered**: Synchronous POST (timeouts on Perenual). Job
queue product (YAGNI, extra infra).

## 6. Schedule in the API process

**Decision**: Settings row: `cadence` `daily` | `disabled`, `runAtHourUtc`
0–23, `sourceOrder`, `enabled` sources. Nest `onModuleInit` **60s interval**
(no `@nestjs/schedule` package) calls `tryStartScheduled()`. If a run is
already running, the tick is a no-op reject. Default: daily, hour `6` UTC.

The API process must stay up for scheduled runs (existing Compose
`api:serve`). No OS cron, no extra Compose service.

**Rationale**: Clarify: operator configures schedule in the product admin
area. YAGNI vs cron containers.

**Alternatives considered**: OS crontab (not in-product). `@nestjs/schedule`
(extra dep for one interval).

## 7. Deprecation and reactivation

**Decision**: After a publish, a previously loaded variety is marked
`deprecated` only if **every source that previously contributed** to it
**succeeded** this run **and** the variety key is absent from the merged
set. A failed source must not cause deprecation of plants it used to supply.
An empty successful source does not wipe the whole catalog.

If a later successful full load includes that variety key again: same
`plants` row → `active`, attributes from the new merge (FR-014).

**Rationale**: Spec FR-014 and clarify reactivation. Distinguishes “source
down” from “source no longer lists this plant.”

## 8. Retire miss-fill and POST /api/admin/plants/sync

**Decision**: Delete miss-fill from `CatalogService.list`. Remove
`POST /api/admin/plants/sync` (or make it 410). Gardener UI never had a sync
button — keep it that way (FR-002 / FR-012). Admin UI is new
`/admin/pipeline`.

Expand `FixturePlantProvider` to **≥50** valid plants (SC-009). Keep Cherry
Tomato, Interval Herb, Unknown Herb, and calendar fixtures used by 003–006.

**Rationale**: Spec replaces hybrid sync. Existing e2e still need named
fixtures.

## 9. Operator admin UI and authZ

**Decision**: Reuse `users.role === 'admin'` (001). New Angular standalone
`PipelinePage` at `/admin/pipeline` with `authGuard` + admin role check.
Non-admin: API 403 `Admin role required`; UI redirects away. Garden
membership is irrelevant. No gardener-visible last-updated badge (FR-012).

**Rationale**: Clarify in-product operator area. Existing demo
`admin@example.com`.

## 10. Merge audit without raw payloads

**Decision**: Persist per-run per-source counts and a compact
`fieldWinners` map on merge rows keyed by `variety_key`. Do **not** store
raw vendor JSON (secrets, YAGNI). `plants.provider` becomes the
highest-precedence contributing source id; `catalog_plant_sources` holds
`(plant_id, source_id, external_id)`.

**Rationale**: FR-007 operator audit; isolation of source secrets.
