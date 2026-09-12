# Research: Garden View Clarity

**Feature**: `014-garden-view-clarity` | **Date**: 2026-09-12

## 1. Where opening a garden lands

**Decision**: Garden list links to **`/gardens/:id/layout`**. Route **`/gardens/:id`** redirects to `layout` so old “garden home” links and bookmarks hit the map. Move today’s detail screen to **`/gardens/:id/configure`** (reuse `garden-detail.page.ts`).

**Rationale**: Spec FR-001 — first screen is the visual garden. Overview already exists at `layout`. A redirect is smaller than merging two pages. Place marker “garden home” must point at `layout`, not configure.

**Alternatives considered**:

- Make `/gardens/:id` render Overview in-place — larger move, duplicate of `garden-layout.page.ts`.
- Keep list → detail and add a skip-link — still settings-first; fails SC-001.

## 2. Shared garden destinations

**Decision**: One small standalone **`GardenNav`** (Overview, Plantings, Calendar, Reminders, Transplants, Configuration) on layout, configure, plantings, calendar, reminders, transplants. Bed View keeps **Back to overview** (already one action to the map). Drop “Back to garden” links that currently go to the settings page.

**Rationale**: FR-007 — one navigation action to the map from any destination. Today only detail has `garden-nav`; other pages only have “Back to garden”.

**Alternatives considered**: Breadcrumb-only — Bed View already has a back link; lists would still dump into configure. A domain lib for nav — organizational-only packaging (constitution YAGNI).

## 3. On-mark planting text

**Decision**: Add `shortenPlantingMarkName(commonName, radiusInches): string` in `libs/garden-layout` (same file family as `layoutPlantingLabels`). Take the **start** of the common name; truncate to characters that fit inside the circle (reuse the existing ~3.1 plan-units-per-character width). No ellipsis required. When the canvas shows planting marks (Bed View only), draw that string **on** the mark. **Do not** call `layoutPlantingLabels` from the canvas. Do **not** use `allowPlantingDrag` as the label-mode switch.

Overview sets `[showPlantingMarks]="false"` and keeps `overviewPlantingLabels` name×count on the **bed**, not in-bed positions (FR-010). Today’s Overview `showPlantingMarks=true` is a defect relative to 008/FR-010 — this feature turns it off.

**Rationale**: Spec FR-005. Beside-mark layout is what makes two Sweet Basil overlap. Truncation belongs in the lib so Vitest can lock the rule without Angular.

**Alternatives considered**: Initials-only — rejected in clarify. Keep `layoutPlantingLabels` and shrink font — still a second label beside the mark.

## 4. Bed name and size chrome

**Decision**: Canvas bed caption `Bed · {name} · {size}` is Overview-only (`showBedCaption` true by default; **false** in Bed View). Bed View **you-are-here / heading** still shows the bed name (existing Place Marker `current`). **Size is not shown** in Bed View at all. `aria-label` on the bed rect may still include the name for assistive tech.

**Rationale**: Clarify: name off-plan OK; size only on all-beds map. Overview list of beds with `formatPlanSize` (sidebar) stays — that is the all-beds view, not the in-bed drawing.

**Alternatives considered**: Strip Place Marker in Bed View — gardeners lose which bed they opened after zoom.

## 5. Full name on select

**Decision**: Bed View owns `selectedPlantingId`. Click/keyboard on a planting mark selects it. One **`role="status"`** line off the SVG shows the full common name. Clicking another mark switches the line. **Clicking empty plan** (not a mark) clears selection and the line. Do not paint the full name on the canvas.

**Rationale**: Clarify A. Status line is the same pattern as “Drop missed a bed”.

**Alternatives considered**: Grow the selected mark’s in-circle text to the full name — long names overflow neighbors.

## 6. Configuration contents and authz

**Decision**: `garden-detail.page.ts` unchanged in behavior (PATCH garden, members, invite, leave, delete + confirm). Only the **path and nav** change. Owner-only invite/delete stays in the template as today. Viewers still see members read-only.

**Rationale**: Spec FR-003 / FR-008 / FR-009. Relocating the screen is enough; do not rewrite membership.

**Alternatives considered**: Split members onto a fourth destination — extra nav for the same household work the gardener asked to keep together.

## 7. Tests and CI

**Decision**: Vitest `planting-labels.spec.ts` for truncation (fit vs overflow; empty/short names). Playwright: (1) create garden → click list link → **Garden Overview** heading, **no** “Garden settings”; (2) Configuration → rename / zone / invite / delete still work; (3) Bed View: plan does not contain `Bed · … × … ft`, mark text is a prefix, select shows full name in status. Update `openOverview`, `inviteViewer`, `garden-list.spec.ts`, `garden-site.spec.ts`, `garden-share.spec.ts`, `ui-place-marker.spec.ts` (Overview still expects `Bed · North` **on the Overview plan**). Do **not** switch `scripts/ci/e2e.sh` onto Compose profile `app`.

**Rationale**: Constitution E2E for the new landing and labels. Existing tests will fail if they still click the list and look for the name input.

**Alternatives considered**: Docs-only proof — rejected (SC-001/002).
