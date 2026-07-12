# Quickstart: Intuitive Garden Planting Experience

**Date**: 2026-07-07 | **Plan**: [plan.md](./plan.md)

## Prerequisites

- Features 001, 002, and 003 implemented (catalog, validation, visual planner baseline)
- `npm run dev` running
- Test garden with at least one bed and no plants (or create via UI)
- Tablet/desktop browser for drag tests; DevTools mobile emulation for phone tests

## Automated Checks

```bash
npm test                    # unit: placement-mode, messages, contrast tokens
npm run test:e2e            # E2E: planting flows, mobile click-place, axe contrast
```

## Manual Test Flows

### 1. Drag-and-drop with auto-save (US1, FR-001–003)

1. Open a garden with a bed on tablet/desktop width (≥768px)
2. Search plant library → drag tomato onto bed
3. Confirm plant appears with spacing circle **without** entering coordinates
4. Confirm toast: "Tomato added" (or plant name)
5. Refresh page — plant persists
6. Drag plant to new location — toast "Plant moved", position updates

**Pass**: No coordinate form shown; no manual Save required for placement.

### 2. Click-to-place desktop (US1, FR-001)

1. Click (don't drag) a plant in the library — cursor becomes crosshair
2. Click a valid spot on the bed
3. Plant appears, auto-saves, toast shown
4. Press Escape before clicking — armed state cancels, no placement

**Pass**: Same validation as drag; invalid click shows feedback, no save.

### 3. Invalid placement feedback (FR-006, FR-007, FR-016)

1. Drag plant onto a path (non-bed area) — rejected, plain-language message
2. Place two incompatible plants adjacent — blocked with plant names in message
3. Confirm violation UI shows **no** raw codes like `SPACING` or `position_x`

### 4. Property panel (FR-012)

1. Select a placed plant
2. Confirm panel shows: plant name, bed name, spacing description, date
3. Confirm panel does **not** show X/Y coordinates

### 5. Empty-bed hints & drop highlight (US3, FR-013–014)

1. View bed with no plants — hint text visible on canvas
2. Arm or drag a plant over bed — bed highlights as drop target
3. Add plant — hint disappears

### 6. Indoor start transplant (FR-017)

1. Create indoor start with target bed
2. Select start for transplant — arm canvas (no coordinate form)
3. Click/drop on target bed location
4. Confirm transplant saves and toast appears

### 7. Mobile click-to-place (FR-018, SC-008)

1. DevTools → iPhone viewport (<768px)
2. Open garden — plant library/search visible in mobile layout
3. Tap plant to arm → tap bed location
4. Plant placed and saved
5. Confirm drag-from-library disabled
6. Select existing plant — edit date, delete — works

### 8. Offline / failed save (edge case)

1. DevTools → Network → Offline
2. Attempt placement — error toast, canvas reverts to last saved state
3. Go online — retry succeeds

### 9. Full-app design system (US2, FR-008–011)

Visit each route; verify readable buttons and consistent styling:

- [ ] `/` home
- [ ] `/login`, `/register`
- [ ] `/plants`, `/plants/[id]`
- [ ] `/gardens`, `/gardens/new`, `/gardens/[gardenId]` (T023, T023a–T023c)

**Planner region labels** (FR-010, T023c):
- [ ] Plant library, canvas, and details panels have visible headings or aria landmarks on desktop

**Contrast checklist**:
- [ ] Primary buttons: text readable on green background
- [ ] Secondary buttons: text readable on pale background (gardens list + planner toolbar)
- [ ] Links distinguishable from body text
- [ ] Focus ring visible when tabbing through controls

### 10. Accessibility

- [ ] Tab through planner: library → canvas → property panel
- [ ] `aria-live` announces armed plant selection
- [ ] `prefers-reduced-motion`: no shake on invalid drop
- [ ] Sprites have `aria-label` matching plant name

## Regression (003 parity)

- [ ] Orchard rootstock selection still required before tree placement
- [ ] Structure drag-drop still works on desktop
- [ ] Toolbar Save still generates thumbnail
- [ ] Version conflict dialog still appears on stale edit
- [ ] `AreaEditor` bed/path forms still functional (coordinates in forms OK for v1)

## Success Criteria Mapping

| Criterion | Verified by |
|-----------|-------------|
| SC-001 | Manual flow 1–2 |
| SC-002 | Manual flow 1 (timed) |
| SC-003 | `design-tokens-contrast.test.ts` + axe E2E (T025, T037) |
| SC-004 | Manual flow 9 (navigation identification) |
| SC-005 | Moderated usability (out of band) |
| SC-006 | E2E `planting-interaction.spec.ts` |
| SC-007 | Manual flow 3 |
| SC-008 | Manual flow 7 |

## Known Deferred (out of v1)

- Canvas draw/move/resize for beds and paths
- Phone drag-to-reposition existing plants
- User-customizable themes
