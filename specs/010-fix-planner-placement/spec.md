# Feature Specification: Fix Planner Placement

**Feature Branch**: `010-fix-planner-placement`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Fix garden-planner placement bugs: incorrect bed positioning and non-functional direct seeding. Beds/areas dropped on Garden Overview must land with their center under the cursor (any zoom/pan), matching stored position after save. Direct seed into a bed must persist and appear without a transplant workflow; blocked placements must show a specific error. Regression coverage for drop origin and direct-seed placement."

Follow-up (2026-08-22): Bring full catalog search into the garden planner (name, category, climate suitability) with in-context results, the same no-match provisional path as the Plants catalog, drag-and-drop (and arm-then-click) onto the **open bed in Bed View**, and specific rejection when a drop is invalid. Garden Overview is the **structure map** (beds, areas, visible plantings); it does not plant.

## Clarifications

### Session 2026-08-22 (informed defaults)

- Q: Does “from the library” require a new palette of draggable bed/area templates? → A: **No new library product.** This feature fixes how beds and non-planting areas land on Garden Overview for every existing place or move: create (first appearance), drag-to-move, and any palette/library drop if the product already has one. Create-with-size that does not use a pointer drop still appears in the **currently visible** Overview using the same zoom/pan mapping — never a hidden garden-center that ignores the view. (First-place vs move anchors: see clarification session below.)
- Q: Does “immediately” / “no additional steps” skip explicit Save? → A: **No.** Direct seed and bed/area moves still follow Garden Planner UX: they update the working draft at once so the gardener sees the object under the pointer (or in the bed) without going through Transplant View or indoor start. Household persistence and “still there after reload” require a successful **Save**, same as today. Reload without Save still discards the unsaved draft.
- Q: New garden fence or bed/area overlap bans? → A: **No.** Keep existing Garden Planner / Layout Designer rules (including that non-planting areas may overlap beds). Whatever accept/reject/flag rules already exist MUST be evaluated on the rectangle the gardener actually sees at the drop, not on a different computed position. **Catalog-from-panel planting drops** have a stricter rule: invalid drops are **rejected** (see follow-up).

### Session 2026-08-22 (clarification)

- Q: When moving an already-placed bed or area, does the center jump under the pointer at release, or does the grabbed point stay under the pointer? → A: **New place** (create or first drop): rectangle **center** under the pointer. **Move** of an existing bed or area: the **grabbed point** stays under the pointer (no snap-to-center on release). Zoom and pan still MUST map correctly; objects MUST NOT jump to garden center.
- Q: If catalog spacing is unknown, should Direct seed place the plant, refuse it, or refuse Save? → A: A plant MUST NOT be allowed in the catalog if spacing is unknown. This feature enforces that at the **catalog**: plants with unknown spacing MUST NOT be listed or seedable (search, browse, Direct seed, and other catalog pickers). Direct seed therefore only uses plants that already have spacing. Unknown spacing is not a “place anyway / spacing unavailable” path for new catalog plants.
- Q: What happens to plants already stored without spacing? → A: **Omit** them from catalog UI and from new imports. Do **not** guess spacing. Already-placed garden plantings that reference those varieties **stay** (including the existing “removed from catalog” cue if that already applies). They MUST NOT appear as new Direct-seed or catalog-search targets.
- Q: When Direct seeding with Add {plant} (click, not drag), where should the planting land? → A: **Remove the Add plant control that places without targeting a bed spot.** The gardener searches in the planner plant panel and either **drags** a result onto a bed or uses **arm-then-click** (follow-up). There is no one-click add that plants without choosing a spot on a bed.
- Q: Without Add plant, how does a keyboard user Direct seed? → A: **Superseded by follow-up.** Arm-then-click (and equivalent keyboard: arm a result, then activate a spot in a bed) is the non-drag fallback for accessibility and touch.

### Session 2026-08-22 (follow-up)

