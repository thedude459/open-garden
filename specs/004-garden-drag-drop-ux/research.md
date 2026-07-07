# Research: Intuitive Garden Planting Experience

**Date**: 2026-07-07 | **Plan**: [plan.md](./plan.md)

## 1. Click-to-Place Interaction Model

### Decision: Placement mode state machine (`idle` | `armed` | `dragging`)

**Rationale**: `PlannerShell` already sets `pendingPlantId` on library select but never
handles canvas clicks. A small state machine unifies drag-from-library, click-armed
placement, and mobile tap flows through one `placeAtPoint()` function that validates
and auto-saves.

States:
| State | Trigger | Canvas cursor | Next |
|-------|---------|---------------|------|
| `idle` | default | default | arm or drag |
| `armed` | library click/tap selects plant | crosshair + bed highlight | canvas click → place |
| `dragging` | drag start from library/sprite | grabbing | drop → place |

Escape cancels `armed` → `idle`. Click outside bed while armed shows invalid feedback
without save.

**Alternatives considered**:
- **Separate mobile/desktop components**: Duplicates validation/save logic.
- **Double-click library auto-place**: Poor spatial control; rejected.
- **Modal coordinate picker**: Violates spec FR-004.

## 2. Auto-Save & Confirmation UX

### Decision: Immediate API persist on successful validation + ephemeral toast

**Rationale**: Clarification session chose auto-save per placement. Existing
`placePlant()` already POSTs immediately on drag-drop success — extend to click-to-place
and add `ToastProvider` with 3s auto-dismiss, `aria-live="polite"`, stacking max 3.

Thumbnail regeneration remains on explicit toolbar Save (003 behavior) — placement
auto-save does not capture thumbnail every drop (performance).

Messages: `"Tomato added"`, `"Plant moved"`, `"Could not save — check connection"`.

**Alternatives considered**:
- **Debounced batch save**: Conflicts with clarified auto-save requirement.
- **Optimistic UI without toast**: Users unsure if save succeeded.
- **Full plan save on each drop**: Too slow; thumbnail capture expensive.

## 3. Offline & Failed Save Handling

### Decision: Snapshot last-known-good `VisualGardenDetail` before optimistic canvas update; revert on failure

**Rationale**: Spec requires revert to last saved state on offline/failed POST. Keep
server response as source of truth; on `!response.ok` restore snapshot and show error toast.
Do not show success toast unless `response.ok`.

**Alternatives considered**:
- **Queue offline placements**: Out of scope; adds sync complexity.
- **Leave ghost plant on canvas**: Violates spec edge case.

## 4. Human-Readable Validation Messages

### Decision: `lib/garden/messages.ts` maps `ViolationCode` → user copy; UI hides raw codes

**Rationale**: `ValidationFeedback` currently renders `<strong>{violation.code}</strong>`.
Server messages are technical. Map at UI boundary:

```text
SPACING → "Too close to {otherPlantName} — needs {distance} {unit} spacing"
INCOMPATIBLE → "{plantA} and {plantB} should not be planted together"
BOUNDARY → "Place inside a garden bed, not on a path"
```

`ValidationFeedback` shows message only (no code prefix). Orchard advisories unchanged.

**Alternatives considered**:
- **Change API response messages**: Breaks tests and API contract stability.
- **Client-side only generic text**: Loses plant names from server context.

## 5. Property Panel & Coordinate Hiding

### Decision: Replace position readout with bed name + relative spacing label

**Rationale**: FR-012 prohibits coordinate pairs as primary info. Show:
- Plant common name
- Bed name (lookup `bed_area_id` → `garden.areas`)
- "Spacing: {radius} {unit} circle" as gardening language
- Planted-on date editor

Remove `position_x` / `position_y` display entirely from `PropertyPanel`.

**Alternatives considered**:
- **Collapsible "Advanced" coordinates**: Spec intent is hide from routine use; defer.

## 6. Full-App Design System Refresh

### Decision: Semantic CSS tokens in `:root` + component class updates; WCAG AA audit

**Rationale**: Clarification chose full app refresh. Introduce semantic tokens:

```css
--color-surface, --color-on-surface, --color-primary, --color-on-primary
--color-secondary, --color-on-secondary, --color-border, --color-focus-ring
```

Map existing `--accent`, `--planner-toolbar-bg`, etc. to semantic aliases. Fix known
contrast failures:
- `.btn.secondary` on `--accent-soft` (green on pale green ~2.8:1) → darken text or deepen bg
- `.planner-toolbar .btn.secondary` on dark toolbar bg → use `--color-on-primary` variant

Audit all 11 routes with automated contrast test (`design-tokens-contrast.test.ts` parses
CSS pairs). Focus rings: `outline: 2px solid var(--color-focus-ring); outline-offset: 2px`.

Typography: retain Georgia serif for brand; increase button `font-weight: 600` for legibility.

**Alternatives considered**:
- **Tailwind / shadcn migration**: Large unrelated refactor; rejected.
- **Garden-page-only tokens**: Rejected in clarification.

## 7. Mobile Click-to-Place

### Decision: Extend `MobilePlannerView` with collapsible plant library + armed click on canvas

**Rationale**: Phone disables drag (`dragEnabled={false}` per 003). Add plant search
sheet above bottom detail panel. Flow: search → tap plant (armed) → tap bed location →
auto-save. Crosshair cursor on canvas when armed. Repositioning on phone deferred
(view/delete/date only for existing placements unless user uses tablet).

**Alternatives considered**:
- **Phone drag anyway**: Poor UX on small screens; rejected in 003 and 004 clarify.
- **Auto-place at bed center**: Loses spatial control; rejected.

## 8. Empty-Bed Hints & Drop Target Highlighting

### Decision: SVG `<text>` overlay on beds with zero placements; CSS class on bed rect during drag/armed

**Rationale**: FR-013/FR-014 require discoverability. `VisualCanvas` computes
`bedsWithoutPlacements` from `placements` grouped by `bed_area_id`. Hint text:
"Drag or tap to add plants". During `armed` or drag-over, add `bed-drop-target` class
with green tint (`color-mix` on `--planner-bed-fill`).

**Alternatives considered**:
- **HTML tooltip outside SVG**: Misaligns on zoom/pan.
- **Modal onboarding**: Too heavy for P3 guidance story.

## 9. Indoor Start Transplant Flow

### Decision: Reuse placement mode — selecting transplant start arms canvas; click/drop places

**Rationale**: `IndoorStartsPanel` still references `transplantPosition` coordinate
pattern. Replace with: select start → arm transplant mode → canvas click/drop on target
bed → call existing transplant API with computed coordinates.

**Alternatives considered**:
- **Keep coordinate form**: Violates FR-017.

## 10. Testing Strategy

### Decision: Unit tests for mode/messages/tokens; Playwright for planting flows + axe

**Rationale**: SC-003 requires 100% contrast pass — automate token pairs. E2E covers
SC-001, SC-006, SC-008. Usability metrics (SC-004, SC-005, SC-007) remain manual/moderated.

**Alternatives considered**:
- **Manual-only contrast audit**: Not repeatable in CI.
