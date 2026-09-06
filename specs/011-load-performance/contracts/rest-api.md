# REST API

**Feature**: `011-load-performance`

No new HTTP paths, methods, or status codes. AuthZ unchanged (session cookie; garden membership; signed-in catalog). Error envelope unchanged.

Shared types in `libs/shared-types` are source of truth.

## `GET /api/gardens`

Query unchanged: `page`, `pageSize` (default 20, max 100).

**Change**: Each item includes `bedCount` and `placementCount` (integers ≥ 0).

Assembly MUST use a **constant** number of count lookups for the page (batched aggregates keyed by the page’s garden ids). MUST NOT query counts once per garden.

Handlers SHOULD log `garden.list.assembly_ms` (payload assembly only). Automated checks fail if assembly of a **20-garden** page is ≥ 1000ms or if count lookups grow with garden count.

Viewers receive the same counts as owners for gardens they belong to.

## `GET /api/gardens/:id`

**Change**: Response includes `bedCount` and `placementCount` (inherited from `GardenSummaryDto`). Same meanings as list. Single-garden aggregate, not a list N+1.

Permissions unchanged.

## `GET /api/gardens/:id/layout`

**No JSON shape change.** Spacing remains on each planting from the existing plants join. Canopy is **not** a new field; clients keep deriving footprint from `spacingInches` (existing `plantingFootprintRadius`).

Assembly MUST NOT look up spacing or plants one placement at a time. Handlers SHOULD log `garden.layout.assembly_ms`. Automated checks fail if assembly for a **100-placement** garden is ≥ 1000ms or if per-placement lookups return.

PUT layout is unchanged (out of scope for this feature’s load budgets).

## `GET /api/plants`

Query unchanged: `q`, `zone`, `plantType`, `page`, `pageSize`. Admission unchanged (010: no unknown spacing).

**Change**: Each item includes `illustrationUrl: string | null`.

Clients MUST NOT follow up with per-result **data** GETs (e.g. `GET /api/plants/:id`) to discover illustration location or other list identity fields. Browser GETs of `illustrationUrl` picture files are allowed and are not data-request regressions.

Miss-fill on empty name search MUST batch upserts (one multi-row write), then re-list. Handlers SHOULD log `plants.list.assembly_ms`.

`GET /api/plants/:id` MAY include `illustrationUrl` for consistency (`PlantDetailDto` extends summary minus spacing). Clients of list/search MUST NOT need it.

## AuthZ

Unchanged. Batching MUST NOT return another household’s gardens, counts, or plantings.
