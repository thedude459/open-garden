# Research: Load Performance

**Feature**: `011-load-performance` | **Date**: 2026-08-23

## 1. Garden-list counts (today they are missing)

**Decision**: Add `bedCount` and `placementCount` to `GardenSummaryDto` and fill them with **one batched lookup per count type** for the page of garden ids (or a single SQL with two aggregates). Do **not** issue `COUNT` per garden.

Current `GardenRepository.listForUser` joins memberships + gardens (page query + total). `GardenService.list` maps id/name/zone/role only. The spec **adds** `bedCount` / `placementCount` on the list (and on `GardenDetailDto` because it extends the summary) and gathers them without N+1.

**Count rules**:

| Field | Meaning |
|-------|---------|
| `bedCount` | `COUNT(*)` of `garden_beds` for that garden (sized leftover-free rows after 0008) |
| `placementCount` | `COUNT(*)` of `garden_plantings` that are **placed** (`bed_id` and layout x/y all non-null). Tray-only transplants are **not** placements. |

Empty gardens return `0` / `0`, never omitted.

**Isolation**: `IN (page garden ids)` where those ids come only from the membership join for the current user. Never aggregate another household’s gardens.

**Rationale**: Existing indexes (`garden_beds_garden_id_idx`, `garden_plantings_garden_created_idx`) make `GROUP BY garden_id` cheap. Two extra queries for the whole page is constant in garden count.

**Alternatives considered**:

- Per-garden `COUNT` in a loop — violates FR-001.
- Denormalized counters on `gardens` — extra write path and stale-risk; YAGNI at household scale.
- JSON subquery in the list SELECT — harder to test; two GROUP BY queries are clearer and still O(1).

## 2. Overview / Bed View spacing and canopy

**Decision**: Keep **one** `listAllForLayout` join that already selects `plants.spacing_inches`. Derive canopy in memory with existing `plantingFootprintRadius` (half spacing, default 6 when spacing is null). Do **not** add a canopy column. Do **not** `getById` per planting.

`LayoutService` snapshot already `Promise.all`s beds + plantings + areas. Lock that with a Vitest that asserts `listAllForLayout` is called **once** per GET and that spacing/canopy work is a map over the joined rows, not a sequential plant lookup.

**Rationale**: Canopy is a function of spacing (010 footprint). A second “canopy lookup” would be invented work. FR-003 is satisfied by one join covering every placement plus in-memory derive.

**Alternatives considered**:

- Per-planting plant fetch — the N+1 the spec forbids.
- Persist `canopy_radius_inches` — duplicates spacing; migration without product need.

**In-scope leftover on these screens (FR-007)**: Overview and Bed View `load()` await `planner.load` then `gardensApi.detail` **in sequence** (two HTTP round-trips, not per planting). Overlap them with `Promise.all`. Do **not** fold garden name/zone into layout GET in this feature (extra contract churn; parallel GET is enough for the 2s interactive budget).

**Out of scope**: `LayoutService.put` still loops `setGeometry` / `setPlacement` / area upsert. That is **save**, not load.

## 3. Plant search illustration location

**Decision**: Add `illustrationUrl: string | null` on `PlantSummaryDto` (and thus detail, which omits only `spacingInches`). **No migration and no image pipeline.** Today every plant returns `null`; the client keeps the existing CSS `.plant-stand-in` keyed by `plantType`. Picture-file GETs are allowed later when a URL is present; extra **data** GETs per result are forbidden.

Do **not** extend `PlantDataProvider` with images in this feature (provider port has no illustration field; scraping Perenual would violate provider abstraction / YAGNI).

**Rationale**: Spec requires the location **on the result** so the client does not discover it via N detail requests. Null-on-the-DTO plus stand-in meets “when none exists.” Shipping a CDN or static SVG set per type is speculative art.

**Alternatives considered**:

