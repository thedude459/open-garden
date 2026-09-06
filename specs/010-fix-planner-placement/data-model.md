# Data model: Fix Planner Placement

**Feature**: `010-fix-planner-placement` | **Date**: 2026-08-22

No new PostgreSQL tables or columns. `plants.spacing_inches` stays **nullable** so leftover unknown-spacing rows can exist. Membership, gardens, beds, areas, plantings, layout PUT, and IndexedDB layout cache stay as in 002–008.

## Catalog plant (admission)

A **catalog plant** is a `plants` row that pickers may show.

| Rule | Behavior |
|------|----------|
| `spacing_inches IS NOT NULL` | Eligible for `GET /api/plants` list, Plants page, Bed View panel, miss-fill results, new sync upserts |
| `spacing_inches IS NULL` | Omitted from those surfaces. GET-by-id MAY still return it. Existing garden plantings that reference it **stay**. New imports MUST NOT upsert it |

Do **not** invent a spacing value. Do **not** delete the row in this feature.

**PlantSummaryDto** (list items): `spacingInches: number` (always present). Also `commonName`, `plantType`, `zoneMin`, `zoneMax` (climate indicator). No illustration URL. **Favorites** of leftover rows MAY keep `spacingInches: number | null` on `FavoriteListItemDto.plant` (not a catalog search result).

## Garden structure (unchanged storage)

### Bed

Sized rectangle: `originXInches`, `originYInches`, `lengthInches`, `widthInches`, `orientation`.

| Gesture | Origin rule |
|---------|-------------|
| First-place / **Create** (no palette drop) | Origin such that **center** is at the **visible Overview viewport** |
| Move existing | Origin follows **grab-offset** (not center-snap) |

Validation for beds/areas: existing 005/008 rules only (no new fence, no new bed/area overlap ban). Evaluated on the rectangle shown.

### Non-planting area

Same first-place and grab-offset rules as beds. Never holds plantings. May overlap beds (008).

### Direct-seed planting

Created only from **Bed View** plant panel (drag or arm-then-click).

| Field | Rules |
|-------|--------|
| startMethod | `direct_seed` |
| bedId | Open bed |
| placement | Local inches; **center** at drop/click |
| tray | MUST NOT appear |
| indoorStartedOn | MUST NOT be required / MUST NOT start transplant workflow |

After Save, GET layout includes it; Overview **draws** the mark. Move/remove only in Bed View.

### Working draft

Unchanged `PlannerDraftService`: in-memory until **Save layout**. Reload/leave without Save discards positions and unsaved direct seeds.

## Client presentation state (not persisted)

### Armed catalog result

| Field | Rules |
|-------|--------|
| plant | `PlantSummaryDto` or null |
| Transitions | idle → armed (`Arm` click/Enter) → placed (`ok` from drag, click, or armed Enter on `Bed plan`) or idle (miss/reject/Escape/other result) |

MUST NOT stay armed after a completed miss/reject without a notice.

### Plant panel filters

| Field | Rules |
|-------|--------|
| q | Optional name search; empty `q` does **not** miss-fill |
| plantType | Optional; same enum as Plants catalog |
| zone | Optional 1–13. **Default**: garden `hardinessZone` if set; else unset |

## Relationships

- Plantings belong to one garden. Overview marks are the same placement rows as Bed View.
- Catalog omit-null-spacing does not unplace existing plantings.
- Notices (009) are session-global; messages MUST NOT include another garden’s names.

## AuthZ (unchanged)

Owner/collaborator: Overview create/move beds/areas; Bed View catalog place. Viewer: read map and bed; no mutate. Non-member: not-found. Catalog list requires the same auth as the Plants page.

## State transitions

```text
Catalog drop/arm-click
  → map pointer (SVG CTM)
  → catalogDropOutcome
       ok     → draft + Unsaved changes
       miss   → notice Drop missed a bed; no planting; clear arm
       spacing/fit → specific error; no planting; clear arm
       offline → online-required; no planting; clear arm

Existing planting move (Bed View)
  → applyPlantingDrop + evaluateLayout flags (008); Save may 422
```
