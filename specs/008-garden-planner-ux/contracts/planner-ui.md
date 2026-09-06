# Planner UI contract (Playwright)

**Feature**: `008-garden-planner-ux`

Accessible names below are the e2e contract.

## Routes

| View | Path |
|------|------|
| Garden Overview | `/gardens/:id/layout` |
| Bed View | `/gardens/:id/layout/beds/:bedId` |
| Transplant View | `/gardens/:id/transplants` |

## Overview (`Garden overview` / `Garden plan`)

| Role / name | Who | Notes |
|-------------|-----|--------|
| `Garden plan` | members | Beds + **non-planting areas**; **no** in-bed plant marks |
| `Create bed` | owner, collaborator | Name, length, width; appears in visible plan |
| `Create non-planting area` | owner, collaborator | Name, length, width; visible plan |
| `Save layout` | owner, collaborator | Absent/disabled for viewer |
| `Unsaved changes` | owner, collaborator | Draft dirty |
| `Transplants` | members | Navigates to Transplant View |
| `Zoom in` / `Zoom out` | members | Scale; pinch also scales |
| online-required | owner, collaborator | Offline mutation attempt |

### Gestures (Overview)

| Start | Editor | Viewer |
|-------|--------|--------|
| Empty plan | pan | pan |
| Bed body, pointerup no drag | open Bed View | open read-only Bed View |
| Bed body, drag | move bed | no move |
| Bed resize handle | resize | absent |
| Area body, drag | move area | no move |
| Area resize handle | resize | absent |
| Pinch / Zoom | scale | scale |

Overview MUST expose 0 ways to place, move, or unplace a **planting**.
Occupied beds show planting **names** (and counts). Each bed and area shows
its name. Select bed MUST NOT open a length/width form.

Confirmed `Delete bed` / `Delete area`: in-page confirm; immediate.

## Bed View (`Bed view`)

| Role / name | Who | Notes |
|-------------|-----|--------|
| `Bed plan` | members | Single bed; planting marks + names; grid |
| `Planting tray` | members | Unplaced **transplants** only; viewers read-only |
| `Direct seed` | owner, collaborator | Catalog picker → place in this bed |
| `Save layout` / `Unsaved changes` | owner, collaborator | Same draft as Overview |
| `Back to overview` | members | Must not discard draft |
| `Remove from bed` | owner, collaborator | Direct seed: confirm delete. Transplant: restore tray |

### Gestures (Bed View)

| Start | Editor | Viewer |
|-------|--------|--------|
| Planting mark | move in bed | no move |
| Tray item → bed | place transplant | no drag |
| Transplant → tray | restore to tray (keep info) | no drag |
| Direct seed → tray | no silent delete | — |
| Miss bed footprint | status **Drop missed a bed** (`aria-live`); no place | — |
| Bed geometry handles | **absent** | — |

Bed View MUST expose 0 ways to create/resize/move/delete the bed or add areas.

## Transplant View (`Transplants`)

| Role / name | Who | Notes |
|-------------|-----|--------|
| `Add transplant` | owner, collaborator | Catalog + indoor started date; fills tray |
| `Delete transplant` | owner, collaborator | Full-delete record |
| Indoor water/fertilize items | members | From `indoorReminders`; complete/dismiss like 006 |
| Viewer | read list + tasks; no add/delete |

Direct-seed plantings MUST NOT appear here.

## Visual rules (assertable)

- Overview: 0 in-bed plant marks; name/count labels on occupied beds.
- Create bed without length or width: 0 beds added.
- Create bed with size: rectangle in the currently visible Overview.
- After Save, planting list / layout assignment matches Bed View.
- Blocking flags after gesture end, not required during pointermove.
- Areas visually distinct from beds; never open Bed View.

## Out of scope for e2e

Participant studies (SC-001, SC-002, SC-006). Sub-frame pointer tracking
(SC-005) is a **manual** quickstart check on the 10×50 fixture.
