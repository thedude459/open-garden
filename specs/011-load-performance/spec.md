# Feature Specification: Load Performance

**Feature Branch**: `011-load-performance`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Improve garden and plant-search load performance by eliminating N+1 query patterns and unnecessary per-item network round-trips.

Garden List Loading:
- Fetching the user's garden list must not issue a separate query per garden for bed count and placement count; these counts must be retrieved in a constant number of queries regardless of how many gardens the user has (e.g., via a joined/aggregated query or a single batched lookup).
- List load time must not grow noticeably with the number of gardens a user owns (verify with a test account containing at least 20 gardens).

Garden & Bed Detail Loading:
- Loading a garden's full detail (used by both the Garden Overview and Bed View) must not resolve plant spacing and canopy radius one placement at a time in a sequential loop. These lookups must be batched (single query per data type covering all placements in the garden) or otherwise parallelized so total load time does not scale linearly with placement count.
- Load time for a garden with a large number of plantings (100+) must stay within a reasonable target (define an explicit budget, e.g., under 1 second server-side) and must be covered by a performance regression test or benchmark.

Plant Search & Illustrations:
- The plant search endpoint must return everything needed to render a result (including illustration URL) in a single response, rather than requiring one additional network request per result to fetch its illustration.
- Searching and displaying results must not produce a number of network requests that scales with the number of results shown.

General:
- Identify and fix any other sequential per-row database calls in hot paths touched by these screens (garden list, garden overview, bed view, plant search) using the same batching approach.
- Add basic timing/logging or a lightweight performance test so future regressions in these specific paths (garden list, garden detail, plant search) are caught before release.

Acceptance:
- Loading the garden list, garden overview, and bed view for a garden with realistic data volume (20+ gardens, 100+ placements) completes noticeably faster than current behavior, with no linear-per-item query growth remaining in the code paths above."

## Clarifications

### Session 2026-08-23

- Q: Do illustration **picture files** count against “network requests must not scale with results”? → A: **No.** Search returns illustration location (or stand-in) in the result. Extra **data** fetches per result are forbidden. Browser/image loads for pictures are allowed.
- Q: Is the **1-second** budget full page-load or payload assembly? → A: **Payload assembly only** (gathering list or garden-detail data: counts, placements, spacing, canopy). Not a full page-load including fonts, pictures, or a slow device.
- Q: How soon must the gardener be able to **interact** with the screen? → A: **2 seconds or less** from requesting garden list, Garden Overview, Bed View, or plant search until the screen is interactive (scroll, tap, pan, type). Does not require every picture file to finish loading.
- Q: How must regressions be **caught**? → A: **Automated failing check and basic timings** on garden list, garden detail, and plant search. Timings-only is not enough.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Garden List Stays Fast as the Household Grows (Priority: P1)

A signed-in gardener who belongs to many gardens opens the garden list. Each garden shows name, role, zone, **and** how many beds and placements it has (those counts are new on this list). Opening the list does not get slower in proportion to how many gardens they belong to. A household with twenty or more gardens sees the list become ready about as promptly as a household with a few gardens, and can start using it within two seconds.

**Why this priority**: The garden list is the front door to planning. Extra work per garden makes every visit slower as the household adds gardens, and that cost hits before any other screen.

**Independent Test**: Sign in as a member of at least 20 gardens (owned or shared). Open the garden list. Confirm names and bed/placement counts are correct, and that preparing the list does not do extra per-garden lookups for those counts. Confirm the list is interactive within 2 seconds. Repeat with a 1-garden account and confirm 20-garden assembly is not linearly slower.

**Acceptance Scenarios**:

