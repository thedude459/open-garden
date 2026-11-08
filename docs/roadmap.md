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
| Licensing | **Done:** code is `AGPL-3.0-or-later` (`LICENSE`, `package.json`, README). Follow-up for AGPL section 13: show a "Source code" link in the app (sidebar or sign-in page) pointing at the repository, so people using a hosted copy can get the source. |
| Docker-only install docs | **Done:** README is a four-step Docker install (generated secrets, `PLACE_PROVIDER=live`, no demo users); `docs/deploy.md` covers configuration, network access, HTTPS, backups and restore, upgrades, and troubleshooting; `CONTRIBUTING.md` holds the development setup, tests, CI, and layout. Verified by following the README on a fresh clone, including backup and restore. **Follow-ups found:** (1) `SESSION_SECRET` is required but not used — sessions are random tokens stored hashed; use it (e.g. to sign cookies) or drop the requirement. (2) No way to get an admin without demo users — add a setting such as `ADMIN_EMAIL` that promotes that registered account. (3) Compose defaults to `PLACE_PROVIDER=fixture`; consider `live` as the default for installs and keep `fixture` for tests. |
| Publish images | Build and push `api` and `web` images to GHCR on tagged releases so operators don't need to build from source. Ship a `compose.yaml` that uses the published images. |
| Isolate e2e data | Done on branch `fix-stability-step-1`: `scripts/ci/e2e.sh` defaults to an `open_garden_e2e` database and creates it if missing. Existing test rows in the app database still need a one-time cleanup (or a fresh volume). |
| Remove filler fixtures | `FixturePlantProvider` ships 40 "Pipeline Extra N" plants. Keep test fixtures in test code only. |
| Migrations | **Runner fixed (branch `fix-migrations-run-once`):** `sync-cli` and the Docker entrypoint now both apply migrations with Drizzle's migrator, which records each one in `drizzle.__drizzle_migrations` and never re-runs it. Correction to the earlier finding: Docker installs were already tracked (the entrypoint ran `drizzle-kit migrate`); the run-every-file loop only ran in host mode (`npm run api:sync-plants`, including against the Docker database) and CI. Databases built by the old loop get one catch-up run, then nothing repeats. **Still to do — squash while pre-1.0:** right before the Phase 1 crop/variety change, replace `0001`–`0012` with one idempotent baseline (existing databases are already at that schema) and mark it applied. After the first tagged release, released migrations are never edited — only new ones are added. |
| Repo clutter | **Done:** removed `doc/` (empty generated files), `.cursor/`, and `.superdesign/`. The design system is now `docs/design-system.md`; the `ponytail` coding-style rule is now in `AGENTS.md`. |

### Open-source project hygiene

Review of CI, scanning, images, tooling, and GitHub settings (November 2026).

**Already in good shape:** every action pinned to a commit SHA; per-job
least-privilege `permissions`; concurrency cancel; CodeQL on PR, push, and
weekly; Gitleaks; Trivy + `npm audit` with a base-vs-head gate so only new
findings fail; e2e skipped when a diff cannot change the app; Dependabot for
npm and Actions with sensible groups; branch protection on `main` with all
five checks required, admins included, no force pushes; GitHub secret
scanning with push protection; Dependabot security updates.

**Gaps, highest priority first:**

