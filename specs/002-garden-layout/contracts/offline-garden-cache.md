# Contract: Offline Garden Cache

**Version**: 1.0 | **Extends**: [001 offline-cache.md](../../001-plant-database/contracts/offline-cache.md)

## Overview

Offline garden layout follows the same server-authoritative, client-cache pattern
as the plant catalog. Users can view and edit cached gardens offline; mutations
queue locally and replay on reconnect with optimistic concurrency checks.

## Manifest Extension

`GET /api/users/me/cache/manifest` response adds:

```json
{
  "plant_ids": ["uuid"],
  "provisional_ids": ["uuid"],
  "garden_ids": ["uuid"],
  "garden_versions": { "uuid": 3 },
  "version": "2026-06-19T12:00:00Z",
  "count": 23
}
```

All user gardens are included in `garden_ids` (typically small cardinality for
home gardeners). Plant IDs from garden placements and active indoor starts merge
into `plant_ids` for spacing data offline access.

## Bundle Extension

`GET /api/users/me/cache/bundle` response adds:

```json
{
  "plants": [ /* PlantDetail[] */ ],
  "gardens": [ /* GardenDetail[] */ ],
  "version": "2026-06-19T12:00:00Z"
}
```

## IndexedDB Stores

| Store | Key | Value |
|-------|-----|-------|
| `gardens` | garden_id | `GardenDetail` snapshot |
| `garden_sync_queue` | auto-increment | `{ op, payload, expected_version, created_at }` |

Existing `plants`, `cache_meta` stores unchanged from Feature 001.

## Offline Behavior

| Action | Offline (cached) | Offline (not cached) |
|--------|------------------|----------------------|
| View garden list | ✅ from IndexedDB | ❌ banner |
| View garden layout | ✅ | ❌ |
| Edit beds/paths | ✅ queued | ❌ |
| Place plant (cached plant) | ✅ validate locally, queue save | ❌ |
| Place plant (uncached plant) | ❌ message | ❌ |
| Indoor start (cached plant) | ✅ queued | ❌ |
| Transplant | ✅ validate locally, queue save | ❌ |

## Sync on Reconnect

1. Client drains `garden_sync_queue` in FIFO order
2. Each operation sends `expected_version` from queue entry
3. On `409 Conflict`: pause queue, show conflict dialog (review / discard / overwrite)
4. On success: update local `gardens` store with response snapshot
5. Refresh manifest if `garden_versions` changed

## Service Worker

Extend `public/sw.js`:

- Cache `GET /api/gardens` and `GET /api/gardens/:id` when online (stale-while-revalidate)
- Serve from IndexedDB `gardens` store when offline
- Do NOT intercept mutating garden routes offline — client app handles queue

## Validation Offline

Client imports `lib/garden/geometry.ts` and spacing/incompatibility pure functions
from `lib/garden/validation.ts` for instant feedback. Queued saves re-validate
server-side on replay.
