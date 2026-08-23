# Research: UI Feedback & Garden Usability Polish

**Feature**: `009-ui-feedback-polish` | **Date**: 2026-08-22

## 1. Notice queue (no toast vendor)

**Decision**: One in-memory notice at a time, owned by `libs/web-ui` (`createNoticeQueue`). Kinds: `success` | `error` | `miss`. Success auto-dismisses after **4000 ms** and has **no Dismiss**. Error and miss stay until `dismiss()`. A newer post of **any kind** replaces the current notice. Angular `NoticeHost` renders `role="status"` (success) or `role="alert"` (error/miss) with an accessible name **Notification**, and a **Dismiss** control on persistent kinds only. Clear the queue on navigation (`Router` events) so leftover success does not appear on the next screen.

**Rationale**: Spec FR-017 and clarifications. Native CSS + one host beats a toast package (YAGNI, offline PWA, no extra dependency).

**Alternatives considered**:
- **Stacking toasts**: Spec forbids stacking; any new post replaces the current notice.
- **ngx-toastr / Angular CDK overlay**: Extra dependency for one message.
- **Inline `.error` only**: Fails “shared notice” and Save-on-same-screen success.

## 2. Busy / in-flight lock

**Decision**: `busy-lock.ts` in `libs/web-ui`: a set of string keys (e.g. `save-layout`, `create-garden`, `login`). `tryBegin(key)` returns false if already in flight. Pages wrap async submits: begin → disable that control (`aria-busy="true"`, busy label or spinner on the button) → `finally` end. Do **not** set a full-page blocker. Offline-required: if `navigator.onLine === false` (or existing `OnlineRequiredError` path) show error notice immediately **without** leaving the key stuck; do not spin until timeout.

**Rationale**: FR-001, FR-002, FR-015, SC-003. Keyed lock prevents double Save without freezing pan/zoom.

**Alternatives considered**:
- **Disable the whole form/toolbar**: Violates “rest of UI not frozen.”
- **Per-button boolean only**: Easy to forget `finally`; a small helper is the whole lib.

## 3. When to call success vs skip notice

**Decision**:

| Outcome | Notice |
|---------|--------|
| Service success, same screen, item remains (Save layout, Add transplant, Create garden while list visible, catalog favorite) | `success` |
| Service success, navigated away (login → catalog, open garden) | none |
| Confirmed delete / remove that clears the item from the screen | none (updated UI) |
| Service or online-required failure | `error` (persist) |
| Valid map drop | none; **Unsaved changes** |
| Drop missed a bed | `miss` (persist), keep 008 copy **Drop missed a bed** |

**Rationale**: Clarification session 2026-08-22 (notice vs Unsaved changes).

**Alternatives considered**: Notice on every drag (noisy). Notices only on failure (Save would look like a no-op).

## 4. Design tokens (extend existing `:root`)

**Decision**: Keep `--soil`, `--leaf`, `--moss`, `--sand`, `--ink`. Add:

- Spacing: `--space-1` … `--space-6` (4 / 8 / 12 / 16 / 24 / 32 px)
- Radius: `--radius` (6px)
- Elevation: `--elev-1`, `--elev-2` (soft leaf-tinted shadows)
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-destructive`, `.btn[aria-busy="true"]`
- `.card` / reuse `.row` with `--elev-1` (`.card` defined with spacing tokens in T003)
- `.empty-state` (title, body, actions)
- `.place-marker` (breadcrumb)

Audit screens: gardens list, overview, bed view, catalog, auth. Garden home and Transplant View use the same classes (first-class busy screens) without a separate visual review SC.

**Rationale**: Spec 004-era colors already exist in `styles.css`; FR-013 asks to extend, not rebrand.

**Alternatives considered**: Tailwind or a token JSON pipeline — too much for this feature.

## 5. Bed vs area (not color alone)

**Decision**: Non-planting areas: SVG `pattern` hatch (diagonal lines) plus a text/icon label **Area** (or the area name plus the word Area). Beds: solid soil fill (existing) plus a small plant-bed mark or the word **Bed** in the label line (`Bed · {name}`). Playwright can assert `[data-kind="bed"]` / `[data-kind="area"]` and visible **Bed** / **Area** text on the plan.

**Rationale**: SC-004; FR-008. Hatch + word survives grayscale and color-vision deficiency better than grey vs brown alone.

**Alternatives considered**: Color-only (fails spec). Icons only without text (weaker for AT).

## 6. Open bed vs drag

**Decision**: Keep 008 `isClickNotDrag` (4 plan inches). Click/tap without drag still `selectBed` → Bed View. Drag still `move-bed`. Add:

- Hover/focus outline on `.layout-bed-frame` plus `aria-label` including **Open bed**
- Labeled control in the Overview rail: **Open bed {name}** (same `selectBed`)

Viewer: same Open bed; drag must not move (008).

**Rationale**: Clarification A. Rail button covers touch and keyboard.

**Alternatives considered**: Chip-only open (breaks 008 click). Click never opens (more discoverable but regresses 008 e2e).

## 7. Place marker

**Decision**: Standalone `PlaceMarker` with `nav` `aria-label="You are here"`. Crumbs:

| View | Text |
|------|------|
| Overview | `{gardenName} > Garden Overview` |
| Bed View | `{gardenName} > {bedName}` |
| Transplant View | `{gardenName} > Transplants` |

Garden name is a link to garden home; “Garden Overview” is current (not a link) on Overview; on Bed View, garden name and a **Back to overview** control remain (008 name kept).

**Rationale**: FR-007, SC-005. Reuse garden name from existing layout/garden GET (already on the page).

**Alternatives considered**: Marker only on Bed View. Full site breadcrumb including Catalog — out of scope.

## 8. Empty states

**Decision**: `.empty-state` block:

- Gardens list, zero items: copy + existing **Create garden** form as the next step (not muted-only).
- Overview, zero beds: copy + **Create bed** (name/length/width still required). Viewer: copy without create.
- Empty Bed View: **Direct seed** and **Transplants** as two equal `.btn-secondary` (same rank). Viewer: empty copy only.
- Catalog no matches: same `.empty-state` (what happened + clear search / try another name).

**Rationale**: Clarification B for empty bed; FR-011.

**Alternatives considered**: Direct seed as sole primary (rejected in clarify).

## 9. Coverage and e2e

**Decision**: Unit-test `libs/web-ui` and add it to Vitest coverage `include`. Playwright: notice and busy double-submit (auth, Create garden, catalog search/add, Save layout, Add transplant, miss `role="alert"`), Open bed name (including keyboard and 390px), Bed/Area labels, empty gardens/overview/bed. Garden home/forms busy is T016 + quickstart, not a separate spec. Do **not** Playwright-time SC-001 0.5s or SC-007 visual tokens (T036 is accessible-name smoke). Participant studies SC-004/005/006 stay manual except the automated paths that support them (empty list CTA, breadcrumb, Open bed).

**Rationale**: Constitution 80% gate is lib-based today; `apps/web` pages are not in coverage include.

**Alternatives considered**: App-only helpers without a lib (would not raise coverage; weaker library-first).