1. **Given** a member who belongs to 20 or more gardens, **When** they open the garden list, **Then** every garden they belong to appears with accurate bed count and placement count.
2. **Given** that same list load, **When** bed and placement counts are assembled, **Then** the amount of extra lookup work does **not** grow with garden count (a small fixed number of lookups, not one extra lookup per garden).
3. **Given** a member of 20 gardens and a member of 1 garden, **When** each opens the garden list under similar conditions, **Then** assembling the 20-garden list payload completes in **under 1 second** and is not on the order of 20 times slower than assembling a 1-garden list.
4. **Given** a member of 20 or more gardens, **When** they open the garden list, **Then** they can interact with it (scroll, open a garden) in **2 seconds or less**. This does not require every optional visual to finish loading.
5. **Given** a garden with zero beds or zero placements, **When** it appears on the list, **Then** counts show zero (not blank, not guessed, not omitted as if the garden were missing).
6. **Given** a viewer of a shared garden, **When** they open the garden list, **Then** they see that garden’s counts the same way an owner does; they still cannot change the garden.

---

### User Story 2 - Garden Overview and Bed View Stay Fast with Many Plantings (Priority: P1)

A gardener opens Garden Overview or Bed View for a garden that already has a large number of plantings (100 or more placements). Spacing and canopy size for those plantings are still correct on the map and in the bed, but the screen does not wait through one lookup after another per planting. Preparing the garden’s full detail finishes within an explicit time budget and does not get linearly slower as placements are added. The gardener can pan, zoom, or otherwise use the view within two seconds.

**Why this priority**: Overview and Bed View are the daily planning surfaces. Linear slowdown with planting count makes a realistic garden feel broken even when the map is correct.

**Independent Test**: Open Overview and Bed View for a garden with 100+ placements. Confirm plantings render with correct spacing and canopy. Confirm spacing is not resolved one planting at a time and canopy is derived from that join. Confirm preparing that garden’s layout payload finishes in under 1 second and the view is interactive within 2 seconds. A viewer can open the same views but cannot edit.

**Acceptance Scenarios**:

1. **Given** a garden with 100 or more placements, **When** an owner, collaborator, or viewer opens Garden Overview, **Then** beds, areas, and planting marks appear with the same meaning as today, including spacing- and canopy-based size where those values exist.
2. **Given** the same garden, **When** they open Bed View for a bed that contains plantings, **Then** plantings in that bed render with correct spacing and canopy, and the rest of the garden’s detail used by Bed View is already available without a second slow sequential pass.
3. **Given** those loads, **When** spacing and canopy are resolved for all placements in the garden, **Then** spacing comes from one join covering every placement and canopy is derived from that spacing in the same in-memory pass so total time does **not** grow linearly with placement count.
4. **Given** a garden with 100 or more placements, **When** the household requests the layout payload Overview and Bed View both use, **Then** assembling that layout (beds, areas, plantings, spacing, derived canopy) completes in **under 1 second**. Garden name/zone/counts MAY load in parallel and are not a second 1-second budget.
5. **Given** a garden with 100 or more placements, **When** they open Overview or Bed View, **Then** they can interact with the view (pan, zoom, select) in **2 seconds or less**. Remaining picture-file loads MUST NOT block interaction.
6. **Given** placements whose plant has no canopy value, **When** Overview or Bed View renders, **Then** the existing stand-in / default visual still appears; missing canopy MUST NOT force per-planting extra round-trips or block the rest of the garden from loading.
7. **Given** a viewer, **When** they open Overview or Bed View, **Then** they get the same timely, complete picture and still cannot place, move, or save.

---

### User Story 3 - Plant Search Results Appear Complete Without Per-Result Fetches (Priority: P2)

A gardener searches plants on the standalone catalog or in the Bed View plant panel. Each visible result already has everything needed to identify it, including its illustration location when one exists (or the existing visual stand-in when it does not). Displaying a page of results does not fire one extra **data** request per result to look up illustration location or other display fields. Loading the actual picture files (normal image display) is allowed. The gardener can read and act on results within two seconds.

**Why this priority**: Search is used while planning. Per-result data fetches to discover illustrations make a normal result list feel laggy and wasteful; putting identity on the result itself fixes both catalog and in-planner search.