- Q: Does the planner keep a name-only search, or the full Plants catalog search? → A: **Full catalog search in-context** in a **Bed View plant panel** (do not navigate away). Same capabilities as the standalone Plants catalog: search by common or botanical name, filter by plant category (type), and filter by climate suitability. Results MUST show enough at-a-glance identity: illustration (or a clear visual stand-in if none exists), common name, category, and a climate-suitability indicator when the climate filter is active. Garden Overview has no catalog search.
- Q: What if search has no matches? → A: Offer the **same provisional / on-demand path** as the standalone Plants catalog so a catalog gap does not block planning (name search with no local match may find and add a newly found plant, then it can be placed).
- Q: Where do results drop, and what is invalid? → A: **Superseded (clarification 2).** Catalog results are placed in **Bed View** onto the **open bed**, not onto Garden Overview. Invalid Bed View drops are rejected (specific reason, no planting created). Arm-then-click remains the non-drag fallback.

### Session 2026-08-22 (clarification 2)

- Q: When the plant panel filters by climate suitability, whose saved location should that use? → A: **This garden’s hardiness zone** (site profile). When the garden has a zone set, the climate filter **defaults** to that zone. The gardener MAY change or clear the filter (same growing-zone model as the Plants catalog). If the garden has no zone, the climate filter starts unset (any zone) until they set a zone on the garden or pick one in the panel.
- Q: After dropping a plant onto a bed on Garden Overview, does Overview draw the planting or stay labels-only? → A: Garden Overview **shows planting marks** on beds so the map displays current beds **and** their plantings (exception to labels-only Overview). Placement itself is **not** on Overview (see next).
- Q: Once a planting mark is on Overview, can the gardener drag it on Overview to move it? → A: **No.** Overview **shows** marks. **Move and remove** of an already-placed planting stay **Bed View only**. Drag on Overview still moves beds/areas (or pans empty space), not planting marks.
- Q: Should the plant panel be on Overview, Bed View, or both? → A: **Bed View only.** Garden Overview is the **structure of the garden**: show all current beds and their plantings; **create** (and arrange) beds and non-planting areas only. **Bed View** is where the gardener **plants** into a given bed (catalog plant panel: search, drag, arm-then-click). Overview MUST NOT have the plant panel and MUST NOT create plantings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Beds and Areas Land Where Dropped (Priority: P1)

A garden owner or collaborator places or moves a bed or non-planting area on Garden Overview. A **new** rectangle from **Create bed / Create area** lands with its **center** at the visible Overview viewport (current zoom/pan). **Moving** an already-placed bed or area keeps the **point they grabbed** under the pointer until release (the rectangle does not snap so its center jumps onto the cursor). Zoom level and pan offset do not send the object to an unrelated place such as the garden’s origin or a stale “center of the whole garden.” What they see on the map is what the household stores after a successful Save. After they Save and reload, the bed or area is still at that same spot.

**Why this priority**: A map the gardener cannot trust is unusable. Wrong drop position is the first reported bug; everything else in the planner depends on origins matching the screen.

**Independent Test**: On Overview, while zoomed and panned away from the default view: **Create bed** so its **center** is at the visible viewport center; then grab a corner (not the center) of that bed and drag — the grabbed corner stays under the pointer. Repeat for a non-planting area. Save; reload; confirm stored positions match. Repeat at a second zoom. A viewer cannot move beds or areas.

**Acceptance Scenarios**:

