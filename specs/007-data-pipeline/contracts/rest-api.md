# Catalog Data Pipeline API Contracts

**Base path**: `/api`  
**Auth**: Session cookie (`og_session`, SameSite=Lax). `SessionGuard` uses
`@Inject(AuthService)`. Pipeline routes additionally require `user.role ===
'admin'`.  
**Content-Type**: `application/json`  
**Shared types**: `libs/shared-types` (source of truth; this file is the human
contract)

Error shape matches 001–006:
`UNAUTHORIZED` | `FORBIDDEN` | `NOT_FOUND` | `VALIDATION_ERROR` | `CONFLICT` | `INTERNAL`.

### Pipeline error messages

Clients MUST surface these `error.message` strings.

| Code | When | Message |
|------|------|---------|
| `FORBIDDEN` | Authenticated non-admin hits pipeline routes | `Admin role required` |
| `CONFLICT` | Start while a run is `running` | `A pipeline run is already running` |
| `VALIDATION_ERROR` | Bad settings body | `Invalid pipeline settings` |
| `NOT_FOUND` | Unknown run id | `Pipeline run not found` |

Gardener catalog errors are unchanged from 001.

---

## Retired

### POST /api/admin/plants/sync

**Removed.** Do not keep a compatibility alias. Admin clients use pipeline
runs. `npm run api:sync-plants` calls the pipeline service directly (not this
HTTP path).

### GET /api/plants miss-fill

`GET /api/plants` is **local catalog only**. A name search with zero local
hits MUST NOT call `PlantDataProvider.searchByName`. Empty list is the empty
state.

---

## Types

See [shared-types.ts.md](./shared-types.ts.md).

`PipelineRunStatus`: `running` | `succeeded` | `failed` | `incomplete`  
`PipelineTriggeredBy`: `operator` | `schedule`  
`PipelineSourceStatus`: `succeeded` | `failed`  
`PipelineCadence`: `daily` | `disabled`

---

## POST /api/admin/pipeline/runs

Start an on-demand full load of every source in current `sourceOrder`.

**Auth**: required + `admin`

### Body

Empty object `{}` or omitted. No `limit`. No `provider` override (use
settings).

### Response 202

```json
{
  "id": "uuid",
  "status": "running",
  "triggeredBy": "operator",
  "startedAt": "2026-08-18T10:00:00.000Z",
  "finishedAt": null,
  "plantsUpserted": 0,
  "plantsDeprecated": 0,
  "plantsReactivated": 0,
  "recordsRejected": 0,
  "errorMessage": null,
  "sources": []
}
```

Ingest continues in-process. Poll GET by id.

### Errors

- `401`
- `403` `Admin role required`
- `409` `A pipeline run is already running`

---

## GET /api/admin/pipeline/runs

List recent runs, newest first.

**Auth**: required + `admin`

### Query

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| page | int | 1 | 1-based |
| pageSize | int | 20 | max 100 |

### Response 200

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "totalCount": 0
}
```

Each item is a `PipelineRunSummaryDto` (no merge decisions).

### Errors

- `401` / `403`

---

## GET /api/admin/pipeline/runs/:id

Run detail including per-source results. Merge decisions MAY be included as a
compact list (varietyKey + fieldWinners) for operator audit; omit raw payloads.

**Auth**: required + `admin`

### Response 200

`PipelineRunDetailDto`

### Errors

- `401` / `403`
- `404` `Pipeline run not found`

---

## GET /api/admin/pipeline/settings

**Auth**: required + `admin`

### Response 200

```json
{
  "cadence": "daily",
  "runAtHourUtc": 6,
  "sourceOrder": ["fixture"],
  "registeredSources": ["fixture", "fixture-b"]
}
```

`registeredSources` is the ids the process can actually construct (Perenual
appears only when an API key is configured). Never returns the key.

### Errors

- `401` / `403`

---

## PATCH /api/admin/pipeline/settings

**Auth**: required + `admin`

### Body

All fields optional; omitted keys stay unchanged.

```json
{
  "cadence": "daily",
  "runAtHourUtc": 6,
  "sourceOrder": ["fixture", "fixture-b"]
}
```

### Response 200

Same shape as GET settings.

### Errors

- `401` / `403`
- `400` `Invalid pipeline settings`

---

## Gardener catalog (unchanged paths, changed behavior)

`GET /api/plants`, `GET /api/plants/:id`, favorites: still session-required.
Lookups MUST NOT invoke plant providers. Admin pipeline routes MUST NOT appear
on gardener pages.

---

## PlantDataProvider port (internal, unchanged HTTP-wise)

Still `libs/plant-provider`. Pipeline depends on the port + registry only.
`listPage` is the full-load primitive. Mapping to `variety_key` and merge
happen in `libs/catalog-pipeline`, never in Angular or Nest controllers
calling vendor URLs.
