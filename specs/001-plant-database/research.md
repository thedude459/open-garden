# Research: Plant Database

**Feature**: `001-plant-database` | **Date**: 2026-08-01

## 1. API host framework

**Decision**: NestJS as `apps/api` host, with domain logic in Nx libs (not
Nest-only modules as the sole boundary).

**Rationale**: Strong Nx generator support alongside Angular, first-class
dependency injection for wiring provider adapters and auth guards, and clear
controller thinness so library-first constitution is preserved.

**Alternatives considered**:
- **Fastify/Express bare**: Fewer dependencies, but more manual wiring for
  guards/validation; acceptable later if Nest proves heavy.
- **tRPC / GraphQL**: Forbidden by constitution without amendment.

## 2. ORM / migrations

**Decision**: Drizzle ORM + Drizzle Kit migrations against PostgreSQL.

**Rationale**: SQL-first, excellent TypeScript inference without `any`, light
runtime, migrations as code — fits YAGNI and constitution migration rule.
Enough for household scale (thousands of plants).

**Alternatives considered**:
- **Prisma**: Excellent DX; heavier client and historically more magic around
  types — fine alternative if team prefers; defer unless Drizzle friction.
- **TypeORM**: Weaker type story; avoid.
- **Raw `pg`**: Too little structure for multi-entity authZ queries.

**ADR**: `docs/adr/0001-orm-drizzle.md` (to be authored at implement).

## 3. Plant provider port & first adapter

**Decision**: Define `PlantDataProvider` port in `libs/plant-provider` with:
1. `FixturePlantProvider` — deterministic seed/CI/dev data
2. `HttpPlantProvider` — one concrete HTTP adapter (Perenual as first target)
   behind env-configured base URL/API key

Catalog domain (`libs/plant-catalog`) depends only on the port. Sync job and
on-demand miss-fill call the port, map to garden-variety identity, upsert into
PostgreSQL.

**Rationale**: Constitution requires swappable providers; fixture adapter
unblocks development without vendor credentials; Perenual offers garden-relevant
attributes and a usable free tier for self-hosted hobby use.

**Alternatives considered**:
- **Trefle**: Often rate-limited / unstable historically.
- **USDA PLANTS**: Strong taxonomy, weaker “days to maturity / spacing” for
  vegetables — better as a later secondary adapter.
- **Provider-only live queries**: Violates “lookups from local catalog.”

**ADR**: `docs/adr/0003-plant-provider-port.md`.

## 4. Hybrid sync strategy

**Decision**:
- **Baseline (v1)**: Operator-triggered job only — `POST /api/admin/plants/sync`
  and/or CLI — pulls a bounded set from the provider and upserts by variety key.
  Scheduled/cron sync is deferred (YAGNI).
- **Miss-fill**: On authenticated `GET /api/plants` with `q=` and zero local
  hits, invoke provider search once, upsert matches, re-query local DB, return
  local results. If provider fails, return empty list (same UX as miss).
- **Browse without `q`**: Local DB only — never call provider for default pages.

**Rationale**: Matches clarification hybrid fill with operator baseline; keeps
default browse fast; avoids cron complexity until needed.

**Alternatives considered**: Fetch-on-every-request (rejected by FR-008);
sync-only with no miss-fill (worse empty-catalog UX); scheduled cron in v1
(deferred).

## 5. Garden variety identity / de-duplication

**Decision**: Canonical key =
`normalize(species) + '|' + normalize(cultivarOrEmpty)`.
Store `variety_key` unique in DB; also store optional `provider` +
`provider_external_id` for refresh mapping. Upsert on `variety_key`.

**Rationale**: Spec requires species+cultivar variety identity; provider IDs
alone allow duplicates across sources.

**Alternatives considered**: Provider ID as sole PK (duplicates across vendors);
species-only (collapses cultivars).

## 6. Auth for catalog & favorites

**Decision**: Session-based auth (HTTP-only secure cookie) with server-side
session store in PostgreSQL for self-hosted multi-user. All `/api/plants*` and
`/api/favorites*` routes require authenticated user. Favorites queries always
scoped by `user_id` from session — never from client-supplied owner id.

**Rationale**: Fits PWA + self-hosted; avoids long-lived tokens in JS storage;
aligns with multi-user first-class authZ. Minimal auth bootstrap is a
prerequisite for this feature if not already present.

**Alternatives considered**: JWT in localStorage (XSS risk for PWA); API keys
per household (weaker per-user favorites isolation).

**ADR**: `docs/adr/0002-auth-sessions.md`.

## 7. Offline favorites queue

**Decision**: Angular service persists pending `{op, plantId, clientMutationId,
updatedAt}` in IndexedDB; UI reads merged view (server favorites ⊕ pending).
On `online`, drain queue via REST `PUT/DELETE` idempotent endpoints keyed by
plant id; show pending badge until ack.

**Rationale**: Spec chose offline queue; client-side queue is simplest for v1
without introducing a sync protocol framework.

**Alternatives considered**: Require online (rejected); CRDT library (YAGNI);
Service Worker Background Sync only (still need IndexedDB + same REST).

## 8. Pagination default

**Decision**: Default `pageSize=20`, max `100`; `page` 1-based; response includes
`totalCount` for UI pager.

**Rationale**: Spec deferred page size to planning; 20 is standard for browse
lists on mobile/desktop without over-fetch.

## 9. Search behavior

**Decision**: Case-insensitive substring match across `common_name`, `species`,
`cultivar` (ILIKE / `trigram` optional later). Empty/whitespace `q` treated as
browse (no name filter). Minimum meaningful query length: 1 character after
trim; special characters escaped for LIKE.

**Rationale**: Partial match required by FR-001; keep v1 simple without full-text
engine until catalog size demands it.

## 10. Testing approach

**Decision**: Vitest unit tests in each lib (≥80%); Nest/API integration tests
with Testcontainers or Compose Postgres; Playwright flows for browse/search,
filter, favorite offline→online. Fixture provider for deterministic data.

**Rationale**: Constitution testing gates.

## Resolved Technical Context unknowns

| Topic | Resolution |
|-------|------------|
| Performance goals | <2s first page local; <500ms offline favorite apply |
| Scale/Scope | Household; ~thousands of varieties; page size 20 |
| Backend framework | NestJS host + domain libs |
| ORM | Drizzle + migrations |
| First provider | Port + Fixture + Perenual HTTP adapter |
| Auth | HTTP-only session cookies; auth-gated catalog |
| Offline favorites | IndexedDB queue + idempotent REST sync |
