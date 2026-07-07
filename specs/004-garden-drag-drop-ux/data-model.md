# Data Model: Intuitive Garden Planting Experience

**Date**: 2026-07-07 | **Plan**: [plan.md](./plan.md)

## Overview

Feature 004 introduces **no database schema changes**. Persistence continues through
existing `plant_placements`, `garden_areas`, and placement/transplant APIs from
Features 002/003. This document defines **client-side interaction state**, **toast
notifications**, and **message mapping** entities introduced by the UX layer.

## Server Entities (unchanged)

```text
gardens
├── garden_areas (bed | path)
├── plant_placements (position_x, position_y derived from pointer — never form-entered)
├── indoor_starts
└── ... (003 structures, layers — unchanged)
```

Positions are computed by `gardenPointFromClient()` in `VisualCanvas` and sent to
existing POST/PUT/DELETE placement routes. Users never type coordinates.

## Client-Side State

### `PlacementMode`

| Field | Type | Description |
|-------|------|-------------|
| mode | `idle` \| `armed` \| `dragging` | Current interaction state |
| armed_payload | `DragPlantPayload \| null` | Plant selected for click-to-place |
| armed_context | `direct_seed` \| `transplant` \| null | Whether arming is for new plant or transplant |
| transplant_start_id | `string \| null` | Indoor start ID when `armed_context = transplant` |

**Transitions**:
```text
idle + librarySelect(plant)     → armed { payload, direct_seed }
idle + dragStart(plant)         → dragging
armed + canvasClick(point)      → validate → save → idle
armed + Escape                  → idle
dragging + drop(point)          → validate → save → idle
dragging + cancel               → idle
idle + transplantSelect(start)  → armed { transplant, start_id }
```

### `CanvasInteractionState` (transient, React state in `PlannerShell`)

| Field | Type | Description |
|-------|------|-------------|
| drop_preview | `{ x, y, spacing_radius, valid } \| null` | Live footprint during drag/armed hover |
| highlighted_bed_id | `string \| null` | Bed under pointer for drop-target highlight |
| invalid_drop | `boolean` | Triggers shake animation (respects reduced motion) |
| last_saved_garden | `VisualGardenDetail` | Snapshot for offline revert |

### `ToastNotification`

| Field | Type | Description |
|-------|------|-------------|
| id | `string` | Unique (uuid or increment) |
| variant | `success` \| `error` \| `info` | Visual style |
| message | `string` | User-facing text (≤80 chars) |
| created_at | `number` | `Date.now()` for auto-dismiss |
| duration_ms | `number` | Default 3000; errors 5000 |

Not persisted. Rendered in `ToastProvider` with `aria-live="polite"`.

## Message Mapping (`lib/garden/messages.ts`)

### `ViolationDisplay`

| Field | Type | Description |
|-------|------|-------------|
| code | `ViolationCode` | Server code (internal) |
| user_message | `string` | Gardening-language copy for UI |
| show_code | `boolean` | Always `false` in v1 UI |

### Supported codes (extend existing 002 set)

| Code | User message template |
|------|----------------------|
| `SPACING` | Too close to {otherName} — needs more space |
| `INCOMPATIBLE` | {plantA} and {plantB} don't grow well together |
| `BOUNDARY` | Place inside a garden bed |
| `BED_TOO_SMALL` | This bed is too small for {plantName} |
| `ORCHARD_SPACING` | Trees need more room — check spacing for {plantName} |
| `CLIMATE` | (warning) Outside recommended planting window for your area |
| `ROTATION` | (warning) {family} was grown here recently |

Server `message` field used as fallback only when code unmapped.

## Design Tokens (CSS, not DB)

Semantic tokens in `globals.css` — see [contracts/design-system.md](./contracts/design-system.md).

| Token | Purpose |
|-------|---------|
| `--color-primary` | Primary buttons, links |
| `--color-on-primary` | Text/icons on primary |
| `--color-secondary` | Secondary buttons |
| `--color-on-secondary` | Text on secondary (WCAG AA) |
| `--color-surface` | Cards, panels |
| `--color-on-surface` | Body text |
| `--color-focus-ring` | Keyboard focus outline |

Planner-specific tokens (`--planner-*`) alias semantic tokens for canvas chrome.

## Validation Rules (unchanged)

All placement paths MUST:
1. Call `POST /api/gardens/:id/validate-placement` (or equivalent) before save
2. Block save when `violations.length > 0`
3. Show warnings without blocking unless hard violation present

Constitution Principle II hard limits remain non-overridable.

## Out of Scope (data)

- Canvas bed/path geometry tables — deferred
- Offline placement queue table — not required for v1 revert pattern
- User theme preferences — single light theme in v1
