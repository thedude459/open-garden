# Planting Interaction Contract

**Feature**: 004-garden-drag-drop-ux

## Modes by Viewport

| Action | Desktop / tablet (≥768px) | Phone (<768px) |
|--------|---------------------------|----------------|
| Place new plant | Drag from library OR select + click bed | Select plant + tap bed location |
| Move plant | Drag sprite | Not available (select to view/delete/date) |
| Transplant indoor start | Drag or click bed after selecting start | Tap bed after selecting start |
| Validation | Same `validate-placement` API | Same |
| Save | Auto-save on success | Auto-save on success |
| Coordinates | Never shown to user | Never shown to user |

## Placement Flow (shared `placeAtPoint`)

```text
1. Resolve garden point from pointer (gardenPointFromClient)
2. findBedAtPoint(x, y) → bed_area_id | null
3. If no bed → BOUNDARY violation, invalid feedback, STOP
4. POST validate-placement { bed_area_id, plant_id, position_x, position_y, ... }
5. If violations → show humanized messages, shake (if motion OK), STOP
6. POST placements (or transplant route) with expected_version
7. On OK → update garden state, success toast, reset mode to idle
8. On fail → revert to last_saved_garden snapshot, error toast
```

## Drag-and-Drop (FR-001, FR-002)

**Library → canvas**:
- `PlantLibrary` sets `dataTransfer` + calls `onPlantSelect` (arms as fallback)
- `VisualCanvas.handleDrop` → `onExternalPlantDrop`

**Sprite move**:
- `PlantSprite` pointer drag → `onPlacementMove`
- Delete-then-recreate pattern (existing 003) retained until PATCH move endpoint exists

**Feedback during drag or armed placement**:
- `drop_preview` circle at pointer
- `highlighted_bed_id` when over valid bed (drag or click-to-place armed mode)
- Red ring + shake on invalid release

## Click-to-Place (FR-001, FR-018)

**Arm**:
- Desktop: click plant button in `PlantLibrary` → `mode = armed`
- Phone: tap plant in mobile library sheet → `mode = armed`
- Visual: crosshair cursor, library item `selected` class, hint in `PropertyPanel`

**Place**:
- `VisualCanvas.onGardenClick(point)` when `mode === armed`
- Same validation/save as drag path
- Escape → disarm

**Cancel**:
- Escape, click outside garden SVG, or tap "Cancel" in mobile sheet → `idle`

## Auto-Save (FR-003, FR-015)

| Event | API | Toast |
|-------|-----|-------|
| New placement | `POST .../placements` | "{common_name} added" |
| Move placement | DELETE + POST (existing) | "Plant moved" |
| Transplant | `POST .../transplant` | "{common_name} transplanted" |
| Date change | `PUT .../placements/:id` | none (inline field) |
| Delete | `DELETE .../placements/:id` | none |
| Thumbnail save | `POST .../thumbnail` (toolbar) | "Garden saved" |

Failed save: error toast + revert canvas to `last_saved_garden`.

## Property Panel (FR-012)

**Show**:
- Plant common name
- Bed name (from `areas` lookup)
- Spacing footprint as "{radius} {unit} spacing circle"
- Planted-on date
- Rootstock (orchard)
- Validation feedback (humanized)

**Hide**:
- `position_x`, `position_y`
- `origin_x`, `origin_y` for structures (show size only)

## Empty-Bed Hints (FR-013)

When bed has zero placements:
- SVG text centered in bed: "Drag or tap to add plants"
- `font-size` scales with zoom
- Hidden when bed has ≥1 placement

## Validation Display (FR-016)

`ValidationFeedback`:
- Render `formatViolation(violation)` from `lib/garden/messages.ts`
- No `<strong>{code}</strong>` prefix in production UI
- Violations: `role="alert"`; warnings: `role="status"`

## Indoor Starts (FR-017)

`IndoorStartsPanel`:
- Remove coordinate inputs / position display
- Select start → arm transplant mode on canvas
- Canvas click/drop on target bed → `transplant` API with computed position
- Target bed must contain click point

## Accessibility

- Armed mode announced via `aria-live`: "Select a location on a bed for {plant}"
- Sprites retain `aria-label`
- Keyboard: Tab to library plant → Enter to arm → focus canvas → Enter at focus point (future) OR click
- `prefers-reduced-motion`: disable shake; instant feedback only

## API Dependencies (unchanged)

| Endpoint | Use |
|----------|-----|
| `POST /api/gardens/:id/validate-placement` | Pre-save validation |
| `POST /api/gardens/:id/placements` | Create placement |
| `DELETE /api/gardens/:id/placements/:id` | Delete before move |
| `PUT /api/gardens/:id/placements/:id` | Date updates |
| `POST /api/gardens/:id/indoor-starts/:id/transplant` | Transplant |

No new endpoints required for v1.

## Replacement / Updates to 003 Contract

| 003 behavior | 004 change |
|--------------|------------|
| Phone: place plant N/A | Phone: click-to-place enabled |
| `pendingPlantId` unused for click | Wired to placement mode |
| PropertyPanel shows coordinates | Coordinates removed |
| No save toast on placement | Auto-save toast |
| Validation shows raw codes | Humanized messages only |

Bed/path `AreaEditor` forms unchanged in v1 (deferred canvas editing).
