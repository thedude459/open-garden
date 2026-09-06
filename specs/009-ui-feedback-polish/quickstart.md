# Quickstart: UI Feedback & Garden Usability Polish

**Feature**: `009-ui-feedback-polish` | **Date**: 2026-08-22

## Prerequisites

- 008 planner stack runs (migrate through `0008`, fixture plants)
- Node.js LTS / npm

## Local stack

```bash
docker compose up -d postgres
npm run migrate
npm run api:sync-plants
# terminal 1
npm run api:serve
# terminal 2
npm run web:serve
```

Demo: `gardener@example.com` / `password123`. Web: `http://localhost:4200`.

## Automated tests (same as CI)

```bash
npm test          # Vitest + coverage ≥80% (includes libs/web-ui)
npm run e2e       # Playwright Chromium
npm run test:all  # both
```

## Verify action feedback (P1)

1. Sign in: **Login** shows busy immediately; success lands on catalog (no leftover login notice).
2. Gardens: **Create garden** busy; garden appears; if the list is still showing, a success **Notification** appears and goes away in about **4 seconds** without Dismiss.
3. Catalog: search shows busy on the search control; add/favorite shows a success notice if the gardener stays on the screen.
4. Garden home (manual): **Save garden** busy + success notice; confirmed **Delete garden** removes the garden with no leftover success notice.
5. Overview: **Save layout** (after a draft move) busy; success notice; **Unsaved changes** clears. Double-click Save once: one save.
6. Transplants: **Add transplant** busy + success notice if still on the screen.
7. Offline (owner): Save or Create bed → **need to be online** (or equivalent) as a persistent error notice with **Dismiss**; draft unchanged; control not stuck busy.
8. Bed View: drop a planting off the bed → **Drop missed a bed** stays until **Dismiss** (`role="alert"`). Valid drop → object moves + **Unsaved changes**, no success notice.

## Verify navigation (P1)

1. Overview `You are here` shows garden name and **Garden Overview**. Beds show **Bed**; areas show **Area** (hatch, not color only).
2. Hover/focus a bed: Open bed cue. **Open bed {name}** in the rail opens Bed View (keyboard: Tab + Enter). Click bed without drag: Bed View. Drag bed: moves, stays on Overview. At ~390px width, **Open bed** and **Back to overview** remain usable.
3. Bed View `You are here` is garden > bed name. **Back to overview** returns without losing unsaved draft.

## Verify empty states (P2)

1. New account, gardens list: empty-state copy plus **Create garden** (not muted-only). If already offline, the empty-state body uses the existing online-required wording.
2. New garden Overview: empty-state plus **Create bed**. If already offline, the empty-state body uses the existing online-required wording.
3. Empty Bed View: **Direct seed** and **Transplants** both shown, equal rank. Viewer: explanation only. If already offline, the empty-state body uses the existing online-required wording.

## Verify visual language (P2, manual)

Walk gardens list, overview, bed view, catalog, sign-in: one spacing rhythm, card elevation, three button ranks, shared loading/empty/error look (SC-007). Playwright `ui-visual-smoke.spec.ts` only checks accessible names, not CSS.

## Manual gates (not Playwright timing)

- Busy visible in under 0.5s after click (SC-001).
- Untrained: beds vs areas (SC-004); home → Overview → bed → Overview under 30s (SC-005); zero-garden create under 15s (SC-006).
