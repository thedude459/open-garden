# Quickstart: Garden Layout & Planting

**Feature**: 002-garden-layout | **Branch**: `004-garden-layout`

**Prerequisites**: Feature 001 plant database running locally (see
[001 quickstart](../001-plant-database/quickstart.md)).

## Setup

```bash
# From repo root (001 already set up)
npm install

# Run new garden schema migration
npm run db:migrate

# Start dev server + Postgres
docker compose up -d postgres
npm run dev
# → http://localhost:3000
```

## Manual Validation Flow

### 1. Create a Garden (US1)

1. Sign in at `/login`
2. Navigate to `/gardens`
3. Click "New Garden" → enter name "Backyard", 30×20 feet
4. Verify garden appears in list with correct dimensions

### 2. Add Beds and Paths (US2)

1. Open garden layout editor
2. Draw a bed (8×4 ft at position 2,2) — set soil: **Loam**, sun: **Full sun**
3. Verify abbreviated labels **"Loam"** and **"Sun"** on the bed canvas
4. Draw a path (2×20 ft) — distinct styling; no soil/sun labels
5. Attempt overlapping bed → blocked
6. Attempt out-of-bounds bed → blocked
7. Clear soil or sun → respective canvas label removed
8. Confirm rotation control **not** available (US6)

### 3. Place Plants with Validation (US3)

1. Select a bed → choose "Tomato" from catalog
2. Place at valid position → saved, footprint visible; **bed planting history** row created
3. Live validate-placement preview shows spacing blocks in `violations[]` before save
4. Attempt second tomato too close → spacing block
5. Place incompatible plant (e.g., Fennel near Tomato) → incompatibility block
6. Attempt placement on path → blocked

### 4. Cross-Bed Validation

1. Create two adjacent beds
2. Place incompatible plants near shared edge → blocked garden-wide

### 5. Edit Layout (US4)

1. Resize garden smaller until bed extends outside → blocked with conflict list
2. Shrink bed with placements → warning with affected placements
3. Delete bed → confirmation, placements removed

### 6. Indoor Start & Direct Seed (US5)

1. Direct seed lettuce → placement visible; history row created
2. Start pepper indoors → indoor-starts panel only, not on bed
3. Transplant pepper → placement + history row; climate `warnings[]` in preview if out-of-window
4. Attempt transplant with spacing conflict → blocked

### 7. Concurrent Edit (FR-020)

1. Open same garden in two tabs
2. Edit in tab A, save (version increments)
3. Edit in tab B with stale version, save → 409 conflict dialog
4. Verify review / discard / overwrite options

### 8. Offline Garden (optional)

1. Load garden while online (cached in IndexedDB)
2. DevTools → Network → Offline
3. View garden layout → loads from cache
4. Edit bed dimensions → queued locally
5. Go online → sync replays; verify persisted

### 9. Geometric Rotation (US6)

1. Create bed → rotate 90° via layout editor → verify visual rotation and saved `rotation_degrees`
2. Rotate bed until footprint would extend outside garden → blocked (SC-007)
3. Create two beds that overlap only when one is rotated → overlap blocked

### 10. Crop Rotation (US6)

1. Place tomato (nightshades) in Bed A → saved
2. Remove tomato placement → history retained
3. Place another nightshade in Bed A within 3-year window → advisory `CROP_ROTATION` warning shown; save allowed if spacing passes (SC-008)
4. Place lettuce (different group) in same bed → no rotation warning

## Performance Validation (SC-002, SC-008)

### SC-002 — validate-placement preview

1. Seed or create a garden with 50+ plant placements
2. Trigger validate-placement preview 20 times (click-to-place or API dry-run)
3. Confirm p95 response time < 2 seconds in DevTools Network tab (target ≤200ms via bench)

### SC-008 — crop rotation warning latency

1. Seed Bed A with nightshade history within the 3-year rotation window (see US6 flow above)
2. Trigger validate-placement for a conflicting nightshade candidate 20 times
3. Confirm p95 response time < 2 seconds (warning appears without extra round-trip)
4. Run `npm run bench:validation` (T057) — both SC-002 and SC-008 paths must pass thresholds

## Test Commands

```bash
npm run test -- tests/unit/garden-geometry.test.ts
npm run test -- tests/unit/garden-validation.test.ts
npm run test:e2e -- tests/e2e/garden-layout.spec.ts
npm run bench:validation   # after T057
```

## API Smoke Tests

```bash
# Create garden (requires session cookie)
curl -X POST http://localhost:3000/api/gardens \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"name":"Test","length":20,"width":10,"unit":"feet"}'

# Validate placement (dry run)
curl -X POST http://localhost:3000/api/gardens/<id>/validate-placement \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"bed_area_id":"<bed>","plant_id":"<plant>","plant_provenance":"authoritative","position_x":4,"position_y":4,"planted_on":"2026-05-15"}'
```

## Acceptance Criteria Mapping

| Spec | Validation |
|------|------------|
| SC-001 | Manual: create garden + bed < 5 min |
| SC-002 | Perf: validate-placement p95 < 2s; unit: validation logic; E2E: block message visible |
| SC-003 | E2E: edit persists after reload |
| SC-004 | E2E: full flow create → bed → plant |
| SC-005 | Unit: geometry tests for overlap/bounds |
| SC-006 | E2E: visual distinction beds vs paths |
| SC-007 | Unit: OBB overlap/bounds tests; manual US6 geometric rotation |
| SC-008 | Manual US6 crop rotation warning; bench rotation path p95 < 2s (T057) |

## Key Modules to Test

| Module | Tests |
|--------|-------|
| `lib/garden/enums.ts` | USDA soil + sun groups, canvas abbreviations |
| `lib/garden/geometry.ts` | AABB + OBB bounds, overlap, point-in-bed |
| `lib/garden/validation.ts` | spacing, incompatibility, garden-wide |
| `lib/garden/rotation.ts` | identity resolve, lookback, advisory warnings |
| `lib/garden/spacing.ts` | cm → feet/meters conversion |
| `lib/garden/version.ts` | 409 on stale expected_version |

## Troubleshooting

- **409 on every save**: Client sending stale `expected_version`; refresh garden detail
- **Spacing block unexpected**: Check catalog `spacing_cm.plant` for plant; verify unit conversion
- **Offline placement blocked**: Plant not in IndexedDB cache; view plant detail online first or pin
- **Indoor start on bed layout**: Bug — indoor starts must not create placements until transplant