**Independent Test**: Search so that at least 10 matching results appear (catalog and Bed View panel). Confirm each result shows illustration or stand-in, name, and other existing identity fields without a follow-up **data** fetch per row to resolve illustration location. Confirm data-request count does not grow with how many results are shown. Confirm results are interactive within 2 seconds. Picture-file loads may still occur per illustrated result.

**Acceptance Scenarios**:

1. **Given** a name (and optional type/zone) search that matches multiple plants, **When** results are shown on the Plants catalog, **Then** each result includes everything already required to render it, including an illustration location when the plant has one.
2. **Given** the same kind of search in the Bed View plant panel, **When** results are shown, **Then** those results are equally complete (illustration or stand-in, name, category, and climate indicator when that filter is on) without extra per-result **data** fetches.
3. **Given** a result set of 10 or more matches, **When** the gardener views that page of results, **Then** the number of **data** requests used to show the list does **not** scale with the number of results (no one-extra-data-request-per-row pattern). Loading picture files for illustrated rows is allowed and does not fail this scenario.
4. **Given** a typical search (10 or more matches), **When** results are requested, **Then** the gardener can interact with the result list (scroll, open, drag/arm) in **2 seconds or less**. Picture-file loads MUST NOT block that interaction.
5. **Given** a matching plant with no illustration, **When** it appears in results, **Then** the existing visual stand-in is used; search still succeeds and does not issue a failed per-row illustration **data** fetch.
6. **Given** a search with zero matches, **When** results are empty, **Then** the existing empty / provisional path still appears, and no per-result illustration data requests are made.

---

### User Story 4 - Hot-Path Slowdowns Are Found Before Release (Priority: P3)

The team can tell when garden list, garden detail, or plant search has become slow again. An automated check on those three paths fails before release if budgets or per-item growth return. Basic timings on the same paths make a failure diagnosable.

**Why this priority**: Batching only helps if it stays. Without a failing check on these exact paths, the next feature can restore linear per-item work unnoticed.

**Independent Test**: Run the automated performance check for garden list (20+ gardens), garden detail (100+ placements), and plant search. Confirm it fails if the budgets in this spec are exceeded or if per-item lookup growth returns. Confirm timings exist for those three paths so a failure can be attributed.

**Acceptance Scenarios**:

1. **Given** the garden-list, garden-detail, and plant-search paths, **When** a change would make list work grow per garden, detail work grow per placement, or search issue one extra **data** request per result, **Then** an automated check fails before release.
2. **Given** those same paths under the volume in this spec (20+ gardens, 100+ placements, a typical search page), **When** the check runs, **Then** it also fails if the 1-second assembly budgets or the 2-second interactive budgets are exceeded.
3. **Given** those same paths, **When** the check fails, **Then** basic timings for garden list, garden detail, and plant search are available so the failure can be diagnosed.
4. **Given** other sequential per-row lookups on these same screens (not only counts, spacing, canopy, and illustrations), **When** this feature is done, **Then** those lookups use the same “one pass for all rows” approach; leftover one-row-at-a-time work on these hot paths is in scope.

---

### Edge Cases

