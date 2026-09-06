# REST API

**Feature**: `010-fix-planner-placement`

No new HTTP paths, methods, or status codes. Layout, plantings, auth, and garden contracts remain those of features 001–008.

## Behavior change: catalog list and intake

### `GET /api/plants`

Query unchanged: `q`, `zone`, `plantType`, `page`, `pageSize`.

**Change**: Items with unknown/missing spacing MUST NOT appear. `totalCount` counts only admitted plants.

Name search with **zero local admitted hits** still **miss-fills** via the plant-provider abstraction (`CatalogService.list`). Provider hits without spacing MUST NOT be upserted or listed. If still empty: `200` with `items: []` (same as today).

### Sync / import (existing operator sync)

Provider items with `spacingInches == null` MUST be **skipped** (not counted as a successful catalog plant). Existing null-spacing rows MUST NOT be deleted.

### `GET /api/plants/:id`

Unchanged. May still return `spacingInches: null` for leftover rows (existing plantings / detail).

### Gardens / layout (unchanged)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/gardens/:id` | Includes `hardinessZone` for Bed View climate default |
| GET/PUT | `/api/gardens/:id/layout` | Same PUT; new direct seeds are ordinary `direct_seed` placements |
| POST | `/api/gardens/:id/plantings` | Existing create used when Save persists new draft seeds (008 planner-save) |

PUT layout still **422** `Layout has spacing or fit problems` for blocking flags on the **stored** plan. Catalog-from-panel **rejects** happen **client-side** before a planting exists; they do not invent a new error code.

## AuthZ

Unchanged: garden membership for layout; signed-in catalog for `GET /api/plants`.