1. **Given** Garden Overview at any zoom and pan, **When** an owner or collaborator uses **Create bed** (no pointer drop; no structure palette), **Then** the bed’s **center** is at the **currently visible** Overview center (not at the garden’s origin or an unrelated center).
2. **Given** the same first-place conditions for a non-planting area, **When** they **Create non-planting area**, **Then** that area’s **center** is at the visible Overview center.
3. **Given** an already-placed bed or area, **When** they grab a point that is not the center and drag, **Then** that grabbed point stays under the pointer until release; the object MUST NOT snap so its center jumps onto the cursor.
4. **Given** Overview zoomed in or panned so the default garden center is off-screen, **When** they place or move a bed or area onto what they can see, **Then** the object stays in that visible region; it MUST NOT silently jump to a position that ignores the current zoom or pan.
5. **Given** existing accept/reject/flag rules for a bed or area position (fit, overlap, or any other already-defined layout rule), **When** the gesture ends, **Then** those rules run against the rectangle actually shown — the same place that will be stored on Save — not against a different hidden position.
6. **Given** a successful Save after that placement, **When** the gardener reloads Overview, **Then** the bed or area renders at the stored position; the picture they see and the stored plan MUST match.
7. **Given** a viewer, **When** they open Overview, **Then** they cannot place or move beds or areas.
8. **Given** Garden Overview, **When** an owner or collaborator looks for catalog search or a way to drop a plant onto a bed, **Then** they cannot — Overview has no plant panel and cannot create plantings. They create or arrange **beds and non-planting areas** only, and they can **see** existing planting marks on beds.

---

### User Story 2 - Search the Catalog in Bed View and Direct-Seed Onto the Open Bed (Priority: P1)

A garden owner or collaborator opens **Bed View** for a given bed and uses an in-context **plant panel** with the same catalog search as the standalone Plants catalog: common or botanical name, plant category, and climate suitability. Results show enough to identify a plant before placing (illustration or stand-in, common name, category, and a climate-suitability indicator when that filter is on). They drag a result onto the **open bed**, or arm a result and click/tap a spot in that bed. A valid drop creates a **direct-seed** planting at that spot (center under the pointer / click), not a transplant. After Save, it is still in that bed and **visible as a mark on Garden Overview** (map of beds and plantings). They never leave the planner to search, and they never go through Transplant View or indoor start. There is no Add plant control that plants without choosing a spot in the open bed. Garden Overview does not plant.

**Why this priority**: Direct seed is how gardeners put catalog plants in beds. Overview is the garden’s structure; Bed View is where planting happens. A name-only search, or forcing a trip to the Plants page, blocks planning.

**Independent Test**: Open Bed View (not the standalone Plants page or Transplant View): search by name, filter by category and/or climate suitability, see identifiable results; drag a result onto the open bed (or arm-then-click); see the planting in Bed View at that spot; Save; reopen Overview and confirm the mark is on that bed. Overview has no plant panel. Empty name search with no local match offers the same provisional path as Plants catalog. Viewer cannot place.

**Acceptance Scenarios**:

1. **Given** Bed View for a sized bed, **When** an owner or collaborator uses the plant panel, **Then** they can search by common or botanical name, filter by plant category, and filter by climate suitability **without navigating away** from the planner. If this garden has a hardiness zone, the climate filter **defaults to that zone** (they may change or clear it). If the garden has no zone, the climate filter starts unset. Results include common name, category, a visual (illustration or stand-in), and a climate-suitability indicator when the climate filter is active. Garden Overview does not present this panel.
2. **Given** matching results in Bed View, **When** they drag a result onto a valid spot inside the **open bed** (any zoom/pan), **Then** a direct-seed planting appears on the working draft at that drop (planting **center** at the drop point), not in the transplant tray, and not as an indoor start.
3. **Given** a result, **When** they use arm-then-click (arm the result, then click/tap a valid spot in the open bed), **Then** the same successful placement occurs as a drag to that spot.
4. **Given** that successful direct seed, **When** they Save and later reopen Overview or that Bed View, **Then** the planting is still in that bed at the stored position; Overview shows it as a mark on that bed.
5. **Given** an already-placed planting mark on Overview, **When** they drag on that mark, **Then** the planting does not move on Overview; repositioning and remove-from-bed happen in **Bed View**. Dragging a **bed** still moves the bed.
6. **Given** a name search with no local catalog matches in the Bed View panel, **When** results are empty, **Then** they get the same provisional / on-demand “find and add this plant” path as the standalone Plants catalog; after a plant is found and has spacing, they can place it from the panel onto the open bed.
7. **Given** a variety with unknown or missing spacing, **When** they search in the plant panel (or Plants catalog), **Then** that variety is not offered. **When** a garden already has a planting of such a variety, **Then** that planting remains.
8. **Given** a viewer, **When** they open Bed View, **Then** they cannot direct-seed (they MAY read the bed and Overview map).

