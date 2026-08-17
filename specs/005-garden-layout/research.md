# Research: Garden Layout Designer

**Feature**: `005-garden-layout` | **Date**: 2026-08-16

## 1. Domain library vs app-only folders

**Decision**: New Nx lib `libs/garden-layout` for bed-local geometry, 90-degree
orientation, center-to-center spacing, fit (`ceil(s / 2)` inches from edges), and
layout save validation. Nest controllers in `apps/api/src/gardens/` stay thin.
Angular imports only the pure helpers (`evaluateLayout`, `rotateBed90`,
`pairRequiredSpacing`, types) — not Nest, Drizzle schema, or repositories.
`LayoutService` in the same lib receives catalog-data **repository classes** as
constructor deps (same pattern as `PlantingService`).

**Rationale**: Constitution library-first. SC-002 spacing fixtures and the save
gate must be unit-tested without HTTP. The PWA must run the same checks on
unsaved edits before PUT.

**Alternatives considered**:
- **App-only services**: Violates Principle I; client and API would drift on
  the save gate.
- **Fold into `libs/seasonal-plantings`**: Mixes list/date/grouping rules with
  geometry. Planting list must not import a canvas. Angular already cannot
  import the seasonal-plantings barrel (it pulls `PlantingService` →
  plant-catalog-data). A second lib keeps that split honest.
- **Fold into `libs/gardens`**: Gardens would take a plant-catalog dependency
  they do not have.

## 2. Persistence home

**Decision**: Extend `garden_beds` and `garden_plantings` in
`libs/plant-catalog-data`. Migration `0005_garden_layout.sql`. Do not create
`libs/garden-layout-data`. Geometry columns are nullable (unsized beds,
unplaced plantings). No new table for “the layout document.”

**Rationale**: Named beds and plantings are already the household objects
(FR-003). Geometry is extra information on those rows. One migration pipeline.

**Alternatives considered**:
- **`garden_layouts` JSON document**: Fights 004 bed CRUD and last-write-wins
  per planting; harder to keep `bed_id` consistent.
- **Dedicated data lib**: Extra Nx project for a few columns.

## 3. Bed-local coordinates and 90-degree orientation

**Decision**: Store each bed’s **origin** on the garden plan (`origin_x_inches`,
`origin_y_inches`), **length** and **width** in inches (local x and y extents),
and **orientation** `0 | 90 | 180 | 270`. Store each placement as the plant
**center** in **bed-local** inches (`layout_x_inches`, `layout_y_inches`).
Rotating the bed 90 degrees changes **only** `orientation`. Local placement
rows are not rewritten. Moving the bed changes only origin. Resizing changes
only length/width; local coords stay; overflow is a fit flag, not an unplace.

Plan-space point = rotate local `(x, y)` by orientation about the bed origin,
then add origin. Length/width are not swapped in storage when rotating; the
orientation maps local axes onto the plan.

**Rationale**: Clarify 2026-08-16: placements stay attached and move/rotate with
the bed. Local coords make that a data invariant, not a rewrite.

**Alternatives considered**:
- **Absolute plan coords for plants**: Moving a bed would leave plants behind
  (rejected in clarify).
- **Swap stored length/width on rotate**: Extra writes; placements would need
  a matching transform or they would jump.

**ADR**: `docs/adr/0007-garden-layout.md`

## 4. Atomic layout PUT (save gate)

**Decision**: Geometry and placements are saved with
`PUT /api/gardens/:id/layout` in **one transaction**. The body is the intended
snapshot: every bed that has geometry, every placed planting (id, bedId, local
x/y). Beds omitted from the payload keep their **name** but have geometry
cleared. Plantings omitted from `placements` are **unplaced** (local x/y
cleared); `bed_id` is **not** cleared by omit (FR-006 unplace ≠ unassign).
Each included placement **sets** `bed_id` to that placement’s `bedId`.

`evaluateLayout` runs on the would-be snapshot. If any spacing or fit flag
exists, the PUT returns **422** `VALIDATION_ERROR` `Layout has spacing or fit
problems` and **writes nothing**. Last successful PUT is the stored plan.
Unknown/unavailable spacing is not a blocking flag.

