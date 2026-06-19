# Contract: Offline Cache (Service Worker + IndexedDB)

**Version**: 1.0

## Overview

Offline access is limited to a **scoped plant subset**, not the full catalog.
Online search always uses `/api/plants/search` against Postgres.

Offline capability applies to:
- Plants in `user_garden_plant_refs` (pinned / future garden associations)
- Plants in `user_recently_viewed` (last 50)
- User's provisional plants

## GET `/api/users/me/cache/manifest`

Returns plant IDs the client should cache offline.

**Response 200**:

```json
{
  "plant_ids": ["uuid", "uuid"],
  "provisional_ids": ["uuid"],
  "version": "2026-06-12T12:00:00Z",
  "count": 23
}
```

Client compares `version` with IndexedDB `cache_meta.manifest.version`; refreshes
bundle if changed.

## GET `/api/users/me/cache/bundle`

Returns full `PlantDetail` objects for all manifest IDs.

**Query**: `?since=<version>` — optional incremental fetch

**Response 200**:

```json
{
  "plants": [ /* PlantDetail[] */ ],
  "version": "2026-06-12T12:00:00Z"
}
```

## Service Worker Behavior (`public/sw.js`)

### Install / activate

Register on app load after successful sign-in.

### Cache refresh triggers

1. First sign-in (manifest empty)
2. Manifest version change (poll on app focus + post-login)
3. User views new plant detail (debounced manifest refresh)

### Request interception

| Request | Online | Offline |
|---------|--------|---------|
| `GET /api/plants/search` | Network | **503** with `{ offline: true, cached_ids_only: true }` — UI shows offline banner; scoped search within IndexedDB only |
| `GET /api/plants/:id` | Network (update cache) | IndexedDB hit if ID in manifest; else 404 offline |
| `GET /api/users/me/cache/*` | Network | Blocked until online |

### Scoped offline search

Service worker or client-side code searches IndexedDB `search_index` store
(only manifest plant IDs). Results annotated with `{ offline: true }`.

**Spec note**: SC-003 satisfied for scoped subset — full catalog search requires
network per plan deviation from FR-011a.

## IndexedDB Stores

See [data-model.md](../data-model.md#indexeddb-schema-client).

## UX Requirements

- Show offline banner when `navigator.onLine === false`
- Indicate stale cache age from `cache_meta.manifest.synced_at`
- Disable climate filter offline if location not cached locally (location
  cached in IndexedDB `cache_meta.user_location` on successful fetch)