---

### User Story 3 - Blocked Placements Explain Why (Priority: P2)

When a bed, area, or catalog-from-panel planting cannot be completed for a legitimate reason, the gardener sees a **specific** message that names the reason. Catalog-from-panel drops in Bed View that miss the open bed, overlap another plant, or fail spacing/validation are **rejected** (no planting created). The action MUST NOT look like it succeeded and MUST NOT fail with no feedback.

**Why this priority**: Silent no-ops are how the current bugs feel. Honest errors make placement trustworthy.

**Independent Test**: In Bed View, drag (or arm-click) a catalog result outside the open bed, and onto a spot that fails spacing/overlap; confirm a specific message, no planting created, UI not stuck armed/ambiguous. Confirm Overview has no plant panel. Offline place shows online-required. No-spacing varieties are absent from the panel.

**Acceptance Scenarios**:

1. **Given** a catalog result dragged or arm-clicked **outside the open bed** in Bed View, **When** the gardener completes the gesture, **Then** they see a specific miss/failure message (same spirit as **Drop missed a bed**); no planting is created; if they were armed, the UI does not stay in an unclear armed state without explanation.
2. **Given** a catalog-from-panel drop **inside a bed** that overlaps another plant or fails spacing/validation, **When** the gesture ends, **Then** the drop is **rejected** with a specific reason; the planting is not created (not a silent no-op and not a flagged-but-placed planting for this gesture).
3. **Given** offline when planner mutations require online, **When** they try to place a bed/area or direct-seed, **Then** they see the existing online-required outcome and the draft does not change.
4. **Given** **moving or resizing** an already-placed planting or bed (not a new catalog-from-panel drop), **When** the gesture would create a spacing/fit problem, **Then** Garden Planner UX still applies: the object can stay where moved, flags appear, Save is refused until fixed.
5. **Given** a placement the product refuses for another already-defined reason (for example invalid bed size), **When** they try to complete it, **Then** they see a specific message naming that reason.

---

### Edge Cases

