# UI contract (Playwright)

**Feature**: `010-fix-planner-placement`

Keep 008/009 names: `Garden plan`, `Bed plan`, `Save layout`, `Unsaved changes`, `Back to overview`, `Create bed`, `Create non-planting area`, `Drop missed a bed`, `Direct seed`, `Open bed {name}`, `Notification`, `Dismiss`.

## Garden Overview

| Role / name | Who | Notes |
|-------------|-----|--------|
| `Garden plan` | members | Beds, areas, **planting marks**; marks **not** draggable |
| `Create bed` / `Create non-planting area` | owner, collaborator | First-place: **center** at **visible viewport** (no palette drop) |
| plant search / `Plant panel` | **absent** | 0 catalog search controls |

### Gestures (Overview)

| Start | Editor | Viewer |
|-------|--------|--------|
| Empty plan | pan | pan |
| Bed body, pointerup no drag | open Bed View | open read-only Bed View |
| Bed body, drag | move bed (**grab-offset**) | no move |
| Area body, drag | move area (**grab-offset**) | no move |
| Planting mark | **must not** start move-planting; pan or bed-move as if the mark were not a hit | same |
| Pinch / Zoom | scale | scale |

Create bed / area (no pointer drop): rectangle **center** at the **visible viewport** plan point. Move existing: **grab-offset**. After **Save layout**, stored origin matches what was shown.

## Bed View

| Role / name | Who | Notes |
|-------------|-----|--------|
| `Bed plan` | members | Open bed + planting marks (draggable for editors). Keyboard-focusable: armed + Enter/Space places at visible Bed View viewport center in the open bed |
| `Plant panel` | members | Region; viewers read-only (no drag/arm) |
| `Search plants` | members | Name / species / variety (same placeholder intent as Plants) |
| zone `<select>` | members | Default garden `hardinessZone` when set; includes Any zone |
| type `<select>` | members | Any type + catalog plant types |
| `Apply` | members | Runs catalog search (busy 009) |
| result `Arm {commonName}` | owner, collaborator | `aria-pressed` when armed; draggable |
| `Add {commonName}` | **absent** | MUST NOT exist |
| `Direct seed` | owner, collaborator | Empty-state: **focuses** plant panel; MUST NOT place |
| `Planting tray` | members | Transplants only (008) |

### Catalog result row (visible)

- Visual stand-in (not required to be an `<img>` with a URL)
- Common name
- Category (`plantType`)
- Climate indicator text when zone filter is **set** (e.g. contains `Zone`)

### Gestures (Bed View catalog)

| Gesture | Editor | Viewer |
|---------|--------|--------|
| Drag result onto open bed (valid) | `direct_seed` at drop center; Unsaved changes | no |
| Drag/arm-click outside open bed | **Drop missed a bed**; 0 new plantings; arm cleared | no |
| Drag/arm-click too close | **Too close to another plant**; 0 new plantings | no |
| Drag/arm-click does not fit | **Does not fit in this bed**; 0 new plantings | no |
| Offline place | existing online-required; draft unchanged | no |
| Move existing planting | 008 flag-and-keep | no |

Empty name search after miss-fill: empty state title **No plants match** (same as Plants catalog).

## Notices (009)

Catalog miss/reject: `miss` or `error` via `Notification` until **Dismiss**. Valid catalog place: no success notice (Unsaved changes only).

## In scope for e2e (010)

- Zoom/pan **Create bed** (and area): stored origin **center** equals viewport center used at create; grab-offset move does not center-snap; Save + reload — `planner-place.spec.ts`
- Bed View: search (type/zone exclusion + miss-fill empty **No plants match**), drag onto bed, GET layout has placement; Overview shows mark; Overview has 0 `Search plants` — `planner-catalog-drop.spec.ts`
- Invalid catalog drop: miss / spacing / fit / offline; notice + 0 plantings — `planner-catalog-reject.spec.ts`
- Viewer: cannot Create bed / cannot Arm

## Out of scope for e2e

SC-001 100% human zoom matrix; illustration aesthetics; participant studies. Sub-pixel pointer tracking remains a quickstart check.
