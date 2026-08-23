# Data Model: Catalog Data Pipeline

**Feature**: `007-data-pipeline` | **Date**: 2026-08-18  
**Spec**: [spec.md](./spec.md)

Migration: `libs/plant-catalog-data/migrations/0007_catalog_pipeline.sql`  
(applied by existing `npm run migrate` / sync-cli glob of `*.sql`).

## Entities

### Plant (existing, ingest behavior changes)

Gardener-visible catalog row. Identity unchanged: `variety_key`.

| Field | Change in 007 |
|-------|----------------|
| status | Pipeline sets `deprecated` / `active` per FR-014 |
| provider | Highest-precedence source that contributed this publish |
| provider_external_id | External id from that winning source |
| last_synced_at | Set on successful publish of this row |
| other attributes | Overwritten by merged values; nulls mean unavailable — never invented |

No gardener CRUD. Pipeline is the only writer of catalog plants.

### CatalogPlantSource (new)

Which sources contributed to a plant.

| Field | Type | Rules |
|-------|------|-------|
| plant_id | UUID | FK → plants ON DELETE CASCADE |
| source_id | string | provider id (`fixture`, `fixture-b`, `perenual`, …) |
| external_id | string | id at that source |
| updated_at | timestamptz | required |

**Constraints**: UNIQUE `(plant_id, source_id)`.

Used to decide deprecation: a plant is eligible to deprecate only when every
`source_id` linked here succeeded in the current run and the variety is absent
from the merged set.

### CatalogPipelineRun (new; replaces write-path of `catalog_sync_runs`)

One ingest execution. Operators read this; gardeners never do.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK |
| triggered_by | enum | `operator` \| `schedule` |
| started_at | timestamptz | required |
| finished_at | timestamptz \| null | set when leaving `running` |
| status | enum | `running` \| `succeeded` \| `failed` \| `incomplete` |
| plants_upserted | int | ≥ 0; merged rows written on publish |
| plants_deprecated | int | ≥ 0 |
| plants_reactivated | int | ≥ 0 |
| records_rejected | int | invalid source records skipped |
| error_message | string \| null | safe; never secrets or API keys |

**Constraints**: UNIQUE partial index `(status) WHERE status = 'running'` —
at most one running run.

Leave `catalog_sync_runs` in place (historical 001 rows). New code writes
only `catalog_pipeline_runs`. Do not dual-write.

### CatalogPipelineRunSource (new)

Per-source outcome inside a run.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK |
| run_id | UUID | FK → catalog_pipeline_runs ON DELETE CASCADE |
| source_id | string | required |
| status | enum | `succeeded` \| `failed` |
| records_accepted | int | ≥ 0 |
| records_rejected | int | ≥ 0 |
| error_message | string \| null | safe |

**Constraints**: UNIQUE `(run_id, source_id)`.

Overall run status:

- All configured/enabled sources succeeded → `succeeded`
- At least one succeeded and at least one failed → `incomplete` (successful
  sources still published)
- None succeeded, or no sources enabled → `failed` (catalog unchanged)

### CatalogPipelineMergeDecision (new)

Audit of merge for a variety in a run. Not shown to gardeners.

| Field | Type | Rules |
|-------|------|-------|
| run_id | UUID | FK → catalog_pipeline_runs ON DELETE CASCADE |
| variety_key | string | required |
| contributing_sources | string[] | source ids that supplied a record |
| field_winners | jsonb | map of catalog field → winning source_id |

**Constraints**: UNIQUE `(run_id, variety_key)`.

Do not store raw source payloads.

### CatalogPipelineSettings (new, singleton)

Operator-configured schedule and source order. One row (`id = 1`).

| Field | Type | Rules |
|-------|------|-------|
| id | int | PK, always 1 |
| cadence | enum | `daily` \| `disabled` |
| run_at_hour_utc | int | 0–23 |
| source_order | text[] | enabled source ids, **last wins** on conflicts |
| updated_at | timestamptz | required |
| updated_by_user_id | UUID \| null | FK → users; operator who last saved |

**Defaults**: `cadence = daily`, `run_at_hour_utc = 6`,
`source_order = ['fixture']` (seed). Operators MAY append a live source last
(e.g. `['fixture', 'perenual']`) when credentials exist. No auto-join on boot.

Unknown ids in `source_order` are ignored at run time with an operator-visible
note; they must not crash the run.

### User (existing)

`role` `user` \| `admin`. Only `admin` may read/write pipeline resources.

## Relationships

```text
Admin User ──starts/inspects──> CatalogPipelineRun
CatalogPipelineRun 1──* CatalogPipelineRunSource
CatalogPipelineRun 1──* CatalogPipelineMergeDecision
Plant 1──* CatalogPlantSource
PlantSourceRegistry (port adapters) ──fetch──> merge ──publish──> Plant
CatalogPipelineSettings ──drives──> scheduled CatalogPipelineRun
```

## Validation rules

- Unauthenticated pipeline requests: 401.
- Authenticated non-admin: 403 `Admin role required` (same string as 001 sync).
- Gardener `GET /api/plants` never starts a run or calls providers.
- `source_order` must be a non-empty array of non-empty strings after trim;
  duplicates collapsed preserving last occurrence.
- `run_at_hour_utc` integer 0–23.
- `cadence` only `daily` | `disabled`.
- Second start while `running`: 409 `A pipeline run is already running`.
- No enabled/registered sources: run `failed`, catalog unchanged, safe
  configuration error.
- Invalid source records (missing species/commonName): skip, increment
  rejected; do not abort the source if others are valid.

## State transitions

### CatalogPipelineRun.status

```text
(insert) → running
running → succeeded | failed | incomplete
running → failed     (process crash / stale sweep on boot)
```

Terminal states are immutable. A new run is a new row.

### Plant.status

```text
active → deprecated     (eligible absence after successful contributing sources)
deprecated → active     (same variety_key present in a later successful merge)
```

Never hard-delete plants from the pipeline (favorites/plantings FKs).

## Indexes

- UNIQUE `catalog_pipeline_runs (status) WHERE status = 'running'`
- INDEX `catalog_pipeline_runs (started_at DESC)`
- UNIQUE `catalog_pipeline_run_sources (run_id, source_id)`
- UNIQUE `catalog_pipeline_merge_decisions (run_id, variety_key)`
- UNIQUE `catalog_plant_sources (plant_id, source_id)`
- INDEX `catalog_plant_sources (source_id)`

## Merge algorithm (domain, not SQL)

Inputs: per-source lists of valid `ProviderPlant`, `sourceOrder` (low → high).

1. Key each record with existing `buildVarietyKey(species, cultivar)`.
2. For each variety, walk sources in order. For each mapped catalog field:
   if the incoming value is non-null, it becomes the current value and that
   source is recorded in `field_winners`.
3. Required identity: non-empty species and commonName after mapping; else
   reject the record.
4. Publish the merged map in one transaction as described in research.md.
