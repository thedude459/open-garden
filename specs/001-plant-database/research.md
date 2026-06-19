# Research: Plant Database

**Date**: 2026-06-12 | **Plan**: [plan.md](./plan.md)

## 1. External Plant Data Providers

### Decision: Dual-provider ingest — Trefle (primary taxonomy) + Perenual (care enrichment)

**Rationale**: Trefle offers strong botanical taxonomy, common names, family/class
data, and growth habit metadata via a well-documented REST API with pagination.
Perenual supplements with care-level guides (watering, sunlight), hardiness, and
edible-garden-oriented entries. Neither provides companion planting, incompatible
relationships, or rootstock spacing — those remain curated reference data.

**Alternatives considered**:
- **USDA PLANTS Database**: Authoritative but no modern REST API; bulk CSV only;
  poor fit for scheduled sync pipeline.
- **Trefle only**: Missing care-guide depth and some edible-crop maturity data.
- **Perenual only**: Weaker taxonomy normalization; smaller botanical coverage.

**Field mapping strategy**:
| FR-004 Field | Primary Source | Fallback |
|--------------|----------------|----------|
| Botanical/common names | Trefle | Perenual |
| Varietal information | Perenual common_name variants | Manual curation flag |
| Days to maturity | Perenual (harvest_time) | Curated override table |
| Seed-start/transplant/direct-seed windows | Curated + Perenual hardiness | Climate engine (future) |
| Spacing requirements | Curated reference | Perenual spacing (sparse) |
| Watering needs | Perenual watering | — |
| Fertilizer needs | Perenual (filtered organic-only) | — |
| Pest/disease notes | Perenual disease/pests arrays | — |
| Harvest window | Perenual harvest_season | — |
| Companions/incompatibles | **Curated reference only** | — |
| Rootstock/mature size | **Curated reference only** | — |

## 2. Framework & Runtime

### Decision: Next.js 15 App Router (full-stack)

**Rationale**: User-specified stack. App Router provides API routes, server
components for initial catalog pages, and middleware for auth gating. Single
deployable unit simplifies the greenfield repo.

**Alternatives considered**:
- **FastAPI + React SPA**: Strong for Python ML pipelines but user chose Next.js.
- **Separate NestJS API**: Unnecessary complexity for current scope.

## 3. Database ORM

### Decision: Drizzle ORM + PostgreSQL 16

**Rationale**: Type-safe schema co-located with TypeScript; lightweight migrations;
good JSONB support for provider raw payloads and partial field storage.

**Alternatives considered**:
- **Prisma**: Heavier migration model; equivalent capability but Drizzle fits
  script-based sync jobs better.

## 4. Authentication

### Decision: Auth.js (NextAuth v5) Credentials provider with bcrypt password hashing

**Rationale**: Native Next.js integration; email/password per spec (FR-012b/c);
session JWT stored in HTTP-only cookie; middleware protects `(catalog)` routes.

**Alternatives considered**:
- **Lucia**: Lighter but more manual setup for credentials flow.
- **Clerk/Auth0**: External dependency; overkill for minimal auth scope.

## 5. Organic Fertilizer Filtering

### Decision: Rule-based ingestion filter with deny-list + keyword classifier

**Rationale**: Per FR-017 and Principle IV. Pipeline stage after Perenual extract:
1. Deny-list known synthetic/harmful inputs (e.g., "10-10-10", "ammonium nitrate",
   "glyphosate", "systemic pesticide").
2. Allow-list organic patterns (compost, fish emulsion, kelp, bone meal, etc.).
3. If only non-organic content remains → store `null` with `fertilizer_data_gap` flag.

**Alternatives considered**:
- **LLM classification**: Non-deterministic; harder to test; rejected for ingestion.
- **Store-and-flag**: Rejected — violates Principle IV if displayed downstream.

## 6. Curated Reference Data

### Decision: Versioned JSON seed files loaded into Postgres reference tables;
admin-editable via future tooling

**Rationale**: Companion/incompatible and rootstock data are owned reference
data, not pipeline targets. Initial launch seeds ~200 common edible species
relationships sourced from established companion-planting references (e.g.,
Carrots Love Tomatoes pairings, extension service guides).

**Schema**: `plant_relationships` (source_plant_id, target_plant_id, type:
companion|incompatible) and `rootstock_options` (plant_id, name, vigor,
mature_height_cm, mature_spread_cm, spacing_cm).

**Stub plant behavior (FR-006a)**: When curated data references a plant not yet
in `canonical_plants`, ingest creates a `canonical_plants` row with
`record_status = stub` (name + category only).

## 7. Offline Cache Architecture

### Decision: Service worker + IndexedDB scoped subset cache

**Rationale**: User direction. Online: all search/browse/detail hits Next.js API
routes querying Postgres. Offline: service worker intercepts GET requests for
plant detail and search within cached ID set; returns from IndexedDB.

**Cache scope**:
- `user_garden_plant_refs` — plant IDs linked to user's garden (stub table until
  garden layout feature; manually pin-able in v1 for testing)
- `user_recently_viewed` — last 50 plant detail views per user (server-tracked)
- Cache bundle API returns full merged records (canonical + reference + user
  provisional overlay) for those IDs

**Alternatives considered**:
- **Full catalog IndexedDB**: Rejected — see Complexity Tracking in plan.md.
- **Cache API only (no service worker)**: Insufficient for offline intercept of
  navigation requests.

## 8. Climate Filtering

### Decision: USDA hardiness zone overlap + frost-date window check using
Open-Meteo Geocoding + derived zone from postal code

**Rationale**: FR-010 hard-exclude. Store resolved zone + frost dates on
`user_locations`. Filter applied server-side in search query: exclude plants
where `plant_hardiness_min_zone > user_zone` OR planting windows don't overlap
local frost-free period.

**Alternatives considered**:
- **Client-only filter**: Rejected — inconsistent with server-side search model.
- **ZIP→zone lookup table**: Acceptable fallback embedded in DB for offline
  climate context on cached plants only.

## 9. Provisional Plant Linking

### Decision: Field-level merge with provenance tracking

**Rationale**: FR-014a. On user-confirmed link:
1. Match score via normalized common name + category fuzzy match after sync.
2. Merge: for each field, if provisional has value AND canonical is null → keep
   provisional; else canonical wins.
3. Set `linked_canonical_id`, `record_status = linked_provisional`, notify user.

**Alternatives considered**:
- **Replace provisional entirely**: Rejected per spec clarification session.

## 10. Scheduled Sync

### Decision: Daily cron invoking `scripts/sync-plants.ts`; idempotent upsert by
provider external ID

**Rationale**: FR-011. Tracks `catalog_sync_runs` table. On failure, serve stale
catalog. Post-sync job scans provisionals for new canonical matches and queues
user notifications.

**Rate limits**: Trefle free tier 120 req/min; batch with backoff. Perenual
similar; paginate and checkpoint progress in sync state table.
