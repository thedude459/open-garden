# Research: Visual Garden Planner Experience

**Date**: 2026-07-05 | **Plan**: [plan.md](./plan.md)

## 1. Canvas Rendering & Interaction

### Decision: Extend SVG with `<image>` sprites, pointer-driven drag, viewBox zoom/pan

**Rationale**: Feature 002 already uses React + SVG (`LayoutCanvas.tsx`) with
proportional scaling and click-to-place. GrowVeg-like visuals require bitmap/SVG
illustrations on the same coordinate system—not a new canvas engine. SVG `<image>`
elements preserve accessibility, scale with zoom, and keep validation coordinates
identical to 002.

Drag-and-drop: pointer events (`pointerdown` / `pointermove` / `pointerup`) on
sprites with garden-coordinate projection (reuse `gardenPointFromEvent` pattern).
Library items use `draggable` HTML with drop target on canvas, or pointer-drag
from library panel directly onto canvas.

Zoom/pan: wrapper applies CSS `transform: scale() translate()` on SVG container;
alternative viewBox manipulation—CSS transform chosen for smoother compositing
with HTML panels.

**Alternatives considered**:
- **react-konva / PixiJS**: Richer but duplicates geometry layer; heavier bundle.
- **HTML absolute-position div overlay**: Poor print/export; awkward rotation.
- **Full GrowVeg clone (Flash-era patterns)**: Proprietary; not applicable.

## 2. Illustration Asset Pipeline

### Decision: Static assets in `public/planner/` + DB reference tables

**Rationale**: Spec requires curated illustrations only (no user uploads). Assets
are versioned with the app, served via Next.js static files (cache-friendly CDN path).
`plant_illustrations` maps `canonical_plant_id → asset_path` with nullable match;
resolver falls back to `category_defaults` keyed by `plant_category`.

Launch target: category defaults for all categories + specific artwork for top ~200
edible plants in catalog; provisional plants always use category default.

Format: SVG preferred (crisp at all zoom levels); WebP fallbacks for complex artwork.
Uniform sprite anchor: bottom-center of plant footprint circle.

**Alternatives considered**:
- **DB BYTEA blobs**: Harder to cache, review, and version-control art.
- **External CDN only**: Adds deployment coupling; local `public/` sufficient for v1.
- **Photorealistic photos**: Rejected in clarification session.

## 3. Growing-Area Types (`zone_type`)

### Decision: Enum on `gardens`: `vegetable_garden` | `orchard` | `container_patio`

**Rationale**: Clarified spec names three types explicitly. Implements constitution
Domain Requirement ("Garden, Orchard, or Mixed-use zone") for orchard and garden;
container satisfies "other growing areas." `mixed` deferred—users with mixed layouts
use vegetable_garden type until a future spec.

Type effects:
| Type | Default structures | Placement rules |
|------|-------------------|-----------------|
| vegetable_garden | beds, paths, raised beds | existing 002 bed rules |
| orchard | tree grid hints, paths | canopy circles, rootstock spacing hard blocks |
| container_patio | pots, planters, small beds | smaller default footprints, bed optional |

**Alternatives considered**:
- **Separate app routes per type**: Unnecessary; same planner shell, filtered libraries.
- **Tags instead of enum**: Weaker validation; type drives template and library filters.

## 4. Structures vs Beds

### Decision: New `garden_structures` table separate from `garden_areas`

**Rationale**: GrowVeg objects (greenhouses, trellises, seating) overlay the plan
without being plantable beds. Beds/paths remain in `garden_areas`; structures have
`structure_type_id`, position, size, rotation, z_index, locked flag. Season-extender
structures carry optional `environment_tag` (e.g., `greenhouse`, `cold_frame`) for
future scheduling—display only in v1.

**Alternatives considered**:
- **Extend `garden_area_type` enum**: Would pollute bed/path semantics and validation.
- **Purely visual (non-persisted)**: Violates FR-006 persistence and thumbnail needs.

## 5. Orchard Tree Validation

### Decision: Extend `lib/garden/validation.ts` with canopy-radius checks + rootstock from 001

**Rationale**: Clarification requires full hard-block validation. Tree placements
store `rootstock_id` (nullable FK) on `plant_placements` when zone is orchard and
plant has rootstock options. Spacing uses `max(canopyA, canopyB)` from rootstock
`spacing_cm` or catalog mature spread fallback. Constitution Principle II: non-overridable.

Canopy rendered as circle (same as annual spacing footprint but typically larger).
Annual vegetables in orchard zone still use standard spacing rules.

**Alternatives considered**:
- **Visual-only orchard**: Rejected — violates spec clarification and constitution.
- **Defer orchard to separate feature**: User explicitly requested orchard in spec.

## 6. Auto-Upgrade Migration

### Decision: Client-side projection on load + `visual_version` column

**Rationale**: FR-013 / clarification: open existing 002 garden → visual planner
immediately. No batch migration job required. On `GET /api/gardens/:id`, response
includes illustration URLs resolved server-side. `gardens.visual_version` starts at 0
for pre-visual rows; set to 1 on first save after visual editor ships. Thumbnail
generated on first save post-upgrade.

`lib/planner/migration.ts`: pure function mapping `GardenDetail` → visual projection
(default sprites for all placements); idempotent.

**Alternatives considered**:
- **Opt-in upgrade wizard**: Rejected in clarification.
- **Dual editors**: Rejected — maintenance burden.

## 7. Mobile Experience

### Decision: Responsive breakpoint at 768px; `MobilePlannerView` read-only canvas + edit panels

**Rationale**: Clarification: phone = view + inspect + date edit + delete; no
drag-and-drop. Render same illustrated canvas (non-interactive pan only); detail
drawer for selected item. Tablet (≥768px) uses full `PlannerShell`.

**Alternatives considered**:
- **Separate mobile app**: Out of scope.
- **Full parity on phone**: Poor UX for precision placement; rejected in clarification.

## 8. Templates

### Decision: `plan_templates` reference table + JSON snapshot column

**Rationale**: Six launch templates (2 per zone type): Beginner Vegetable, Salad Garden,
Small Orchard, Fruit Tree Row, Balcony Containers, Patio Herbs. Snapshot stores areas,
structure placements, and sample plant placements (catalog IDs). Preview image in
`public/planner/templates/`. Instantiate via `POST /api/gardens` with `template_id`.

**Alternatives considered**:
- **Hard-coded TS constants only**: Harder to extend without deploy; DB + seed script better.
- **User-shared community templates**: Out of scope.

## 9. Thumbnails

### Decision: Client capture on save via SVG serialization → POST thumbnail endpoint

**Rationale**: FR-009 requires list previews. Client already has full SVG DOM;
serialize to data URL or canvas draw, POST to `/api/gardens/:id/thumbnail`, store
path in `gardens.thumbnail_key`. Avoids headless browser on server.

**Alternatives considered**:
- **Server-side Puppeteer**: Heavy ops dependency.
- **No persistence (generate on list load)**: Too slow for garden list page.

## 10. Styling & GrowVeg Inspiration

### Decision: Original design system tokens; earthy palette; illustrated density similar to GrowVeg

**Rationale**: FR-016 prohibits copying proprietary assets/layouts. Adopt *patterns*:
left library / center canvas / right properties; template gallery cards; green
toolbar—implemented with project CSS variables, not GrowVeg CSS.

**Alternatives considered**:
- **Licensed GrowVeg white-label**: Not available; not requested.