004 bed POST/PATCH name/DELETE and planting date PATCH stay as they are.
Creating a named bed on the layout uses existing POST `/beds` (then the user
sizes it in the PUT). Deleting a bed from the layout uses existing DELETE
`/beds` after in-page confirm; the service also clears layout coords on those
plantings (FK already SET NULL `bed_id`).

**Rationale**: Resize-then-unplace (or nudge) cannot be expressed as two
independent PATCHes without a window where the stored plan is invalid. FR-005
forbids persisting flags. Incremental PATCH of one bed would 422 on overflow
before the client could unplace.

**Alternatives considered**:
- **PATCH bed geometry only**: Overflow save would be impossible without a
  companion planting PATCH in the same request (ad hoc batching).
- **Allow invalid stored layouts**: Rejected in clarify (option B).

When the planting **list** PATCHes `bedId` to a different bed (or null), the
planting service MUST clear layout x/y so a list reassignment cannot leave a
placement in the old bed’s local space.

## 5. Spacing and fit formula

**Decision**: Pure functions in `libs/garden-layout`:

- Pair spacing: both spacings known → required center-to-center distance is
  `max(a, b)`. Distance `<` that value → spacing flag. Either unknown → no
  pair flag (mark unavailable on that planting).
- Fit (known spacing `s`): flag if `layout_x < ceil(s/2)` or `layout_x > length - ceil(s/2)`
  or `layout_y < ceil(s/2)` or `layout_y > width - ceil(s/2)`, or if `length < s` or
  `width < s` (bed cannot contain the plant). Example: spacing 5 inches needs 3
  inches from each edge (never round down into a false fit).
- Checks are **per bed**. Overlapping beds do not compare plantings across beds.

Catalog `spacingInches` is the only source (001). No provider calls.

**Rationale**: Clarify option A; integer inches match the catalog column.

**Alternatives considered**: Edge-to-edge circles, square cells, min-of-pair
(rejected in clarify). Floating-point plan units (YAGNI vs tape measure).

## 6. Online-only mutations; offline read cache

**Decision**: Last successful `GET` layout is cached in IndexedDB `og-layout`
keyed by user + garden (same pattern as `og-plantings` **read** cache). PUT is
**not** queued. Offline mutate shows online-required. Failed PUT (network or
422) does not overwrite the cache. Cache is the last **valid** GET.

Planting-list queue (`og-plantings-queue`) stays independent. Layout PUT MUST
NOT run while that garden has pending planting/bed queue items that would
change beds or planting ids — wait, YAGNI? Spec says layout read must not
block planting list. A pending new bed might not exist server-side yet. **Do
not** drain planting queue from the layout page. If PUT references a bed id
that is only pending locally, the API 404s `Bed not found`. Layout page copy:
finish planting-list sync or work online after beds exist on the server.
Document in quickstart; no cross-queue protocol.

**Rationale**: US3 / FR-008. Geometry sync was explicitly deferred vs plantings.

**Alternatives considered**: Queue layout PUT like plantings (out of spec).

## 7. Canvas without a map library

**Decision**: SVG (or equivalent positioned rectangles) in garden **inch**
space, pan/zoom via overflow + a native range/buttons, native `<input
type="number">` for length/width, native `<select>` for unplaced plantings and
orientation. Pointer drag to move beds and placements. No Konva, D3, or GIS.
No `[ngValue]`. Confirm bed delete in-page (same pattern as planting remove).

Unsized named beds appear in a “needs size” list (not as fake rectangles).
Empty layout: CTA to add a bed (POST name, then set size on the plan).

**Rationale**: SC-001 is length/width in under 3 minutes; YAGNI vs drawing
tools. Native controls match 002/004.

**Alternatives considered**: Full drawing editor, GPS basemap (out of spec).

## 8. AuthZ and errors

**Decision**: Reuse `SessionGuard` + `GardenMembershipGuard` (`params.id` =
garden id). Non-member GET/PUT: **404** `Garden not found`. Viewer GET: 200.
Viewer PUT: **403** `Viewers cannot update layout`. Unauthenticated: 401.
Nest: explicit `@Inject(...)`.

**Rationale**: Same as 004; constitution multi-user; no existence leak.

## 9. What this feature does not do

No companion rules, care reminders, purchasing, calendar plans on the canvas,
polygons, arbitrary-angle rotation, GPS, outer property boundary, quantity
field, layout mutation queue, or creating plantings from the catalog on the
layout (use the planting list).