- Zoomed far in or out, and panned so the default garden origin is off-screen: first-place still puts the rectangle **center** at the pointer’s map point; move still keeps the grabbed point under the pointer; catalog-from-panel drops still use the same pointer-to-map mapping.
- Two **beds or areas** overlapping on screen: existing overlap policy still applies; this feature does not add a new bed/area overlap ban.
- Create bed / create area **without** a pointer drop (name, length, width, then appear): the new rectangle appears in the currently visible Overview using the same zoom/pan mapping as a drop, not an unrelated garden-center.
- Catalog-from-panel drop in Bed View into a bed that already has plantings: if the drop fails spacing/overlap, **reject** with a specific message (US3). If it is valid, place at the drop; Overview then **shows the mark** on that bed (map only).
- Garden Overview has **no** plant panel and **cannot** create plantings. Create/arrange beds and non-planting areas only.
- Already-placed planting marks on Overview are **visible but not draggable** there. Reposition and remove-from-bed remain Bed View. Dragging near a mark on Overview MUST NOT steal a bed-move or pan in a way that silently moves the planting.
- Direct seed MUST NOT create a transplant/tray record even if the catalog plant is often started indoors.
- No Add plant / Add {name} control that plants without choosing a bed spot. Arm-then-click is the non-drag fallback (touch and accessibility). Empty-bed **Direct seed** next-step (UI polish) MAY focus the plant panel; it MUST NOT place a plant by itself.
- Name search with no local match: same provisional / on-demand path as Plants catalog; if that path also finds nothing, empty state (not an error splash). Filter-only empty results: clear empty state and ability to change filters (same as Plants catalog).
- Climate filter uses this garden’s hardiness zone when set (default; gardener may change or clear). Garden with no zone: climate filter starts unset (any zone), not an invented zone.
- Catalog result with no illustration: a simple visual stand-in plus name/category is enough; the product MUST NOT block placing for lack of artwork.
- Varieties with unknown spacing are not catalog plants. New imports MUST NOT add them. Already-placed plantings of those varieties remain.
- Reload or leaving the planner without Save discards unsaved positions and unsaved direct seeds (existing draft rule).
- Viewer and non-member: no mutations; non-member same not-found as a missing garden.
- Missed drop of a **transplant from the tray** remains 008 (stay in tray + miss message).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When an owner or collaborator **first-places** a bed or non-planting area on Garden Overview, the product MUST set that rectangle’s position so its **center** is at the mapped plan point: for **Create bed / Create area** (no pointer drop), that point is the **currently visible** Overview center (FR-003); for **moving** an already-placed bed or area, the **grabbed point** stays under the pointer until release (MUST NOT snap the center onto the cursor). There is no structure-template palette drop. The mapping MUST use the Overview’s **current** zoom and pan. The product MUST NOT place or leave the object at the garden origin, a stale garden-wide center, or any other point that ignores the current view.
- **FR-002**: The same pointer-to-map mapping MUST be used while the object is being dragged so the gardener is not shown one position and stored another. After a successful Save, Overview MUST render each bed and area at its stored position; shown position and stored position MUST NOT diverge.
- **FR-003**: Create-with-size that first appears on Overview without a drop MUST still appear in the **currently visible** Overview (zoom/pan aware). A second click-to-place step is not required (Garden Planner UX).
- **FR-004**: Existing layout validation for **beds and areas** MUST run against the rectangle the gardener sees. This feature MUST NOT invent a new garden fence or a new **bed/area** overlap ban. Catalog-from-panel reject rules are FR-007.
- **FR-005**: Owners and collaborators MUST be able to direct-seed from a **plant panel in Bed View only**, without leaving the planner. Garden Overview MUST NOT present the plant panel and MUST NOT create plantings. The panel MUST provide the same catalog search capabilities as the standalone Plants catalog: common or botanical name, plant category (type), and climate-suitability filter. Climate suitability MUST default to **this garden’s hardiness zone** when that zone is set; the gardener MAY change or clear the filter. If the garden has no zone, the climate filter MUST start unset (any zone) and MUST NOT invent a zone. Results MUST be identifiable at a glance (visual, common name, category; climate-suitability indicator when that filter is active). Every result MUST be draggable onto the **open bed** in Bed View. Arm-then-click (arm a result, then click/tap a spot in the open bed) MUST place with the same rules as drag. Keyboard: `Arm {commonName}` is a focusable control (Enter/Space arms). With a result armed, focusing `Bed plan` and pressing Enter/Space MUST place at the **visible Bed View viewport center** mapped into the open bed (same `catalogDropOutcome` as a click). That is a chosen spot, not the removed Add-at-geometric-center control. The product MUST NOT provide an Add plant / Add {name} control that places without targeting a spot in the open bed. A **valid** drop or arm-click MUST create an in-ground **direct seed** whose **center** is at the chosen point in that bed on the working draft immediately, MUST NEVER require Transplant View or indoor-start, and MUST NEVER appear in the planting tray. Viewers MUST NOT direct-seed.
- **FR-006**: After a successful Save of a valid direct-seed placement, the household’s stored garden plan MUST include that planting in that bed. Reopening Bed View MUST show it in the bed; Garden Overview MUST show it as a mark on that bed.
- **FR-007**: An **invalid** catalog-from-panel drop or arm-click in Bed View (outside the open bed, overlapping another plant, failing spacing/validation, or online-required) MUST show a **specific** visible error that names the reason, MUST NOT create the planting, and MUST NOT leave the UI silently armed or unchanged with no message. “Overlap” means blocking **spacing** or **fit** from existing layout evaluation (center-to-center / edge clearance), not a second overlap detector. Existing miss copy such as **Drop missed a bed** remains valid for misses. Unknown catalog spacing is **not** a Direct seed failure mode: those varieties MUST NOT be in the catalog (FR-010).
- **FR-008**: Automated regression coverage MUST prove: (1) **Create bed** after zoom/pan stores a position whose **center** matches the **visible Overview viewport center** used at create (not garden origin); (2) moving an existing bed by a non-center grab stores a position consistent with grab-offset (not a center snap); (3) searching in the **Bed View** plant panel and dragging (or arm-clicking) a catalog plant onto the open bed creates a placement at that point that is present on the stored garden plan after Save. Human checks: bed place/move accuracy after Save+reload; Bed View search with category/climate filters without leaving the planner; drag and arm-click direct seed; Overview has no plant panel; rejected invalid drops with a specific message.
- **FR-009**: This feature MUST NOT change membership roles, explicit Save, draft discard on leave/reload, or confirmed-delete immediacy from Garden Planner UX. **Garden Overview** is the garden’s **structure map**: create and arrange beds and non-planting areas; **show** all current beds and their planting marks. Overview MUST NOT add, move, or remove plantings (no plant panel; marks are not draggable). **Bed View** is where the gardener plants into a given bed (catalog panel + tray transplants) and move/remove in-bed plantings. Transplant tray behavior is unchanged.
- **FR-010**: A plant with unknown or missing spacing MUST NOT be a catalog plant. Search, browse, the planner plant panel, and other catalog pickers MUST NOT offer it. New catalog intake (sync/import) MUST NOT add a variety that lacks spacing. Varieties already stored without spacing MUST be omitted from those surfaces and from new imports; the product MUST NOT invent spacing. Garden plantings already placed for those varieties MUST remain.
- **FR-011**: When a name search in the planner plant panel has no local matches, the product MUST offer the same provisional / on-demand path as the standalone Plants catalog. Newly found plants MUST still satisfy FR-010 (known spacing) before they can be placed.

