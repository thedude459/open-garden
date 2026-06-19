# Data Model: Plant Database

**Date**: 2026-06-12 | **Plan**: [plan.md](./plan.md)

## Overview

Three data layers:

1. **Canonical plants** — synced from Trefle/Perenual, normalized in Postgres
2. **Reference data** — curated companions, incompatibles, rootstock (owned, not synced)
3. **User data** — accounts, locations, provisionals, cache manifests

Client offline cache (IndexedDB) mirrors a **merged projection** of layers 1–3
for a scoped plant ID set only.

## Entity Relationship Diagram

```text
users ─────────────┬── user_locations
                   ├── user_provisional_plants ──► canonical_plants (linked)
                   ├── user_recently_viewed ────► canonical_plants
                   └── user_garden_plant_refs ──► canonical_plants

canonical_plants ◄── plant_relationships (source/target)
canonical_plants ◄── rootstock_options

canonical_plants ── provider_plant_sources (trefle|perenual external IDs)
catalog_sync_runs (job metadata)
```

## Tables

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | VARCHAR UNIQUE NOT NULL | |
| password_hash | VARCHAR NOT NULL | bcrypt |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `user_locations`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users UNIQUE | one location per user (v1) |
| city_or_postal | VARCHAR NOT NULL | |
| latitude | DECIMAL | geocoded |
| longitude | DECIMAL | geocoded |
| usda_zone | SMALLINT | resolved zone |
| last_frost_date | DATE | spring |
| first_frost_date | DATE | fall |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `canonical_plants`

Core catalog record. Includes authoritative and stub plants.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| record_status | ENUM | `authoritative`, `stub`, `merged` |
| botanical_name | VARCHAR | |
| common_name | VARCHAR NOT NULL | indexed |
| variety | VARCHAR | |
| plant_category | ENUM | vegetable, herb, fruit, berry, fruit_tree, nut_tree, shrub, cover_crop, companion_flower, guild_plant |
| days_to_maturity | SMALLINT | nullable |
| seed_start_window | JSONB | `{start_week, end_week}` relative or absolute |
| transplant_rules | JSONB | |
| direct_seed_rules | JSONB | |
| spacing_cm | JSONB | `{row, plant}` |
| sun_exposure | ENUM | full, partial, shade |
| watering_needs | JSONB | `{frequency, amount}` normalized |
| fertilizer_needs | TEXT | organic-only after filter; null if gap |
| fertilizer_data_gap | BOOLEAN DEFAULT false | |
| pest_disease_notes | JSONB | array of strings |
| harvest_window | JSONB | |
| hardiness_min_zone | SMALLINT | for climate filter |
| hardiness_max_zone | SMALLINT | |
| data_completeness | JSONB | field-level gap flags |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes**: GIN on `common_name` (trigram), `botanical_name`, `plant_category`

### `provider_plant_sources`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| plant_id | UUID FK → canonical_plants | |
| provider | ENUM | `trefle`, `perenual` |
| external_id | VARCHAR NOT NULL | |
| raw_payload | JSONB | audit/debug |
| last_synced_at | TIMESTAMPTZ | |
| UNIQUE(provider, external_id) | | |

### `plant_relationships` (curated reference)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| source_plant_id | UUID FK → canonical_plants | |
| target_plant_id | UUID FK → canonical_plants | stub created if missing |
| relationship_type | ENUM | `companion`, `incompatible` |
| source | ENUM | `curated` (always v1) |
| notes | TEXT | optional |
| UNIQUE(source_plant_id, target_plant_id, relationship_type) | | |

### `rootstock_options` (curated reference)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| plant_id | UUID FK → canonical_plants | tree records |
| name | VARCHAR NOT NULL | e.g., "M.9", "MM.111" |
| vigor | ENUM | dwarf, semi_dwarf, standard, vigorous |
| mature_height_cm | SMALLINT | |
| mature_spread_cm | SMALLINT | |
| spacing_cm | SMALLINT | recommended tree spacing |
| notes | TEXT | |

### `user_provisional_plants`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| common_name | VARCHAR NOT NULL | |
| plant_category | ENUM | required |
| spacing_cm | JSONB | required |
| days_to_maturity | SMALLINT | required |
| optional_fields | JSONB | all other FR-004 fields |
| linked_canonical_id | UUID FK → canonical_plants NULL | set after merge |
| link_status | ENUM | `provisional`, `link_offered`, `linked` |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `user_recently_viewed`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| plant_id | UUID FK → canonical_plants | |
| viewed_at | TIMESTAMPTZ | |
| UNIQUE(user_id, plant_id) | | upsert on view |

### `user_garden_plant_refs`

Placeholder for garden layout feature; v1 supports manual pins for offline cache.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| plant_id | UUID FK → canonical_plants | |
| pinned_at | TIMESTAMPTZ | |
| UNIQUE(user_id, plant_id) | | |

### `catalog_sync_runs`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| status | ENUM | running, success, failed |
| provider | ENUM | trefle, perenual, reference_seed |
| records_upserted | INT | |
| error_message | TEXT | |

## Merged Plant Projection (API / offline cache)

API and IndexedDB store a **PlantDetail** projection combining:

```typescript
interface PlantDetail {
  id: string
  provenance: 'authoritative' | 'stub' | 'provisional' | 'linked_provisional'
  // ... all FR-004/005 fields
  companions: PlantRef[]      // from plant_relationships
  incompatibles: PlantRef[]
  rootstocks: RootstockOption[]  // from rootstock_options
  field_gaps: string[]        // from data_completeness
}
```

## State Transitions

### Provisional plant lifecycle

```text
provisional → link_offered (sync finds match) → linked (user confirms merge)
                     ↓
              provisional (user declines — stays separate)
```

### Canonical plant lifecycle

```text
(stub) → authoritative (provider sync enriches stub)
authoritative → authoritative (upsert refresh)
```

## Validation Rules

- Provisional create: `common_name`, `plant_category`, `spacing_cm`, `days_to_maturity` required
- Relationship insert: both source and target must resolve to plant IDs (create stub if needed)
- Fertilizer: reject non-organic at ingestion; never persist denied content
- Climate filter: exclude when `hardiness_min_zone > user.usda_zone` OR planting window disjoint from frost-free period
- Search (online): server-side only; results include user's provisionals merged in unified index per user

## IndexedDB Schema (client)

| Store | Key | Value |
|-------|-----|-------|
| `plants` | plant_id | PlantDetail JSON |
| `cache_meta` | `manifest` | `{ plant_ids[], synced_at, server_version }` |
| `search_index` | plant_id | `{ common_name, category }` (scoped subset only) |

Service worker refreshes cache on sign-in and when manifest version changes.
