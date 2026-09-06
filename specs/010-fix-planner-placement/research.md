# Research: Fix Planner Placement

**Feature**: `010-fix-planner-placement` | **Date**: 2026-08-22

## 1. Pointer → plan inches (zoom/pan)

**Decision**: The canvas (`garden-plan-canvas.ts`) already maps pointer events with SVG `getScreenCTM()` + `createSVGPoint`. That is the **only** screen→plan mapping the UI may use. `clientToPlanWithPanScale` and `viewportCenterPlan` in `libs/garden-layout` assume CSS pan/scale/`pxPerInch` and **do not** match `viewBox` + `[style.transform]` on the SVG. Pages MUST NOT call those helpers for placement.

Library helpers take **plan inches already mapped**:

- `originFromCenter(dropX, dropY, length, width)` → rectangle origin (first-place / create-without-drop using `canvas.viewportCenterPlan()`).
- `originFromGrabOffset(startOrigin, grabStart, current)` → move existing bed/area (grab point stays under pointer).

Vitest those origin functions with known numbers. Do not try to unit-test `getScreenCTM` in Node.

**Rationale**: Dual formulas are why objects jump to garden center or ignore zoom. Create already subtracts half size from viewport center; move already stores origin + pointer start. The remaining bug is mixing CTM with pan-scale math (or treating origin as the drop point).

**Alternatives considered**:
- **Rewrite canvas in CSS pixels only**: Large change; viewBox already encodes plan inches.
- **Keep both mappers “in sync”**: Fragile; any viewBox padding would desync again.
- **Click-to-place after Create**: Forbidden by 008 / FR-003.

## 2. First-place vs move anchors

**Decision**: First appearance (**Create bed / Create area**, no palette drop) uses **center at the visible Overview viewport** (`originFromCenter(canvas.viewportCenterPlan(), length, width)`). Subsequent drag of an existing rectangle uses **grab-offset** (`origin += currentPlan − grabStartPlan`). No snap-to-center on release.

**Rationale**: Spec FR-001/FR-003. There is no structure-template palette. Center-snap on move makes a grabbed corner jump.

**Alternatives considered**: Always center (violates grab-offset). Always grab-offset for Create (create-without-drop has no grab).

## 3. Catalog-from-panel reject vs 008 flag-and-keep

**Decision**: New `catalogDropOutcome` in `libs/garden-layout`:

| Outcome | When | Draft | Notice |
|---------|------|-------|--------|
| `ok` | Pointer in **open** bed and `evaluateLayout` would add **no** blocking fit/spacing flags | Create `direct_seed` at drop **center** | none (Unsaved changes) |
| `miss` | Outside open bed | unchanged | **Drop missed a bed** |
| `spacing` | Too close (existing pair rule) | unchanged | **Too close to another plant** |
| `fit` | Does not fit (`placementFits`) | unchanged | **Does not fit in this bed** |
| (page) | Offline | unchanged | existing online-required |

Moving/resizing **already-placed** plantings and beds stays 008: apply, show flags, Save 422 until fixed.

**Rationale**: Spec FR-007 is stricter **only** for new catalog-from-panel plantings. Reuse `evaluateLayout` / `placementFits` / `pairRequiredSpacing` so reject matches Save rules. “Overlap” in the spec **is** blocking spacing/fit from `evaluateLayout` (center-to-center / edge clearance), not a second AABB overlap detector.

**Alternatives considered**: Place-then-flag (008) for catalog drops — gardener thinks it worked. Separate overlap geometry — duplicates spacing math.

## 4. Catalog admission (known spacing)

**Decision**: `PlantRepository.list` adds `spacing_inches IS NOT NULL`. Sync and miss-fill **skip** upserts with `spacingInches == null` (do not overwrite a stored row with null). GET-by-id still returns leftover null-spacing rows so existing plantings can load. Do **not** delete rows. Do **not** invent spacing. No migration.

**Rationale**: FR-010. Filter at read/sync so Plants page and Bed View panel share one rule.

**Alternatives considered**:
- **Query flag `requireSpacing`**: Extra API; easy to forget in a picker.
- **DELETE null-spacing plants**: Would orphan or break existing plantings’ catalog labels.
- **Guess spacing**: Spec forbids.

## 5. Plant panel = existing catalog GET

**Decision**: Bed View calls the same `GET /api/plants?q&zone&plantType` as `PlantListPage`. Climate filter **defaults** to `garden.hardinessZone` when set; otherwise unset. Gardener may change or clear. Miss-fill is **already** in `CatalogService.list` when `q` is non-empty and local total is 0. After miss-fill, still omit no-spacing. Empty after that: same empty state as Plants (**No plants match**). No new “provisional plant” type.

**Rationale**: FR-011 “same path” is the existing on-demand miss-fill, not a new UX. Filter-only empty is the same empty state.

**Alternatives considered**: Duplicate search in Angular — diverges from catalog. Client-side filter of a full dump — wrong for miss-fill.

## 6. Result identity (illustration)

**Decision**: No image URLs on `PlantSummaryDto` today and no illustration pipeline. Show a CSS **stand-in** keyed by `plantType` plus common name, category, and when zone filter is set a climate line (`Fits zone {n}` / range already on the DTO). Do not block place for lack of art.

**Rationale**: YAGNI. Spec allows stand-in.

**Alternatives considered**: Fetch Unsplash/Trefle images — new provider surface. Add nullable `imageUrl` with no data.

## 7. Overview marks vs 008 labels-only

**Decision**: Split canvas flags: `showPlantingMarks` true on Overview **and** Bed View; `allowPlantingDrag` true **only** on Bed View. Overview hit-test MUST ignore planting footprints so a mark cannot steal pan or bed-move. Keep bed/area names. Occupied-bed name/count labels MAY remain; marks are required.

**Rationale**: Clarification 2: map of plantings, not editable there.

**Alternatives considered**: Keep labels-only (violates spec). Make marks draggable on Overview (forbidden).

## 8. Arm-then-click

**Decision**: Client-only `armedPlant` (catalog summary). Arm via result control (`Arm {commonName}` / `aria-pressed`). Next click/tap on **Bed plan** that maps into the open bed runs the same `catalogDropOutcome` as a drop. Keyboard: `Arm` is focusable; with a result armed, Enter/Space on focusable `Bed plan` places at **visible Bed View viewport center** mapped into the open bed (not Add-at-geometric-center). Miss/reject clears arm and posts the notice. Escape or choosing another result changes/clears arm. Empty-bed **Direct seed** (009) **focuses** the plant panel; it MUST NOT place.

**Rationale**: A11y/touch without restoring Add {name} at bed center.

**Alternatives considered**: Keyboard numeric grid — extra product. Keep Add {name} — spec removes it.

## 9. Shared types

**Decision**: Add `spacingInches: number` to `PlantSummaryDto` (listed items always have it). Detail keeps `number | null` for leftover GET-by-id. `FavoriteListItemDto.plant` uses `Omit<PlantSummaryDto, 'spacingInches'> & { spacingInches: number | null; status: PlantStatus }` so leftover favorites can remain `unavailable`. Layout planting DTOs unchanged (`startMethod: 'direct_seed'`, `placement`).

**Rationale**: Bed View needs spacing for footprint without a second GET. FR-010 pickers are list/search/sync; leftover favorites are not a catalog search result.

**Alternatives considered**: Always GET detail on drop — extra latency. Keep summary without spacing — panel cannot size the mark until detail returns. Force favorites to `number` — breaks leftover rows.