### Key Entities

- **Bed**: Named sized rectangle on Garden Overview; position is a map origin plus length/width/orientation already used by the planner. **Create** puts the rectangle **center** at the visible Overview viewport; move uses the grabbed point as the drag anchor.
- **Non-planting area**: Named rectangle on Overview only (path, structure, and similar); same Create viewport-center and grab-offset move rules as beds; never holds plantings.
- **Plant panel**: Catalog search and results **in Bed View only**, beside the open bed. Same search/filter capabilities as the Plants catalog; results are the drag/arm source for direct seed into that bed.
- **Direct-seed planting**: In-ground planting created from the **Bed View** plant panel onto the open bed; has a bed assignment, in-bed position, and **known** catalog spacing; is not a tray/indoor transplant. Visible as a mark on Garden Overview (not editable there).
- **Catalog plant**: A variety offered in search, browse, and the plant panel. MUST have known spacing; a variety without spacing is not a catalog plant (omitted from those surfaces even if an older stored row exists).
- **Working draft**: Unsaved Overview/Bed View layout the editor sees; Save commits it for the household; reload without Save discards it.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: **Owner** and **collaborator** create/arrange beds and areas on Overview and direct-seed from the Bed View plant panel. **Viewer** reads Overview and Bed View and MUST NOT mutate. Non-members: no access (same not-found as a missing garden). Unauthenticated users are prompted to sign in (existing garden route guards). Catalog search in the planner follows the same authenticated-catalog rule as the Plants catalog.
- **Sharing rules**: One household garden plan; other members see the last successful Save, not another person’s unsaved draft.
- **Isolation**: Positions and plantings belong to that garden only; notices and errors MUST NOT leak another garden’s names.

### Offline / PWA Considerations

