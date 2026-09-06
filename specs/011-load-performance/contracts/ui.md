# UI contract (Playwright)

**Feature**: `011-load-performance`

Keep 008–010 names (`Garden Overview`, `Save layout`, plant panel, `.plant-stand-in`, empty states). This feature adds counts on the garden list and illustration-or-stand-in on search results without extra data fetches.

## Garden list

| Surface | Rule |
|---------|------|
| Each garden row | Shows name, role, zone (existing) **and** bed count and placement count (including `0`) |
| Empty list | Existing empty state; no count lookups required |
| Load | One `GET /api/gardens` (plus auth if needed). MUST NOT `GET` layout or garden-by-id per row to obtain counts |
| Interactive (SC-007) | From requesting the list until a garden link is clickable: **≤ 2s** on a **20-garden** account |

## Garden Overview / Bed View

| Surface | Rule |
|---------|------|
| Spacing / canopy | Same visual meaning as 010 (`plantingFootprintRadius`). No per-planting illustration or plant-detail fetch to size marks |
| Load | `GET` layout and `GET` garden detail **in parallel** (not sequential). No extra plant GETs per placement |
| Interactive | From requesting Overview or Bed View until pan/zoom (or bed select) works: **≤ 2s** on a **100-placement** garden. MUST NOT wait for picture files |

Viewers: same load; still cannot mutate.

## Plant search (catalog page + Bed View panel)

| Surface | Rule |
|---------|------|
| Result identity | Name, category, climate indicator when zone filter on (010). Visual: `<img>` when `illustrationUrl` is a string; otherwise existing `.plant-stand-in` |
| Data requests | Number of XHR/fetch calls to catalog **data** endpoints MUST NOT increase with result count. `GET /api/plants/:id` per row is forbidden for rendering the list |
| Pictures | `img` loads from `illustrationUrl` allowed; MUST NOT block interactivity |
| Interactive | From Apply / search until results (or empty state) are usable: **≤ 2s** for a typical page (≥10 matches when asserting SC-004) |

## Automated check (must fail)

Playwright (or api-e2e + Playwright together) MUST fail CI when:

- List counts are wrong or fetched per garden  
- Layout load issues per-placement data GETs  
- Search issues per-result data GETs  
- 1s assembly or 2s interactive budgets miss on the fixtures  

Tests MUST print or attach the three path timings (`garden.list`, `garden.layout` / overview-bed, `plants.list`) so a failure is diagnosable.