| # | Area | Finding | Change |
|---|---|---|---|
| 1 | Supply chain | **Done:** `dependabot-automerge.yml` reads `dependabot/fetch-metadata` and auto-merges only patch and minor updates; majors wait for review. | — |
| 2 | Security policy | **Done:** `SECURITY.md` added and private vulnerability reporting enabled on the repository. | — |
| 3 | API image | **Done (#120):** multi-stage build; esbuild bundles the API and boot scripts, so the runtime holds only `dist/`, migrations, and the entrypoint (1.36 GB → 371 MB); runs as uid 1000; npm/npx/corepack removed. Migrations and seed run through the same `sync-cli` path as host mode (#114). | — |
| 4 | Web image | **Done (#120):** `nginx-unprivileged` (uid 101, port 8080) with Alpine security updates, `server_tokens off`, and a strict CSP plus `nosniff`, Referrer-Policy, Permissions-Policy, and frame denial on every location. Compose drops all capabilities and sets `no-new-privileges`. | — |
| 5 | Images in CI | **Done (#115, #120):** base images pinned by digest and updated by Dependabot (`docker`, `docker-compose`); the `images (api)` / `images (web)` job runs hadolint, builds, and fails on fixable HIGH/CRITICAL (Trivy). Both are required checks on `main`. | — |
| 6 | Releases | `version` is `0.0.0`; no tags, releases, or changelog. | Semantic versioning with release-please (or Changesets); on tag, publish multi-arch images to GHCR with SBOM and build provenance (`actions/attest-build-provenance`), optionally signed with cosign. |
| 7 | Community files | GitHub community profile is 42%: no `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue templates, or PR template. | Add all four (Contributor Covenant for the CoC; issue forms for bug, feature, and **data correction**). Add `CODEOWNERS` once there is a second maintainer. |
| 8 | Repo metadata | No topics, homepage, or Discussions. | Topics (`gardening`, `self-hosted`, `pwa`, `angular`, `nestjs`), a homepage (docs or demo), Discussions for questions. |
| 9 | Scorecard | No OpenSSF Scorecard. | Add the Scorecard workflow and badge; it checks most of the above continuously. |
| 10 | Workflow linting | Workflows are not linted. | `actionlint` and `zizmor` (Actions security linter) in CI. |
| 11 | Formatting | Prettier is installed but not enforced. | `prettier --check` in the `verify` job. |
| 12 | Lint depth | ESLint has no Angular template or accessibility rules and no type-aware rules. | Add `angular-eslint` with template accessibility rules and `typescript-eslint` type-checked presets (warn first, then error). |
| 13 | Dependency licenses | No check that dependencies stay license-compatible with the chosen code license. | `license-checker` (or Trivy `--scanners license`) with an allow-list. |
| 14 | `legacy-peer-deps` | `.npmrc` sets `legacy-peer-deps=true`, hiding peer conflicts. | Remove once the TypeScript/typescript-eslint pin is resolved; document why if it must stay. |
| 15 | Personal tool config | **Done:** `.cursor/` and `.superdesign/` removed; design system moved to `docs/design-system.md`. | — |
| 16 | Coverage gate scope | The 80% gate covers domain libs only. | Keep, but publish the coverage report as a CI artifact or PR comment so contributors see it. |
| 17 | Gitleaks action | `gitleaks-action` needs a license key for organization-owned repos. | No action while the repo is personal; switch to the `gitleaks` CLI if it moves to an org. |

### Tests

Review of unit, API, and browser tests (November 2026), measured locally.

**Measured:**

| Suite | Size | Time | Result |
|---|---|---|---|
| Vitest (unit + API contract) | 83 files, 342 tests | ~4.4 s | 316 pass, 26 skipped (live HTTP specs that need `E2E_LIVE=1`) |
| Coverage gate (configured scope) | 1,675 lines | — | 89% lines, 76% branches — passes |
| Coverage of the whole codebase | 5,557 lines | — | **34% lines** |
| e2e, first attempt | 24 API + 46 browser spec files | ~3 min | Interrupted: Docker Desktop's disk went read-only, Postgres stopped, and the API crashed (item 13). 64 passed, 1 failed after the crash |
| e2e, clean run 1 (fresh `open_garden_e2e` database) | same | 2 min 11 s total (Playwright 1.5 min on 2 workers) | **All passed** (live HTTP; Playwright 65 passed, 1 skipped) |
| e2e, clean run 2 (same database, back to back) | same | 1 min 51 s total | Live HTTP passed; Playwright 64 passed, **1 flaky failure** (item 14), 1 skipped |

Coverage by area (lines, whole codebase):

| Area | Lines | Covered |
|---|---|---|
| `apps/web` (Angular pages, services) | 2,699 | 1% |
| `apps/api` (controllers, guards, boot) | 504 | 8% |
| `libs/plant-catalog-data` (repositories, SQL) | 413 | 13% |
| `libs/seasonal-plantings` | 287 | 67% |
| Other domain libs | ~1,650 | 74–99% |

**Already good:** domain logic lives in libraries with fast in-memory fakes;
the Vitest run is quick; Playwright finds elements by accessible role
(about 700 `getByRole` vs 300 CSS locators), uses no fixed sleeps, signs in
through the API with a unique user per test, blocks external map tiles, keeps
traces and screenshots on failure, runs with zero retries so flakiness is
visible, and forbids `.only` in CI. Performance budgets (20-garden list,
planner load, plant search) are tested.

**Gaps, highest priority first:**

| # | Finding | Change |
|---|---|---|
| 1 | The 80% gate measures only domain libraries. The Angular app (half the code) is at 1%, so the gate says little about what users touch. | Report whole-codebase coverage alongside the gate; add a separate, lower threshold for `apps/web` and raise it as component tests land. |
| 2 | Only 2 Angular spec files exist; no component tests. UI behaviour is tested only through slow browser runs. | Add component tests (Angular Testing Library on Vitest) for the large pages as they are split in Phase 3: planner inspector, plantings list, configuration sections. |
| 3 | Repositories in `libs/plant-catalog-data` (all SQL) have no tests of their own and are excluded from coverage. | Integration tests against a real Postgres (Testcontainers or the CI service) with per-test transactions or schemas; include them in a second coverage report. |
| 4 | e2e and the Docker app share the same database (`open_garden` on `:5432`), so test users, properties, and plants appear in the running app. | Use a separate database for e2e (e.g. `open_garden_e2e`, created by the script) or a separate Compose project. |
| 5 | Some "contract" tests assert values they constructed themselves (e.g. `apps/api-e2e/src/gardens.spec.ts` "non-member GET is documented as 404" checks a literal it just built), which inflates counts without testing code. | Remove or replace with a real HTTP assertion. Audit for similar tautologies. |
| 6 | API controllers, guards, and session handling are covered only by the live HTTP specs, which are skipped in the Vitest run and not counted in coverage. | Run live HTTP specs with coverage in the e2e job (or test controllers with Nest's testing module and in-memory repos) and merge the reports. |
| 7 | No accessibility tests. | `@axe-core/playwright` checks on each main page; fail on serious/critical issues. Pairs with the Phase 3 accessibility pass. |
| 8 | Browser tests run only in desktop Chromium, but the app has a mobile layout (the header overlap bug in Phase 3 would have been caught). | Add a mobile project (Pixel/iPhone viewport) for a tagged smoke subset; optionally WebKit for the PWA. |
| 9 | Wall-clock budgets (`< 2000 ms`) run inside the functional e2e job on shared CI runners, which invites flaky failures. | Keep budgets but tag them (`@perf`), run them in their own step with a warm-up, and report timings as an artifact. |
| 10 | Climate, calendar, and reminder logic depends on today's date; only one spec file uses fake timers. | Inject a clock (or use `vi.setSystemTime`) in date-dependent tests, including Southern Hemisphere and year-wrap cases from Phase 2. |
| 11 | Each spec file starts a fresh worker (~88 ms each). | Small win: try `isolate: false` for pure libraries. Not urgent at 4 s. |
| 12 | No visual regression baseline. | Optional, after the Phase 3 redesign settles: Playwright screenshot comparisons for a handful of key screens. |
| 13 | **Bug found during the e2e run:** `createDb` in `libs/plant-catalog-data/src/lib/db.ts` builds a `pg` `Pool` with no `'error'` listener. When Postgres dropped an idle connection, Node threw an unhandled `'error'` event and the whole API process exited. In production, any database restart or network blip takes the API down until Docker restarts it. | Add `pool.on('error', …)` that logs and lets the pool reconnect; set a Compose `restart: unless-stopped` policy; add a test that kills a pooled connection and checks the API still answers. Fix in step 1. |
| 14 | **Flaky test found by running the suite twice:** `createSizedBed` in `apps/web-e2e/src/planner-helpers.ts` checks `await vegetable.count() === 0` before adding a vegetable garden. `count()` does not wait, so when the area list has not rendered yet after navigating back to Overview, the helper adds a second vegetable garden and `planner-beds.spec.ts` fails with a strict-mode violation. Passed in run 1, failed in run 2. | Wait for the layout to finish loading (e.g. a loaded marker or the bed list) before branching, or create the area through the API in setup. Audit other `count()`-then-act helpers. Add a nightly `--repeat-each=3` job to surface flakes before they reach PRs. |
| 15 | e2e runs the API with `tsx` and the web app with the Angular dev server, not the Docker images people actually run. The one `stack-compose` check is skipped unless `STACK_E2E=1`. | Once images are built in CI (hygiene item 5), run the Playwright suite against the Compose stack, as Immich does. Keep the fast host-mode run for local work. |
| 16 | No machine-readable results: CI keeps only the HTML report on failure. | Add the JUnit reporter and publish results to the PR (test summary), so slow and flaky tests are visible over time. |

#### How this compares with similar open-source projects

Checked against the CI and test layout of three active projects (November
2026): **Immich** (self-hosted photos; NestJS + Postgres + TypeScript, the
closest stack), **LiteFarm** (open-source farm management; Node + React +
Postgres), and **Growstuff** (open crop data and garden journals; Rails).

| Practice | Immich | LiteFarm | Growstuff | Open Garden |
|---|---|---|---|---|
| Fast unit tests on every PR | Yes (server, web, CLI) | Yes (API with Jest, webapp unit) | Yes (RSpec) | **Yes**, 4 s |
| Integration tests against a real database | Yes: "medium" tests (~70 files) with Testcontainers, separate Vitest config | Yes: Jest API tests with Postgres | Yes | Only through live HTTP in e2e; repositories untested (item 3) |
| Frontend unit/component tests | Yes (~60 web spec files, plus web "medium" tests) | Yes, plus Chromatic visual tests of Storybook stories | View/feature specs | **No** (2 files, item 2) |
| Browser e2e | Playwright against the Docker Compose stack | Cypress (their wiki reports flakiness on hosted runners) | Feature specs split into parallel jobs by area | **Yes**, Playwright, well structured; host mode, not images (item 15) |
| e2e against built images | Yes | — | — | No (item 15) |
| Runs only what a change affects | Yes (path filters per job) | — | Split by feature area | **Yes** (Nx affected, e2e skip gate) |
| Workflow security linting | Yes (zizmor) | — | — | No (hygiene item 10) |
| API contract / migration checks | Yes (OpenAPI drift check, migration-order check) | — | — | Zod contracts shared; no OpenAPI or migration-order check |
| Accessibility / visual checks | — | Chromatic visual review | — | No (items 7, 12) |
| Artifacts on failure | Playwright report + Docker logs | Cypress Cloud | — | Playwright report and traces; no server logs |

**Takeaways:** Open Garden's fast unit layer, role-based Playwright tests,
change-aware CI, and security scanning are already at or above these
projects. The gaps match what the leading project (Immich) does differently:
a middle layer of real-database tests, frontend component tests, e2e against
the shipped images, and server logs uploaded with failed runs. Add to
item 15: upload the API log as an artifact when e2e fails.

---

## Phase 1 — Open plant dataset

### Decision: separate repository `open-garden-data`

Decided (November 2026): a separate, public repository
`thedude459/open-garden-data`, created when implementation reaches step 3
of the [implementation order](#implementation-order). Reasons:

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
  family, plant type, **growth habit** (tree, shrub, cane, vine,
  herbaceous), **use** (fruit, nut, vegetable, herb, flower), life cycle
  (annual/biennial/perennial), frost
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

### Area types

Decided (November 2026): areas are typed, each type accepts plants by growth
habit and use, mismatches are **blocked**, and bramble is its own type.

| Area type | Accepts | Blocks |
|---|---|---|
| Vegetable | Herbaceous vegetables, herbs, flowers | Trees, shrubs, canes |
| Orchard | Fruit and nut trees; herbaceous underplanting in a tree's bed | Canes, other shrubs, vegetables as main plantings |
| Bramble | Cane fruit (raspberry, blackberry and hybrids) | Trees, vegetables |
| Greenhouse (trays) | Seedlings of herbaceous plants | Trees, shrubs, canes |

- The rules live in one list in code (`libs/shared-types`), shared by API
  validation and the planner UI, so the planner can grey out plants an area
  will not take and explain why. Adding a type (berry bushes, herb spiral,
  perennial border) is one entry plus its rules.
- Replace the `garden_areas.kind` CHECK constraint with validation against
  that list, so a new type needs no constraint migration.
- "Add berry patch" on the Overview becomes "Add bramble area"; existing
  berry stations in orchards move to a bramble area in a migration.
- Remove the legacy `garden_beds.kind` (`bed`/`orchard`) column and its API
  field. It predates areas, and migration 0012 deletes `kind = 'orchard'`
  beds on every boot (see the migrations item in Phase 0).
- Needs the dataset's habit and use fields, so it ships with or after the
  first dataset import.

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
| 14 | Brand mark is a plain leaf-green circle. This is intentional in `docs/design-system.md` ("solid leaf-green circle on sage"), but it reads as a missing image. | Revisit with the design system during the redesign; keep it if it is the chosen mark. |
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
| 1 | Phase 0 (licensing, Docker docs, e2e isolation, filler removal) and hygiene items 1–5 | Small, unblocks everything; licensing must be settled before data contributions start, and the auto-merge and image fixes reduce real risk now. |
| 1a | Test items 13, 14, 1, 4, 5 (pool crash fix, flaky helper, honest coverage report, separate e2e database, remove tautological tests) | Cheap, and they make every later change measurable. Items 2, 3, 7, 8 land alongside Phase 3; item 10 with Phase 2. |
| 1b | Hygiene items 6–17 | Release pipeline before publishing images to GHCR; community files before inviting contributors to the data repo. |
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
- **Code: AGPL-3.0-or-later (decided November 2026).** It keeps the copyleft
  intent of the earlier GPLv2 and also requires anyone who hosts a modified
  version to share their changes — the gap GPLv2 leaves for web apps. All
  non-bot commits were by one author, so relicensing needed no other
  sign-off. Contributions are accepted under the same license (state this in
  `CONTRIBUTING.md`).
- **Icons/artwork:** CC0 if made for the project; otherwise record the
  license per file.

## Open questions

- Which locales besides `en-US` are wanted first?
- Should operators be able to point at a self-hosted dataset mirror, or is
  GitHub Releases enough?
- Is Open-Meteo's non-commercial term acceptable for all expected operators,
  or should the climate step also support importing a precomputed regional
  table?
