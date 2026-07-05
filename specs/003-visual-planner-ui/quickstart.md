# Quickstart: Visual Garden Planner Experience

**Date**: 2026-07-05 | **Plan**: [plan.md](./plan.md)

## Prerequisites

- Features 001 and 002 implemented (catalog, garden CRUD, placement validation)
- `npm run db:migrate` after 003 schema migration
- `npm run seed:planner-assets` (after implementation) to link illustrations

## 002 Feature Parity (required before T024 page swap)

- [ ] Draw and resize beds/paths via AreaEditor in PlannerShell
- [ ] Create, cancel, reassign, and transplant indoor starts
- [ ] Edit garden dimensions and resolve shrink conflicts via ConflictDialog
- [ ] Version conflict dialog still resolves correctly

## Manual Test Flows

### 1. Auto-upgrade existing garden (FR-013)

1. Open a garden created in the pre-visual layout editor
2. Confirm it loads in the visual planner with illustrated plants (category defaults OK)
3. Verify beds, paths, placements, and indoor starts unchanged in data
4. Save once — confirm `visual_version` becomes 1 and thumbnail appears in list

### 2. Visual drag-and-drop (US1)

1. Create new vegetable garden plan
2. Open plant library — each entry shows illustration thumbnail
3. Drag tomato onto a bed — sprite appears with spacing footprint circle
4. Drag to reposition — live validation highlights conflicts
5. Attempt invalid drop (spacing violation) — blocked with visual feedback

### 3. Growing-area types (US2)

1. Create **orchard** plan — place apple tree with rootstock selected
2. Place second tree too close — hard block; confirm companion/guild suggestions appear
3. Create **container / patio** plan — verify plant library filters for small-space categories
4. Garden list shows zone type badge for each (thumbnail preview verified in US5 §6)

### 4. Structures & layers (US3)

1. Add greenhouse, trellis, and path from structure library
2. Send greenhouse backward behind a bed — layering updates
3. Lock trellis — confirm it cannot be dragged until unlocked

### 5. Templates (US4)

1. New plan → choose "Beginner Vegetable" template
2. Canvas loads pre-populated illustrated layout
3. Replace one plant — save (thumbnail list preview verified in US5 §6)

### 6. Zoom, pan, chrome, and thumbnails (US5)

1. Zoom in to fine-tune plant position on large plan
2. Zoom out — full garden visible with legible sprites
3. Complete 15-minute session using toolbar + panels only
4. Save plan — confirm thumbnail appears in garden list

### 7. Mobile phone viewport (FR-017)

1. DevTools → iPhone viewport (< 768px)
2. Open plan — illustrated canvas visible, pan only
3. Select plant — edit date, delete — works
4. Confirm drag-from-library is disabled / hidden

### 8. Accessibility (planner-ui.md)

- [ ] Tab moves focus between library, canvas, and property panel
- [ ] Enter selects focused plant; Escape clears selection
- [ ] Sprites have aria-label matching plant/structure name
- [ ] With prefers-reduced-motion: no shake animation on invalid drop

## Visual Polish Checklist (FR-011)

- [ ] Toolbar, panels, and canvas use --planner-* CSS tokens from globals.css
- [ ] Left/right panel widths and typography consistent across planner routes
- [ ] No wireframe-only styling remains on garden editor pages
- [ ] ConflictDialog and settings drawer match planner panel chrome

## Test Commands

```bash
npm run test -- tests/unit/planner-illustrations.test.ts
npm run test -- tests/unit/planner-layers.test.ts
npm run test -- tests/unit/garden-orchard-validation.test.ts
npm run test -- tests/unit/garden-orchard-advisories.test.ts
npm run test:e2e -- tests/e2e/visual-planner.spec.ts
```

## API Smoke Tests

```bash
# Create orchard plan from template
curl -X POST http://localhost:3000/api/gardens \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"name":"Home Orchard","length":40,"width":30,"unit":"feet","zone_type":"orchard","template_id":"<uuid>"}'

# Add structure
curl -X POST http://localhost:3000/api/gardens/<id>/structures \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"expected_version":1,"structure_type_slug":"greenhouse","origin_x":2,"origin_y":2,"length":8,"width":12}'

# Regenerate thumbnail
curl -X POST http://localhost:3000/api/gardens/<id>/thumbnail \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"expected_version":2,"image_data":"<base64>"}'
```

## Performance Checks

- 50-placement garden: drag pointer-up to re-render < 100ms p95 (SC-003a)
- Plant library first paint < 500ms with cached static assets
- Thumbnail POST completes < 2s

## Common Issues

- **Broken plant images**: Run `seed:planner-assets`; verify `illustration_category_defaults` seeded
- **Legacy garden blank sprites**: Check `resolvePlantIllustration()` fallback path
- **Orchard spacing not blocking**: Confirm `rootstock_id` set and catalog has spacing data
- **Phone shows drag handles**: Verify viewport hook disables `VisualCanvas` interaction mode
