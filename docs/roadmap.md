# Open Garden Roadmap

Status: draft, November 2026. Replaces the Spec Kit `specs/` folders (see
ADR 0017). Each phase ships as one or more pull requests; lasting decisions
get an ADR.

## Goals

1. **Runs anywhere.** One supported install path: Docker Compose. Where it
   is hosted is the operator's choice.
2. **Works worldwide.** US is the first-class case, but climate, frost
   dates, zones, units, and hemispheres must not assume the US.
3. **Open data.** The plant catalog is free to use, redistribute, and
   improve, with provenance for every value.
4. **Great day-to-day UX.** Opening the app answers "what should I do in
   the garden this week?"

---

## Phase 0 — Housekeeping

| Item | Notes |
|---|---|
| Retire Spec Kit | Done on branch `remove-speckit` (ADR 0017). Constitution is now `AGENTS.md`; `CLAUDE.md` imports it. |
| Decide licensing | See [Licensing](#licensing). Fix the mismatch: `LICENSE` is GPLv2, `package.json` says MIT. |
| Docker-only install docs | README "Quick start" becomes `docker compose --profile app up -d`. Host-mode dev loop, NAS notes, and test commands move to `CONTRIBUTING.md`. Add a short "Deploying" page with environment variables only (no platform-specific steps). |
| Publish images | Build and push `api` and `web` images to GHCR on tagged releases so operators don't need to build from source. Ship a `compose.yaml` that uses the published images. |
| Isolate e2e data | The Docker stack's catalog and property list show leftover test rows ("Load Tomato" ×N, "Clickthrough …" properties). e2e must use its own database or Compose project name. |
| Remove filler fixtures | `FixturePlantProvider` ships 40 "Pipeline Extra N" plants. Keep test fixtures in test code only. |

---

## Phase 1 — Open plant dataset

### Decision: separate repository `open-garden-data`

Recommended. Reasons:

- **Different license.** Data is CC0; code has its own license. Separate repos
  keep that boundary obvious to contributors and downstream users.
- **Different contributors.** Gardeners can fix sowing windows without
  touching TypeScript, Nx, or the 80% coverage gate.
- **Reusable.** Other apps can consume the dataset without this app.
- **Different release cadence.** The data is versioned on its own; the app
  pins a dataset version.

What stays in the app repo: the importer and the database schema. What
moves out: the source fetching, merging, and curation. The in-app
multi-source pipeline (scheduler, source order, merge decisions,
`/admin/pipeline`) shrinks to "import dataset version X and show what
changed."

### Data repo layout

```
open-garden-data/
  LICENSE                  # CC0-1.0
  schema/catalog.schema.json
  crops/tomato.yaml        # one file per crop, varieties nested
  families.yaml            # Solanaceae, Brassicaceae, …
  companions.yaml          # pairs with kind, reason, source
  sources.yaml             # every source with license + URL
  scripts/                 # validate, build, import helpers
  .github/workflows/       # validate on PR, build release on tag
```

Release artifact: `open-garden-catalog-<version>.json` (+ SHA-256) attached
to a GitHub Release. The app's Docker image bundles a pinned version so a
fresh install works offline; operators can import a newer one from the admin
page.

### Data model (v1)

- **Crop** (species level): id, common names (by locale), scientific name,
  family, plant type, life cycle (annual/biennial/perennial), frost
  tolerance (tender/half-hardy/hardy), min/opt/max growing temperature,
  sun, water, spacing (in-row, between-row), depth, germination days,
  sowing windows relative to frost (indoor start, direct sow, transplant),
  and a fallback window by soil/air temperature for frost-free climates.
- **Variety**: id, crop id, name, days to maturity, notes, optional
  overrides of crop fields.
- **Companion pair**: crop A, crop B, kind (helps/hinders/attracts
  pollinators), reason, source.
- **Provenance**: every value may carry `source` and `confidence`; the
  importer stores the source id so the UI can show "where does this come
  from?"

The app database gains a `crops` table and `plants` becomes varieties
pointing at it. Companion pairs move from per-garden to catalog data; a
household can still add or override its own pairs. This needs a principle
VIII change in `AGENTS.md`, since that principle says companion pairs stay
household data until a real source exists.

### Sources (all compatible with CC0 output)

| Source | License | Use |
|---|---|---|
| OpenFarm rescue (`thefullnacho/openfarm-crops-rescue`) | CC0 (claimed — verify per record) | Bootstrap growing guides, spacing, companions for ~340 crops |
| USDA PLANTS | Public domain | Scientific names, US native status |
| Wikidata | CC0 | Taxonomy, family, common names in many languages, links |
| Hand curation | CC0 (contributors agree via PR template) | Sowing windows and temperatures for the top 150 home-garden crops |
| Your own seed packets / extension-service reading | Facts are not copyrightable; write in your own words | Cross-checking windows |

Not used: Growstuff, Permapeople, Practical Plants (CC BY-SA share-alike
would force the dataset to BY-SA), PFAF (restrictive), Perenual (no key,
thin fields — it hard-codes zones 3–9 and sowing data is empty).

Images: start with a consistent set of crop icons made for the project
(CC0). Photos only from Wikimedia Commons with per-image license and
attribution stored alongside.

### Curation workflow

1. Contributors edit YAML in a PR; CI validates against the schema and runs
   sanity checks (window ordering, spacing ranges, duplicate names, every
   companion references a real crop).
2. In the app, any user can **suggest a correction** on a plant page. Admins
   see suggestions in the admin area and export them as a ready-to-file
   issue or patch for the data repo.
3. Households can add **custom varieties** that live only in their property
   (e.g. a family heirloom), optionally offered upstream.

### App changes

- New `DatasetReleaseProvider` behind the existing provider port; delete
  `PerenualPlantProvider`, `FixtureBPlantProvider`, scheduler and source
  ordering. Keep the run history table for import diffs.
- Admin page becomes "Catalog version": current version, available
  version, import, and the diff (added/changed/deprecated).

---

## Phase 2 — Worldwide climate

Current state: zone lookup is US-only (`phzmapi.org`, needs a 5-digit ZIP),
frost dates come from FarmSense (US stations, old dataset), and
`keepFrostPair` drops any pair where last frost is later in the calendar
year than first frost — which is every Southern Hemisphere garden.

| Item | Approach |
|---|---|
| Frost dates anywhere | Compute from Open-Meteo historical daily minimum temperature (already used for rain outlook; no key). Median last spring / first fall day ≤ 0 °C over the last 30 years, plus a 10%-risk date. Cache per rounded lat/long. |
| Hardiness zone anywhere | Derive from mean annual extreme minimum over the same 30 years using the USDA temperature bands (the bands are just numbers and work globally). Keep the zone label, show °C/°F. |
| Southern Hemisphere | Treat the growing season as a range that may wrap the year end. Fix `keepFrostPair` and calendar math. |
| Frost-free climates | Use the crop's temperature window and wet/dry season instead of frost anchors. |
| Units | Per-user metric/imperial setting; store metric internally, display either. |
| Locale | Month names instead of numbers, locale date formats, crop common names by locale from Wikidata. |
| Drop | `phzmapi.org`, FarmSense. Keep Nominatim (respect its 1 req/s and User-Agent policy) and Open-Meteo (note its non-commercial terms in the deploy docs). |

---

## Phase 3 — UI/UX

Findings from running the Docker stack (desktop 1280×800 and mobile
375×812):

| # | Finding | Change |
|---|---|---|
| 1 | No desktop home screen; the app opens on a property list. On mobile, "Today" is the per-garden Reminders page with "Nothing due or not ready yet." | **Today** home across all properties: tasks due, sow/plant windows open this week, frost/heat/rain alerts, quick log buttons. Empty state explains what will appear and links to the next step. |
| 2 | Placing a tomato in a bed does not put it on the Planting calendar; the calendar needs a separate catalog search. | Calendar is derived from plantings (and "planned" crops). Searching to add means "plan it", not a second list. |
| 3 | Plantings page renders every planting as an open edit form (dates, note, photo, life cycle, save, sow again). Bed rename/sun/ground/mulch is duplicated here and on Overview. | List or table, one row per planting with status chips; click opens an edit drawer. Bed settings live in one place. |
| 4 | Overview side panel stacks the selected bed's editor with create forms for bed, vegetable garden, tree, berry patch, tray, walkway. Size inputs show "8" and "4" without labels or units. Zoom/Save scroll away. | Toolbar with an **Add** menu; side panel is a contextual inspector for the selected object only. Labelled inputs with units. Sticky toolbar. |
| 5 | Clicking outside a bed shows "Does not fit in this bed". | Say "Click inside the bed to place it", and highlight valid drop areas while placing. |
| 6 | The bed is a small rectangle in a large empty canvas. | Fit-to-content on open; remember zoom per property. |
| 7 | Explicit Save layout with an "Unsaved changes" badge and a leave guard. | Autosave with undo (keeps the offline queue). |
| 8 | Configuration mixes season close, companions, name, size, address, zone, frost (month numbers 1–12), members, delete. | Sections or tabs: Property · Location & climate · Members · Seasons · Danger zone. Month names; climate auto-filled from location with "override" toggle. |
| 9 | Companions are entered by hand per garden. | Shown automatically from the catalog in the planner and plant page; household overrides stay possible. |
| 10 | Catalog shows letter-in-a-square avatars, no images, thin detail page (type, zones, sun, water, maturity, spacing), only action is favorite. | Crop icons, filters (season, family, "can sow now"), detail page with sowing timeline for **your** location, companions, varieties, and "Add to a bed / plan". |
| 11 | Property cards say "0 placements" and show only zone. | Small map or layout thumbnail, plant count, next task. Plain words ("plants", not "placements"). |
| 12 | Mobile: the floating Menu button overlaps the page title. Overview stacks all create forms under the canvas. | Fix header layout; on mobile the canvas is view-first with a bottom sheet for actions. |
| 13 | Vocabulary varies: Transplant View, Planting tray, Direct seed, placements. | Glossary in `AGENTS.md`; one term per concept. Fold Transplants into a "Seed starting" section of Calendar. |
| 14 | Brand mark renders as a plain dark circle. | Real icon/wordmark; reuse for PWA icons. |
| 15 | Six per-garden nav items. | Four: **Plan** (layout + plantings), **Calendar** (incl. seed starting), **Tasks**, **Settings**. |

Also: guided first run (name → location → climate auto-filled → pick crops
from "popular in your climate" → first bed), and an accessibility pass
(keyboard placement in the planner, focus order, contrast on the green
canvas).

Large page components to split before or during this phase:
`garden-layout.page.ts` (852 lines), `garden-plantings.page.ts` (763),
`garden-detail.page.ts` (707), `garden-bed-view.page.ts` (653).

---

## Phase 4 — Features

In rough priority order:

1. **Crop rotation hints** — family per crop + year records → "Brassicas
   were in North last year." Advice only.
2. **Succession planting** — "every 2 weeks until <date>" creates a series.
3. **Seed inventory** — packets, quantity, year; viability by crop;
   "what can I sow this week from what I have?"
4. **Weather alerts** — frost and heat warnings from the Open-Meteo forecast
   against tender plantings.
5. **Harvest totals** — yields per crop per year from
   `garden_planting_harvests`.
6. **Journal** — dated notes with photos on a planting, bed, or property.
7. **Household tasks** — assign a reminder to a member; done-by history.
8. **Export** — iCal feed per property, CSV export of plantings and
   harvests, full JSON backup/restore.
9. **Custom varieties + suggest corrections** (from Phase 1 curation).

---

## Implementation order

| Order | Work | Why this order |
|---|---|---|
| 1 | Phase 0 (licensing, Docker docs, e2e isolation, filler removal) | Small, unblocks everything, and licensing must be settled before data contributions start. |
| 2 | Quick UX fixes: #5, #8 month names, #12 header overlap, #13 vocabulary | Cheap, visible wins; no dependency on data. |
| 3 | Phase 1 data repo + schema + first 50 crops + importer | Today, Calendar, and rotation all need real sowing windows and families. |
| 4 | Phase 2 climate | Frost/zone everywhere makes the dataset's windows usable outside the US. |
| 5 | Phase 3 core: Today home, calendar from plantings, plantings list, nav to four items, planner inspector | Builds on 3–4. |
| 6 | Grow dataset to ~150 crops; companions from data | Runs in parallel in the data repo once the schema is stable. |
| 7 | Phase 3 remaining + onboarding | |
| 8 | Phase 4 features, in the order listed | |

---

## Licensing

- **Data (`open-garden-data`): CC0-1.0.** Maximally free; compatible with
  OpenFarm (CC0), USDA (public domain), and Wikidata (CC0). Requires
  avoiding share-alike sources.
- **Code: AGPL-3.0-or-later recommended.** It keeps the current copyleft
  intent of GPLv2 and also requires anyone who hosts a modified version to
  share their changes — the gap GPLv2 leaves for web apps. If the priority
  is the widest possible reuse (including closed forks), choose MIT instead.
  Either way, make `LICENSE` and `package.json` agree. All non-bot commits
  are by one author, so relicensing needs no other sign-off.
- **Icons/artwork:** CC0 if made for the project; otherwise record the
  license per file.

## Open questions

- Which locales besides `en-US` are wanted first?
- Should operators be able to point at a self-hosted dataset mirror, or is
  GitHub Releases enough?
- Is Open-Meteo's non-commercial term acceptable for all expected operators,
  or should the climate step also support importing a precomputed regional
  table?
