# Open Garden — design system (branded household PWA)

## Product

Self-hosted household garden planner. Gardeners plan beds on a scale map, record plantings, and see what to sow or care for this week. Not a marketing site. Not a SaaS landing page. Feels like a field notebook that lives on the phone and the kitchen tablet.

**JTBD:** Open the app and know what to do in the yard today; open a garden and see the map.

**Key screens:** Sign in → Gardens home → Garden Overview (map) → Bed View → Calendar / Reminders → Configuration (site + invite).

## Brand

Name: **Open Garden**. Wordmark in Iowan Old Style. Mark: solid leaf-green circle on sage (`#2f5d3a` on `#e8efe4`) from `apps/web/src/assets/icon-512.png`. Always show the mark beside the wordmark in the nav. Never substitute OG letters, sprouts emoji, or a generic leaf SVG.

Inspired by earthy editorial (forest/sage/cream) but **constrained to this product palette** — no Anton, no 23vw heroes, no 5rem pills, no cart badges.

## Color (only these)

| Token | Hex | Use |
|---|---|---|
| Ink | `#142017` | Body, headings |
| Leaf | `#2f5d3a` | Primary buttons, links, logo fill, active |
| Soil | `#1f2a1f` | Inverse bars, footer if any |
| Moss | `#7a9e7e` | Secondary accents, stand-ins |
| Sand | `#e8efe4` | Page wash, cards |
| Cream | `#f4f7f1` | Raised surfaces |
| Paper | `#ffffff` | Inputs, secondary buttons |
| Muted | `#4d5a4f` | Meta, captions |
| Alert | `#8a1f1f` | Overdue, destructive |
| Warm | `#7a4e00` | Pending / frost prompt |

Page background: soft sage gradient (`#f4f7f1` → `#d5e0d4`) with a faint top-left wash. Optional 4% noise overlay for analog paper — keep subtle.

Dark text is Ink or Soil, never pure black. Primary button is Leaf with **white** label.

## Type

- Display / wordmark / page titles: `"Iowan Old Style", Palatino, Georgia, serif`
- UI / buttons / labels: same family (this product is serif throughout). Do not introduce Inter, Anton, or geometric sans.
- Title ~1.75–2rem; section ~1.15rem/700; body 1rem; meta 0.8–0.9rem
- Status chips (THIS WEEK, OVERDUE) uppercase, tracking 0.04em, weight 700

## Space & shape

- 4 / 8 / 12 / 16 / 24 / 32px scale
- Radius **6–12px** (not 2.5–5rem). Cards 8–12px. Buttons 6px.
- Shadows: `0 1px 3px rgba(47,93,58,.18)` and `0 4px 12px rgba(31,42,31,.16)`
- Content width 960px; planner 1280px

## Components

- **Primary button:** Leaf fill, white text, 0.55rem 0.9rem, clearly labeled
- **Secondary:** white fill, ink text, leaf-tinted border
- **Destructive:** `#8a1f1f` fill, white text
- **Cards / rows:** cream/white 55% over sage, 1px `rgba(47,93,58,.15)` border
- **Banner:** warm paper `#fff4d6` for “Set your site”
- **Map viewport:** grass `#6f8f5c`, beds soil brown

## Layout / flow (redesign intent)

1. **Signed-in home is Gardens**, never the plant catalog.
2. Home answers “what should I do?” then lists yards as rich cards (name, role, zone, overdue, this week), not a single cramped meta line.
3. Create garden is an obvious Leaf button — never white-on-white.
4. Inside a garden: map is the hero; garden nav is a compact pill/tab bar; Configuration is settings, not the landing.
5. First-run empty state is welcoming and branded, with one next step.
6. Desktop: map + rail. Phone: actions above the map.

## Motion

Short 200–300ms ease; no floating ingredient parallax. Busy = 0.7 opacity.

## Do not

- Invent purple, neon, glassmorphism, or Inter/Anton
- Hide primary labels
- Use “Arm”; placement action is **Place**
- Duplicate Create bed on Plantings
