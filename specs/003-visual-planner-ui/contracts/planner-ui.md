# Planner UI Contract

**Feature**: 003-visual-planner-ui

## Layout Regions (`PlannerShell`)

```text
┌─────────────────────────────────────────────────────────────┐
│ Toolbar: save, zoom +/-, plan name, zone type badge         │
├──────────────┬──────────────────────────────┬───────────────┤
│ Left panel   │ VisualCanvas (center)        │ Right panel   │
│ PlantLibrary │ zoom/pan illustrated garden  │ PropertyPanel │
│ StructureLib │ drag-drop target             │ LayerPanel    │
│ (tabs)       │                              │               │
└──────────────┴──────────────────────────────┴───────────────┘
```

Phone (< 768px): `MobilePlannerView` — canvas top (read-only pan), bottom sheet for details/edits.

## Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `PlannerShell` | Responsive layout, toolbar, panel visibility |
| `VisualCanvas` | SVG coordinate system, zoom/pan transform, sprite layers |
| `PlantLibrary` | Search/filter catalog, illustrated grid, drag source |
| `StructureLibrary` | Filtered by `zone_type`, category groups |
| `TemplateGallery` | Modal/page for new plan; preview cards |
| `PlantSprite` | `<image>` + footprint circle + drag handlers |
| `StructureSprite` | `<image>` + bounds rect + resize handles (desktop) |
| `LayerPanel` | z-order list, send back/forward, lock toggle |
| `PropertyPanel` | Selected item details, dates, rootstock (orchard) |
| `MobilePlannerView` | Disables drag; enables tap-select + edit drawer |

## Interaction Modes

| Mode | Desktop/tablet | Phone |
|------|----------------|-------|
| Pan canvas | Space+drag or two-finger | Single-finger scroll |
| Zoom | Wheel or toolbar +/- | Pinch or toolbar |
| Place plant | Drag from library or click bed | N/A (disabled) |
| Move plant | Drag sprite | N/A |
| Select item | Click sprite | Tap sprite |
| Edit date | PropertyPanel | Bottom sheet |
| Delete item | PropertyPanel or keyboard | Bottom sheet |
| Layer reorder | LayerPanel | Hidden in v1 |

## Visual Feedback

| State | Presentation |
|-------|--------------|
| Valid drop target | Green tint on bed/container |
| Spacing violation | Red footprint ring + shake on drop reject |
| Incompatible | Red dashed line to conflicting plant |
| Locked item | Lock icon overlay; no drag cursor |
| Selected item | Blue selection halo |
| Advisory warning | Amber banner (reuse ValidationFeedback pattern) |

## Theming (FR-016)

CSS variables (extend `globals.css`):

```css
--planner-toolbar-bg
--planner-panel-bg
--planner-canvas-bg
--planner-accent-green
--planner-bed-fill
--planner-path-fill
```

Original palette — earthy greens, warm browns, cream panels. NOT GrowVeg color copy.

## Accessibility

- All sprites have `aria-label` from plant/structure name
- Keyboard: Tab between panels; Enter to select; Escape deselects
- Reduced motion: disable drop shake animation
- Illustrations decorative; name always available in text

## Replacement of 002 Components

| 002 Component | 003 Fate |
|---------------|----------|
| `LayoutCanvas` | Superseded by `VisualCanvas` |
| `LayoutEditor` | Superseded by `PlannerShell` |
| `AreaLayer` | Merged into bed/path sprites + structure rendering |
| `PlacementLayer` | Merged into `PlantSprite` layer |
| `PlantPlacementPanel` | Split into `PlantLibrary` + `PropertyPanel` |
| `AreaEditor` | Embedded in PlannerShell left panel (bed/path draw + resize) |
| `IndoorStartsPanel` | Tab or collapsible section in PlannerShell left panel |
| `GardenSettingsPanel` | Toolbar settings drawer in PlannerShell |
| `ConflictDialog` | Retained globally in PlannerShell |
| `ValidationFeedback` | Retained; shared with PropertyPanel |
| Validation logic | Unchanged in `lib/garden/validation.ts` |

Auto-upgrade: existing routes render `PlannerShell` for all `GET /gardens/:id` pages.