- Client derives stand-in only (no DTO field) — fails FR-005 (“illustration location … in that one result set”).
- `plants.illustration_url` column now — unused; defer to a catalog-art feature.
- Type-keyed `/assets/plants/{plantType}.svg` as URL for every row — conflates stand-in with illustration; CSS stand-in already exists.

## 4. Miss-fill sequential upserts (search hot path)

**Decision**: Replace `for (const item of remote) await upsertByVarietyKey` in `CatalogService.list` with **one** `PlantRepository.upsertManyByVarietyKey` (multi-row `INSERT … ON CONFLICT`). Skip items with null spacing as today. Then one follow-up `list`.

**Rationale**: Empty-name-search miss-fill is on the plant-search load path (FR-007). `Promise.all` of N upserts is still N statements. One statement is the batched approach.

**Alternatives considered**: Leave the loop (linear in provider hits). Parallel `Promise.all` (still N round-trips to Postgres).

## 5. Regression gates: failing check **and** timings

**Decision**: Two layers, both required (FR-008 / SC-006):

1. **Query / request-count tests (must fail on N+1)**  
   - Vitest: garden list calls count aggregates **once** with the page ids (20-garden fixture vs 1-garden; call count identical aside from id list size).  
   - Vitest: layout GET / snapshot does not call plant `getById` in a loop; `listAllForLayout` once.  
   - Vitest: catalog list mapping does not fetch per id; miss-fill uses `upsertMany` once.  
   - Playwright: intercept **data** requests on Plants page and Bed View panel; `/api/plants/:id` (or equivalent) count must not grow with result count. Image requests ignored.

2. **Budgets with recorded timings**  
   - **Assembly &lt; 1s** (payload only): Vitest or `apps/api-e2e` against the test DB for `GardenService.list` (20 gardens) and `LayoutService.get` (100 placements). Log `garden.list.assembly_ms`, `garden.layout.assembly_ms`, `plants.list.assembly_ms` from the Nest handlers (or a thin wrapper) at info. Tests fail if assembly ≥ 1000ms.  
   - **Interactive ≤ 2s**: Playwright from navigation/search click until the screen is usable (list rows clickable, Overview/Bed View pan target visible, search results visible). Do **not** wait for images. Fail if elapsed &gt; 2000ms on the 20-garden / 100-placement / typical-search fixtures.

**Rationale**: Timings-only would pass a slow N+1 on a fast CI box until data grows. Count tests catch linear growth; wall-clock tests catch budget misses; logs make failures diagnosable.

**Alternatives considered**: APM-only (not a failing CI check). k6/load framework (overkill vs Vitest + Playwright already in CI).

## 6. Fixtures

**Decision**: Seed in tests, not a production migration.

- **20 gardens**: loop `GardenService.create` (or API) for one user; optional mix of owned + shared. Default list `pageSize` is 20 — one page.  
- **100 placements**: one sized bed; 100 `direct_seed` plantings with layout coords (API create + PUT layout, or repository inserts in api-e2e). Use a fixture plant with known spacing.  
- **Search page**: existing fixture catalog; assert ≥10 admitted results without extra data GETs.

## 7. Library-first layout (no new Nx project)

**Decision**: Batching lives in existing libs:

| Concern | Home |
|---------|------|
| Count aggregates | `libs/plant-catalog-data` (`GardenRepository` or a small counts helper used only by gardens) |
| List DTO mapping | `libs/gardens` |
| Layout join + snapshot | `libs/garden-layout` + `PlantingRepository.listAllForLayout` (audit only) |
| Footprint / canopy | existing `footprint.ts` |
| Miss-fill batch upsert | `libs/plant-catalog-data` + `CatalogService` |
| Shared DTOs | `libs/shared-types` |
| Timing logs | `apps/api` controllers (thin) |
| UI counts, `Promise.all` load, illustration-or-stand-in | `apps/web` standalone pages |

**ADR**: [0013](../../docs/adr/0013-load-performance.md).