- Empty garden list (member of zero gardens): empty state is unchanged; no extra count lookups; empty state is still interactive within 2 seconds.
- Garden with many beds but zero placements, or many placements in one bed: counts and detail still meet the same budgets and batching rules.
- Member of both owned and shared gardens: list load still uses a constant number of count lookups for the whole list.
- Plant search page with a mix of illustrated and non-illustrated plants: illustrated rows use the illustration location from the search result (picture files may then load); others use the stand-in; **data** request count still does not grow with result count; interaction is not blocked on picture-file loads.
- Offline after a previous successful load: previously loaded garden list and garden detail remain readable (existing offline rule). This feature does not add a new offline search.
- Viewer vs owner: same load-time expectations; permissions unchanged.
- Very large garden far above 100 placements: time MUST NOT grow linearly per placement; the 1-second assembly and 2-second interactive budgets are the gates at 20 gardens / 100 placements; beyond that, work stays batched even if wall-clock exceeds those budgets on extreme fixtures.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Loading the current user’s garden list MUST return each garden they belong to with accurate bed count and placement count, without doing extra lookup work that grows with the number of gardens (counts MUST be obtained in a constant number of lookups for the whole list).
- **FR-002**: Garden-list assembly time MUST NOT grow in proportion to garden count. Assembling a list of 20 gardens MUST complete in **under 1 second** under the same conditions used for a small list, and MUST NOT take on the order of 20 times as long as assembling a 1-garden list. This budget is payload assembly only, not full page-load.
- **FR-003**: Loading garden layout (shared by Garden Overview and Bed View) MUST resolve plant spacing for all placements without a sequential one-placement-at-a-time lookup. Spacing MUST come from one join covering every placement. Canopy/footprint radius MUST be **derived from that spacing in the same in-memory pass** (existing `plantingFootprintRadius`; default when spacing is null). MUST NOT add a canopy column or a second per-placement lookup.
- **FR-004**: Assembling the **layout payload** (`LayoutService.get`: beds, areas, plantings, spacing, derived canopy) for a garden with **100 or more** placements MUST complete in **under 1 second**. This budget is layout assembly only, not full page-load and not a sequential garden GET. Overview/Bed View MAY also GET garden detail (name/zone/counts) **in parallel**; that second GET is not a second 1-second budget. The 2-second interactive budget includes both round-trips.
- **FR-005**: Plant search results (standalone catalog and Bed View plant panel) MUST include everything already required to render a result in that one result set, including the illustration location when the plant has an illustration. This feature does **not** ship catalog artwork; `illustrationUrl` MAY be `null` on every result. The existing visual stand-in MUST still render. A later feature may populate URLs without changing this contract.
- **FR-006**: Showing a page of plant search results MUST NOT issue a number of **data** requests that scales with how many results are displayed (MUST NOT fetch illustration location or other display fields one extra time per result). Loading picture files from those locations is allowed and MUST NOT be counted as a failing per-result data fetch.
- **FR-007**: Other sequential per-row lookups on the garden list, Garden Overview, Bed View, and plant search hot paths MUST be converted to the same batched/constant-cost approach as part of this feature.
- **FR-008**: An automated performance check MUST cover garden list, garden detail, and plant search, MUST fail when FR-001–FR-006 and FR-011 budgets or per-item growth rules are violated, and MUST record basic timings for those three paths so a failure can be diagnosed. Timings without a failing check are not sufficient.
- **FR-009**: Displayed data MUST remain correct: list counts match stored beds and placements; Overview and Bed View spacing and canopy match stored plant data; search identity matches the catalog. Speed MUST NOT be achieved by omitting, guessing, or stale-wrong values.
- **FR-010**: This feature MUST NOT change who can see or edit gardens, plantings, or catalog search. Existing owner / collaborator / viewer rules still apply. Catalog search remains available to signed-in users as it is today.
- **FR-011**: From the gardener requesting garden list, Garden Overview, Bed View, or plant search (at the volumes in this spec), the screen MUST be **interactive within 2 seconds or less** (scroll, tap, pan, zoom, type, open). Interaction MUST NOT wait for every picture file to finish loading.

### Key Entities *(include if feature involves data)*

