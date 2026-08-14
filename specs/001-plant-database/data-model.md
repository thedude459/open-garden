# Data Model: Plant Database

**Feature**: `001-plant-database` | **Date**: 2026-08-01  
**Spec**: [spec.md](./spec.md)

## Entities

### Plant

Local catalog entry for one garden variety.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK, generated |
| variety_key | string | UNIQUE, required; `normalize(species)\|normalize(cultivar\|'')` |
| common_name | string | required, non-empty |
| species | string | required, non-empty (botanical) |
| cultivar | string \| null | null when species-only |
| plant_type | enum | `vegetable` \| `herb` \| `flower` \| `fruit` \| `shrub` \| `tree` |
| zone_min | int | 1–13 inclusive; `zone_min` ≤ `zone_max` |
| zone_max | int | 1–13 inclusive |
| sun_requirements | string \| null | free text or controlled vocab later; null = unknown |
| water_needs | string \| null | null = unknown |
| days_to_maturity | int \| null | > 0 when set |
| spacing_inches | int \| null | > 0 when set (imperial product default) |
| provider | string \| null | adapter id, e.g. `perenual`, `fixture` |
| provider_external_id | string \| null | id at source for refresh |
| status | enum | `active` \| `deprecated` |
| created_at | timestamptz | required |
| updated_at | timestamptz | required |
| last_synced_at | timestamptz \| null | last successful provider upsert |

**Notes**:
- Zone filter: plant matches zone `Z` iff `zone_min <= Z <= zone_max`.
- Missing attributes stay null; UI shows “Unavailable” — never invent values.
- De-dupe: upsert on `variety_key`.

### Favorite

Per-user reference to a plant.

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → User; required |
| plant_id | UUID | FK → Plant; required |
| created_at | timestamptz | required |
| client_mutation_id | string \| null | optional idempotency from offline sync |

**Constraints**: UNIQUE `(user_id, plant_id)` — at most one favorite per user per plant.

### User (prerequisite / shared)

Minimal fields consumed by this feature (full auth model may live elsewhere):

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK |
| email | string | UNIQUE |
| display_name | string \| null | |
| role | enum | at least `user` \| `admin` (admin for operator sync) |
| created_at | timestamptz | |

### Session (prerequisite / shared)

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → User |
| token_hash | string | UNIQUE |
| expires_at | timestamptz | |
| created_at | timestamptz | |

### CatalogSyncRun (optional operational)

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | PK |
| triggered_by | enum | `operator` \| `miss_fill` (`schedule` deferred past v1) |
| provider | string | |
| started_at | timestamptz | |
| finished_at | timestamptz \| null | |
| status | enum | `running` \| `succeeded` \| `failed` |
| plants_upserted | int | default 0 |
| error_message | string \| null | safe, no secrets |

## Relationships

```text
User 1──* Favorite *──1 Plant
User 1──* Session
Admin User ──triggers──> CatalogSyncRun
PlantDataProvider (port) ──upserts──> Plant
```

## Validation rules

- Unauthenticated requests: reject catalog and favorites (401).
- Favorites: `user_id` always from session; never accept alternate owner in body.
- Plant create/update from provider path only (no end-user plant CRUD in this feature).
- Search `q`: trim; empty ⇒ browse; escape LIKE wildcards in user input.
- Pagination: `page >= 1`; `1 <= pageSize <= 100`; default pageSize 20.
- Deprecated plants: remain readable if favorited; list browse default excludes
  `deprecated` unless explicitly requested (favorites may still show with
  unavailable indicator).

## State transitions

### Plant.status

- `active` → `deprecated` (sync marks removed/unavailable at source)
- `deprecated` → `active` (reappears at source)

### Favorite

- Absent → Present: add (idempotent if already present)
- Present → Absent: remove (idempotent if already absent)
- Offline pending ops coalesce to last intent per `(user, plant)` before sync

## Indexes (planned)

- UNIQUE `plants.variety_key`
- INDEX `(plant_type)`, `(zone_min, zone_max)`, GIN/trigram optional later on names
- UNIQUE `favorites (user_id, plant_id)`
- INDEX `favorites.user_id`
