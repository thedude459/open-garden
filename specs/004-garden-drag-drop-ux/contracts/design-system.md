# Design System Contract

**Feature**: 004-garden-drag-drop-ux

## Scope

Apply a cohesive visual system to **every in-app screen**:

- `app/page.tsx` (home)
- `app/(auth)/login`, `register`
- `app/(catalog)/plants`, `plants/[id]`
- `app/(garden)/gardens`, `gardens/new`, `gardens/[gardenId]`
- Shared layouts: `app/layout.tsx`, `(catalog)/layout.tsx`, `(garden)/layout.tsx`

External marketing sites are out of scope.

## Semantic Tokens (`app/globals.css`)

All screens MUST use semantic tokens — not hard-coded hex in components.

| Token | Role | WCAG AA target |
|-------|------|----------------|
| `--color-bg` | Page background | — |
| `--color-surface` | Cards, panels | — |
| `--color-on-surface` | Primary text on surface | ≥ 4.5:1 on `--color-surface` |
| `--color-muted` | Secondary text | ≥ 4.5:1 on `--color-surface` |
| `--color-primary` | Primary buttons, links | — |
| `--color-on-primary` | Text on primary buttons | ≥ 4.5:1 on `--color-primary` |
| `--color-secondary` | Secondary button bg | — |
| `--color-on-secondary` | Text on secondary buttons | ≥ 4.5:1 on `--color-secondary` |
| `--color-border` | Borders, dividers | ≥ 3:1 vs adjacent surfaces |
| `--color-focus-ring` | Keyboard focus | ≥ 3:1 vs adjacent |
| `--color-success` | Success toast | ≥ 4.5:1 text |
| `--color-error` | Error toast, violations | ≥ 4.5:1 text |
| `--color-warning` | Advisory warnings | ≥ 4.5:1 text |

Planner aliases (backward compatible):

```css
--planner-toolbar-bg: var(--color-primary);
--planner-panel-bg: var(--color-surface);
--planner-canvas-bg: /* distinct warm neutral, ≥ 3:1 vs bed fills */;
--planner-accent-green: var(--color-primary);
```

## Component Classes

| Class | Requirements |
|-------|--------------|
| `.btn` | `background: var(--color-primary); color: var(--color-on-primary); font-weight: 600` |
| `.btn.secondary` | `background: var(--color-secondary); color: var(--color-on-secondary)` — MUST pass AA |
| `.btn:hover`, `.btn:focus-visible` | Visible state change; `outline` via focus ring |
| `.input`, `select` | Border `--color-border`; focus ring |
| `.card` | Surface + border tokens |
| `.badge` | Sufficient contrast for text |
| `.planner-toolbar .btn` | Toolbar variant for dark bg — use `--color-on-primary` |

## Focus & Hover (FR-011)

- All interactive elements: `:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px }`
- Hover: `filter: brightness(0.95)` or explicit hover token — MUST NOT rely on color alone
- Skip `outline: none` without replacement

## Typography

- Body: Georgia stack (retain brand)
- Headings: same family, `font-weight: 700`
- Button labels: `font-weight: 600`, min 14px effective size
- Field labels: `.field-label` uses `--color-muted`

## Toast Component (`components/ui/Toast.tsx`)

| Variant | Background | Text | Duration |
|---------|------------|------|----------|
| success | `--color-success` tint | `--color-on-surface` | 3000ms |
| error | `--color-error` tint | `--color-on-surface` | 5000ms |
| info | `--color-surface` | `--color-on-surface` | 3000ms |

- Position: fixed bottom-center, max 3 stacked
- `role="status"` + parent `aria-live="polite"`
- Respects `prefers-reduced-motion` (fade only, no slide)

## Acceptance

- [ ] `tests/unit/design-tokens-contrast.test.ts` passes for all token pairs
- [ ] Playwright `accessibility-contrast.spec.ts` axe scan on 5 core routes: 0 serious contrast violations
- [ ] No component uses raw `#hex` for interactive foreground/background (grep audit)
- [ ] Secondary buttons readable on garden planner toolbar and gardens list

## Migration from 003

003 `--planner-*` tokens remain as aliases. Components using inline `style={{ background: "var(--planner-panel-bg)" }}` may keep vars; new work uses semantic tokens.