- **Garden list item**: A garden the current user belongs to, shown with name (and existing summary fields) plus **bed count** and **placement count**.
- **Garden detail**: The full picture Overview and Bed View share: beds, non-planting areas, plantings and their placements, plus per-planting **spacing** and **canopy radius** used to draw marks.
- **Placement**: A planting’s position in a bed. Many placements may exist in one garden; detail load cost MUST NOT grow linearly with this count.
- **Plant search result**: One catalog match shown in a list or plant panel, including identity fields already required (name, category, climate when filtered) and **illustration location or stand-in**.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: Unchanged. Owner and collaborator load and edit as today; viewer loads list, Overview, and Bed View but cannot mutate. Catalog search remains a signed-in catalog capability, not a new garden permission.
- **Sharing rules**: Shared gardens appear on each member’s list with the same counts. Detail is visible to members only. No new sharing surfaces.
- **Isolation**: A user MUST only receive list rows and garden detail for gardens they belong to. Batching MUST NOT leak another household’s gardens, counts, or plantings. Catalog search remains shared reference data.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Previously loaded garden list and garden detail MUST remain readable offline (existing rule). Faster online load does not require a new offline cache. Cached list rows from before this DTO change MAY lack `bedCount` / `placementCount`; the client MUST still render the list (treat missing counts as `0` or omit the count text) until an online reload replaces the cache.
- Plant search still requires connectivity for a fresh search; this feature does not add offline search.
- Offline mutations stay as they are today (draft unchanged when the product already requires online for that action).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: FR-002 holds on the 20-garden fixture (list assembly under 1 second and not ~20× a 1-garden list).
- **SC-002**: Opening Garden Overview and Bed View for a garden with **100 or more** placements shows a complete, correct plan; FR-004 holds (layout assembly under 1 second).
- **SC-003**: FR-001 and FR-003 hold on the 20-garden and 100-placement fixtures (constant-cost list counts; spacing/canopy not linear in placement count).
- **SC-004**: FR-005 and FR-006 hold for a search of 10 or more results (identity + stand-in or URL; data-request count does not grow with results).
- **SC-005**: FR-002, FR-004, and FR-011 holding on the 20-garden / 100-placement fixtures satisfies “noticeably faster”; no remaining linear-per-item lookup growth on those paths. A formal user study is not required.
- **SC-006**: FR-008 holds (automated check fails on budget or per-item regression; timings for list, layout, and search are recorded).
- **SC-007**: FR-011 holds at the volumes in this spec (interactive in 2 seconds or less; interaction does not wait for all pictures).

## Assumptions

- The 1-second list budget is **garden-list payload assembly** (`GardenService.list`, including batched counts). The 1-second “garden detail” budget is **layout payload assembly** (`LayoutService.get`: beds, areas, plantings, spacing, derived canopy)—not a full page-load including fonts, pictures, or a slow client device. Overview/Bed View also GET garden detail (name/zone/counts) **in parallel**; that second GET is not a sequential per-placement pass and is not a second 1-second budget. The 2-second interactive budget includes both round-trips.
- The **2-second** budget is time from the gardener requesting the screen until they can interact with it (scroll, tap, pan, zoom, type, open). It includes one data round-trip (or two in parallel) and enough rendering to use the screen. It does **not** require fonts-complete, all picture files, or a slow device. It is measured on the same 20-garden / 100-placement / typical-search fixtures as the 1-second assembly budgets.
- “Noticeably faster” is satisfied when linear per-item lookup growth is gone and the 1-second assembly and 2-second interactive budgets hold on those fixtures; a formal user study is not required.
- The garden list does **not** show bed count or placement count today (`GardenSummaryDto` has id, name, zone, role only). This feature **adds** those fields and gathers them with batched aggregates (not a COUNT per garden).
- Illustration-or-stand-in on search results is already required by garden planner UX; this feature requires that illustration location to travel **with** the search result so the client does not make a **data** fetch per row to discover it. Plants without art keep the existing stand-in. Browser/image loads of picture files from that location are allowed. This feature does **not** ship catalog artwork; 011 always returns `illustrationUrl: null`.
- Plant search in this feature means both the standalone Plants catalog search and the Bed View plant panel search (same result completeness rule).
- Scope is those hot paths only (garden list, Garden Overview, Bed View, plant search), plus any other sequential per-row lookups found on those same screens. Calendar, reminders, transplant list, favorites, and admin pipeline are out of scope unless they share a called path that these screens invoke while loading.
- Existing membership, offline-read, and Save/draft rules are unchanged.
- Verification uses a test account with at least 20 gardens and a garden with at least 100 placements; those fixtures are part of the automated performance check, not a production data migration. The check both fails on budget/per-item regressions and records basic timings for garden list, garden detail, and plant search.
