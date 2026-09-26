# Theme tokens

## Compact summary

**Colors**
- `--soil` #1f2a1f
- `--leaf` #2f5d3a (brand / primary buttons / links)
- `--moss` #7a9e7e
- `--sand` #e8efe4
- `--ink` #142017 (body text)
- muted #4d5a4f
- error / destructive #8a1f1f
- attention amber #7a4e00
- this-week #1f4d2a
- plan soil #4e3423 / bed frame #8a6239
- viewport grass #6f8f5c → #5f7d4e

**Type**
- Family: Iowan Old Style, Palatino Linotype, Palatino, Georgia, serif
- Wordmark ~1.75rem, letter-spacing -0.02em
- Empty-state title 1.15rem / 700
- Labels uppercase 0.8rem tracking 0.04em for this-week / pending

**Space**
- `--space-1` 4px … `--space-6` 32px
- Shell padding 1.5rem, max-width 960px (1280px when `.planner`)
- Filter / form gap 0.75rem
- Button padding 0.55rem 0.75rem

**Radius / elevation**
- `--radius` 6px
- `--elev-1` 0 1px 3px rgba(47,93,58,.18)
- `--elev-2` 0 4px 12px rgba(31,42,31,.16)

**Breakpoints**
- Planner two-column from 840px; rail first below 839px

**Motion**
- None specified beyond busy opacity 0.7

## Raw source

Full file: `apps/web/src/styles.css` (see workspace). Token block:

```css
:root {
  --soil: #1f2a1f;
  --leaf: #2f5d3a;
  --moss: #7a9e7e;
  --sand: #e8efe4;
  --ink: #142017;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --radius: 6px;
  --elev-1: 0 1px 3px rgba(47, 93, 58, 0.18);
  --elev-2: 0 4px 12px rgba(31, 42, 31, 0.16);
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
}
body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background:
    radial-gradient(circle at top left, #dfead8 0%, transparent 40%),
    linear-gradient(160deg, #f4f7f1 0%, #e4ebe0 55%, #d5e0d4 100%);
}
```