- Last successful saved plan remains readable offline on Overview and Bed View.
- Place/move of beds and areas, direct seed, plant-panel search that needs the service, provisional on-demand fetch, and Save require connectivity as they do today; offline mutations show online-required and MUST NOT change the draft or stored plan. Already-cached catalog results MAY remain searchable offline the same way as the Plants catalog.
- Stale cache after membership loss MUST NOT authorize edits on reconnect (existing garden/layout cache rule).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fixture with Overview zoomed and panned away from the default view, 100% of **first-place** gestures for a bed and for a non-planting area put the object’s **center** at the release point on the map (not at garden origin or an unrelated center). 100% of **moves** of an already-placed bed or area keep the grabbed point under the pointer (0 center-snaps on release). After Save and reload, 100% of those objects appear at the stored position (shown = stored).
- **SC-002**: On a fixture, an owner/collaborator can search the catalog **in Bed View** (name, category, and/or climate suitability) without opening the standalone Plants page, then drag a result onto the open bed and see the plant at the drop on the draft immediately (100%). Arm-then-click to a valid spot in that bed succeeds the same way (100%). After Save and reopen, the planting is still in that bed on the stored garden plan and shown as a mark on Overview (100%). Garden Overview has 0 plant-panel place paths (100%). Direct-seed plantings in the tray: 0. Add plant controls that place without a bed spot: 0. Dragging a planting mark on Overview moves 0 plantings (100%); Bed View still repositions.
- **SC-003**: On fixtures for a catalog drop outside any bed, a catalog drop that fails spacing/overlap, and offline mutation, 100% show a visible specific message, 0 plantings created for the rejected catalog drop, and 0 silent no-ops.
- **SC-004**: Automated checks cover SC-001’s stored-position match for a bed drop and SC-002’s stored planting-in-bed after in-planner direct seed (100% on those fixtures). Viewer cannot place beds or direct-seed (100% on the role fixture).
- **SC-005**: Create-with-size without a pointer drop still lands in the currently visible Overview at the current zoom/pan (100% on the fixture); it MUST NOT appear at a hidden garden-center while the gardener is looking elsewhere.
- **SC-006**: On catalog fixtures, 0 plant-panel / Plants-catalog results have unknown spacing (100%). Direct seed of a listed plant still succeeds per SC-002 (100%). A fixture planting that already references a no-spacing variety is still present in the bed after this feature (100%); that variety is still absent from catalog pickers (100%).
- **SC-007**: On a fixture, filtering the **Bed View** plant panel by category and by climate suitability returns only matching plants (100% inclusion/exclusion), without navigating away. When the garden has a zone, the climate filter defaults to that zone (100%). A name search with no local match exposes the same provisional path as the Plants catalog (100% on that fixture). Overview presents 0 catalog search UI (100%).

## Assumptions

- This is a **correctness fix** on Garden Planner UX (008) and Garden Layout Designer (005), plus **Bed View** catalog search and a catalog admission rule: **known spacing is required** to be a catalog plant. **Garden Overview** = structure (create/arrange beds and areas) and a **map of plantings** (marks visible, not editable). **Bed View** = plant into the open bed. Save/draft, roles, miss messages, and UI feedback notices (009) stay in force. Invalid catalog drops in Bed View are **rejected** instead of placed-with-flags.
- “Library” in the request means the source of a new or moved bed/area on Overview (create controls and drag), not a separate structure-template palette. The **plant panel** is catalog search, not a bed library.
- First-place for beds/areas is **Create** at the **visible Overview viewport center** (no structure-template palette). Moving an existing rectangle preserves grab offset. New catalog plantings use **center at the drop, arm-click, or armed keyboard place** (visible Bed View viewport center).
- Category filter is the catalog’s plant type (vegetable, herb, flower, fruit, shrub, tree). Climate suitability uses this **garden’s hardiness zone** as the default filter when set; the gardener may change or clear it. No separate user-level location is required.
- “Provisional plant” means the existing Plants catalog on-demand / no-local-match path, not a freeform custom plant with invented spacing.
- Persistence after reload means after a **successful Save**. Immediate appearance means the working draft.
- Regression coverage may be unit-level and/or end-to-end; stored bed position and stored direct-seed-in-bed MUST be asserted.
- No new membership flags, calendar plans, favorites product, companion rules, GPS, or non-rectangular beds. Guessing spacing for incomplete provider data is out of scope (omit the variety).
