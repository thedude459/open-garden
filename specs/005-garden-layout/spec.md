# Feature Specification: Garden Layout Designer

**Feature Branch**: `005-garden-layout`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "005-garden-layout — Draw beds to scale and place current or planned seasonal plantings with spacing checks. Depends on household gardens, named beds/plantings, and catalog spacing. Viewer read-only. Companion-planting rules are out of scope for v1. Exclude purchasing and care reminders."

## Clarifications

### Session 2026-08-16

- Q: What happens to placed plantings when a bed is moved or resized? → A: Placements stay attached to the bed and move with it. A resize that leaves a planting outside the footprint keeps the placement and flags a fit problem (does not automatically unplace).
- Q: Does deleting a bed from the layout require confirmation? → A: Yes. In-page confirm (same pattern as removing a planting). Confirm removes the named bed from layout and planting list; plantings remain unassigned and unplaced. Cancel leaves the bed and placements unchanged.
- Q: May rectangular beds be rotated? → A: 90-degree steps only. The rectangle turns on the plan; stored length, width, and placement local coordinates do not swap or rewrite. Arbitrary angles are out of scope.
- Q: Can a layout with spacing or fit flags be saved? → A: No. The layout cannot be saved while any spacing or fit flag is present. The user must fix positions or unplace first. Unknown/unavailable spacing is not a flag that blocks save.
- Q: How is “too close” measured? → A: Center-to-center. Two plants in the same bed are too close when the distance between placement centers is less than that pair’s required spacing. When both have known spacing, use the larger of the two catalog values.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draw Beds to Scale (Priority: P1)

A garden owner or collaborator opens a layout for a garden and draws or sizes named beds on a simple plan so bed footprints match real-world dimensions well enough to judge whether plants will fit. Named beds already used on the planting list are the same beds — geometry is extra information on those beds, not a second list of names. A viewer can open the same layout and see beds but not edit them.

**Why this priority**: Spatial planning starts with bed shapes and sizes. Placing plants is not useful if beds have no scale.

**Independent Test**: As owner, open layout, create or size at least two beds with length and width, reopen and see the same geometry; a bed created on the planting list can be sized here without a duplicate name; viewer cannot change bed shapes; non-member cannot open the layout (same not-found outcome as a missing garden).

**Acceptance Scenarios**:

1. **Given** an owner or collaborator of a garden, **When** they open the garden layout, **Then** they see a plan of that garden’s beds (or an empty-layout state with a way to add a bed).
2. **Given** an owner or collaborator, **When** they add a rectangular bed with a name, length, and width, **Then** the bed appears to scale relative to other beds on the plan, the name is the same household name used on the planting list, and other members see it on next open.
3. **Given** existing named beds from the planting list that have no geometry yet, **When** the user opens layout, **Then** those beds can be given a size and position without creating a disconnected duplicate name.
4. **Given** an owner or collaborator, **When** they move, resize, or rotate a bed by 90 degrees, **Then** other members see the updated plan after the next successful save or refresh. Stored length and width do not swap; only orientation changes.
5. **Given** an owner or collaborator, **When** they choose to delete a bed from the layout and confirm, **Then** that named bed is gone from both the layout and the planting list, and its plantings remain in the garden as unassigned and unplaced (not deleted). **When** they start delete but cancel the confirm, **Then** the bed and geometry remain.
6. **Given** a viewer, **When** they open layout, **Then** they can see beds to scale but cannot add, move, resize, rotate, or delete them. Rename of an existing bed is not a layout action (it stays on the planting list).
7. **Given** User B is not a member, **When** they are signed in, **Then** they cannot open that garden’s layout (same not-found outcome as a missing garden).

---

### User Story 2 - Place Plantings and Check Spacing (Priority: P2)

A gardener places an existing seasonal planting into a bed on the layout and sees whether catalog spacing requirements are satisfied relative to nearby placements in that bed. Overlap or tighter-than-spacing placement is clearly flagged and cannot be saved until it is fixed or the planting is unplaced. Calendar plans are not objects on the layout. Recording a new planting still happens on the planting list.

**Why this priority**: Spacing is why the catalog stores spacing requirements. Placement without checks is just a sticker board. Layout must stay consistent with the planting list so the household has one set of beds and plantings.

**Independent Test**: Place two existing plantings of known spacing in one bed too close together, see a spacing flag and the refused-save message; move them apart, flag clears and save succeeds; a planting with unknown spacing is placeable and saveable with spacing marked unavailable (not a fake number); resize so a placed plant no longer fits — it stays placed with a fit flag and save is refused; a deprecated catalog variety still identifies its placement and can be unplaced; the planting list shows the same bed assignment; a calendar plan for the same variety does not appear on the layout.

**Acceptance Scenarios**:

1. **Given** a seasonal planting in the garden and a bed with geometry, **When** an owner or collaborator places that planting in the bed, **Then** the planting appears in that bed on the layout and the planting list shows that same bed assignment.
2. **Given** a planting assigned to a named bed on the list but with no layout position yet, **When** a member opens layout, **Then** that planting is available to place in that bed (not missing, not treated as a second planting).
3. **Given** a planting with no bed, **When** a member opens layout, **Then** it is available to place (unassigned/unplaced), and placing it into a bed assigns it to that bed on the list.
4. **Given** two placed plantings whose catalog spacing means they are too close (center-to-center distance less than the larger of their catalog spacings), **When** the user tries to save, **Then** they see a clear spacing problem on those placements (not a silent overlap), save is refused, and the message `Layout has spacing or fit problems` is shown. The last successful stored plan is unchanged until they move the plants apart or unplace.
5. **Given** placements that satisfy spacing and fit, **When** the user saves, **Then** the save succeeds and no false spacing or fit flag is shown for that fixture set (100%).
6. **Given** two placed plantings with different known spacings whose centers are farther apart than the smaller value but closer than the larger, **When** the user tries to save, **Then** a spacing flag is shown and save is refused with `Layout has spacing or fit problems`.
7. **Given** a planting with unknown spacing, **When** it is placed, **Then** spacing is marked unavailable for that plant; the user can still place it and can save (unavailable is not a blocking flag). Pair checks that include that planting do not invent a spacing number.
8. **Given** two plantings of the same catalog variety in one garden, **When** both are placed, **Then** they appear as two placements (identity is the planting record, not the variety alone).
9. **Given** an owner or collaborator, **When** they remove a planting from the layout (clear its position), **Then** the planting record remains on the planting list; it is unplaced; bed assignment stays unless they also unassign it.
10. **Given** a bed with placed plantings, **When** an owner or collaborator moves or rotates the bed 90 degrees, **Then** those plantings stay attached (local coordinates unchanged; only bed origin or orientation changes). **When** they resize the bed so a planting no longer fits, **Then** that planting stays placed and the layout flags a fit problem; it is not automatically unplaced; save is refused until they fix or unplace.
11. **Given** a planting whose catalog variety is later unavailable (deprecated), **When** a member opens layout, **Then** the placement still identifies that planting and they can unplace it; removing the planting record remains a planting-list action.
12. **Given** a viewer, **When** they view layout, **Then** they see placements and spacing flags but cannot move, place, or unplace plantings.
13. **Given** a planting-calendar plan for a variety, **When** a member opens layout, **Then** that plan is not shown as a placeable planting unless someone has also recorded a seasonal planting for it.

---

### User Story 3 - Read a Previously Loaded Layout Offline (Priority: P3)

After a member has opened a layout while online, they can still read that last **successful GET** (the last successfully saved plan) offline (beds, placements). A layout with unsaved spacing or fit flags is not stored, so it is not what they see offline. Editing geometry or placements requires connectivity for v1 (no layout mutation queue).

**Why this priority**: Checking the plan in the yard is a read problem first. Queued geometry sync is deferred (YAGNI vs the planting list, which already queues).

**Independent Test**: Load layout online, go offline, still see beds and placements; try to move a bed offline and see online-required; planting-list queued edits remain a separate flow and are not blocked by this read-only layout cache.

**Acceptance Scenarios**:

1. **Given** a layout loaded online (successful GET), **When** the device is offline, **Then** that last successful GET’s beds and placements remain visible.
2. **Given** the user is offline, **When** they try to add, move, resize, rotate, or delete beds or placements, **Then** they see that they need to be online and the layout does not change.
3. **Given** a viewer offline, **When** they open a garden whose layout they previously loaded with a successful GET, **Then** they can read that cached plan.
4. **Given** a user was removed from the garden after they had loaded the layout, **When** they reconnect, **Then** they MUST NOT keep acting as a member; stale layout MUST NOT authorize new edits.

---

### Edge Cases

- Garden with plantings but no bed geometry: plantings remain on the list and in an unplaced set on the layout; they are not lost.
- Empty named beds from the planting list appear on the layout so they can be sized; they are not hidden because they have no plantings.
- Deleting a bed on the layout follows FR-006 (in-page confirm; plantings unassigned and unplaced, not deleted).
- Bed smaller than a plant’s spacing: a planting with known spacing `s` does not fit when its placement center is closer to any bed edge than `ceil(s / 2)` inches, or when the bed’s length or width is smaller than `s`. That flags a fit problem, and save is refused until the user resizes the bed, moves the planting, or unplaces it.
- Moving a bed moves every placement attached to it (bed origin changes; local coordinates unchanged). Rotating a bed by 90 degrees changes orientation only; local coordinates and stored length/width do not rewrite. Resizing a bed so a planting falls outside the footprint keeps the placement and flags a fit problem; the planting is not automatically unplaced.
- Very large garden dimensions: plan remains navigable (pan and zoom or equivalent) at household tape-measure scale, not survey/GIS grade.
- A save refused because of spacing or fit flags is not a successful save; the last valid stored plan remains. Unsaved invalid arrangements are not treated as saved and MUST NOT become the offline last successful GET.
- Companion-plant “good neighbor” suggestions are not shown.
- Unauthenticated users: no layout data; they are prompted to sign in.
- Non-members: same not-found outcome as a missing garden (no existence leak).
- Units: household-familiar length units consistent with catalog spacing (inches) unless the product later adds a display-unit toggle; do not mix unlabeled units.
- Catalog variety later unavailable: existing placements still identify the planting; spacing may be marked unavailable; the planting can still be unplaced; removing the planting record is still a planting-list action.
- Layout does not create, delete, or auto-convert planting-calendar plans or personal favorites.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Garden members MUST be able to open a layout plan for a garden they belong to. Unauthenticated users MUST NOT see layout data. A non-member MUST receive the same not-found outcome as a missing garden.
- **FR-002**: Owners and collaborators MUST be able to add, name (at create), position, size, rotate in 90-degree steps, and remove rectangular beds on that plan using real-world length and width so beds are to scale relative to each other. Beds MUST remain rectangles with sides parallel to the plan axes after each 90-degree turn (no arbitrary angles). A 90-degree rotate MUST change orientation only; stored length, width, and placement local coordinates MUST NOT swap or rewrite. A bed name MUST follow the same rules as Seasonal Plantings (non-empty after trim, unique among beds in that garden, trim and case-insensitive). Rename of an existing bed MUST remain a planting-list action (not a layout editor).
- **FR-003**: Named beds used on the planting list and on the layout MUST be the same household objects. Geometry is additional information on the bed, not a second parallel bed list. Creating a bed on the layout MUST make it available on the planting list; creating a named bed on the planting list MUST make it available to size on the layout.
- **FR-004**: Owners and collaborators MUST be able to place an existing garden planting into a bed on the layout (position within the bed). Placing a planting into a bed MUST set that planting’s bed assignment on the planting list. A placement MUST stay attached to its bed: moving or rotating the bed MUST move its placements with it. If a resize or 90-degree rotate leaves a planting outside the bed footprint, the placement MUST remain and the layout MUST flag a fit problem (MUST NOT automatically unplace). Viewers MUST NOT edit geometry or placements.
- **FR-005**: The layout MUST flag placements that violate catalog spacing relative to other placements in the same bed using **center-to-center** distance: two placements with known spacing are too close when the distance between centers is less than the **larger** of their catalog spacing values. The layout MUST flag a fit problem when a planting with known spacing `s` has its center closer to any bed edge than **`ceil(s / 2)`** inches (never round down into a false fit), or when the bed cannot contain that spacing (length or width smaller than `s`). A layout MUST NOT be saved while any spacing or fit flag is present; the user MUST fix positions or unplace first, and MUST see that the save did not apply (`Layout has spacing or fit problems`). If either planting in a pair has unknown spacing, that pair MUST NOT invent a number and MUST NOT raise a spacing flag for that pair. Unknown spacing MUST be marked unavailable and MUST NOT block save. Spacing checks MUST NOT invent companion-planting rules.
- **FR-006**: Removing a bed from the layout MUST require an explicit in-page confirmation step (same pattern as removing a planting). After confirmation, the named bed is gone from the layout and the planting list; planting records MUST NOT be deleted — they become unassigned and unplaced. Canceling confirm MUST leave the bed, geometry, and placements unchanged. Clearing a planting’s layout position MUST NOT delete the planting record.
- **FR-007**: The layout MUST place seasonal planting records only. A planting-calendar plan MUST NOT appear as a placeable item unless a seasonal planting also exists. The layout MUST NOT create plantings from the catalog, MUST NOT create calendar plans, and MUST NOT alter personal favorites.
- **FR-008**: The last **successful GET** of a layout (the last successfully saved plan) MUST remain readable offline. Geometry and placement edits MUST require connectivity in this feature and MUST show an online-required state (no silent failure, no layout mutation queue). Offline layout read MUST NOT block other cached garden, catalog, or planting-list views.
- **FR-009**: Concurrent online saves of the same layout MUST keep the last **successful** save. A refused save (spacing or fit flags) MUST NOT overwrite the stored plan. The product MUST NOT present a merge editor.
- **FR-010**: The same catalog variety MAY appear as multiple placements when the garden has multiple planting records for that variety. Each placement is one planting.
- **FR-011**: After reconnect, layout contents MUST reflect current membership: a user removed while offline MUST NOT keep acting as a member (stale cache MUST NOT authorize new edits).
- **FR-012**: The feature MUST NOT include companion-planting rules, purchasing, care reminders, automatic calendar generation, non-rectangular beds, free rotation at arbitrary angles, GPS/survey mapping, or a required outer property boundary.

### Key Entities *(include if feature involves data)*

- **Garden layout**: The to-scale plan of one garden: bed footprints and planting placements.
- **Named bed**: The same household bed as on the planting list, now with optional geometry (length, width, position, and 90-degree orientation). Rectangular in this feature; sides stay aligned to the plan axes.
- **Placement**: The position of one seasonal planting relative to one bed on the layout. A planting may exist without a placement (unplaced). Placements move with their bed; they are not independent points on the garden plan.
- **Spacing check**: Center-to-center comparison in one bed. Required gap is the larger catalog spacing when both are known. Fit uses `ceil(s / 2)` inches of clearance from bed edges for known spacing `s`. Unknown spacing is unavailable, not a blocking flag.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: **Owner** and **collaborator** edit layout (beds and placements). **Viewer** reads beds, placements, and spacing flags and MUST NOT mutate. Non-members: no access (same not-found as a missing garden).
- **Sharing rules**: Layout is garden-shared among members (same membership as Household Gardens).
- **Isolation**: Layout of Garden A MUST NOT be visible to non-members or mixed into Garden B. Personal favorites remain session-private and are not layout objects.

### Offline / PWA Considerations *(include if feature has client behavior)*

- The last successful GET of a layout is readable offline for members, including viewers.
- Layout mutations (add/move/resize/rotate/delete beds, place/unplace plantings) are online-only in this feature (unlike the planting-list queue).
- Offline layout read MUST NOT block other cached garden, catalog, or planting-list views.
- Stale layout after membership loss MUST NOT authorize edits once the device reconnects.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of participants can add a named bed with length and width and see it on the plan in under 3 minutes. (Participant study, not a CI or Playwright timing gate.)
- **SC-002**: On fixtures with known spacing, two plants whose centers are closer than the larger catalog spacing always show a flag and save is refused; plants whose centers are at least that far apart save with no false pair flag (100%). Mixed-spacing fixtures that sit between the smaller and larger values flag and refuse save (100%). Unavailable spacing never blocks save and never invents a pair distance (100%).
- **SC-003**: Non-members see 0 layout data (same not-found as a missing garden); viewers cannot mutate (100% on the role fixture).
- **SC-004**: After a successful layout GET online, that plan remains readable offline; an offline resize attempt shows online-required within 5 seconds.
- **SC-005**: At least 85% of participants agree they can tell whether two plants in a bed look too crowded given the spacing flags. (Participant study, not a CI gate.)
- **SC-006**: Assigning a planting to a bed on the layout and on the planting list stays consistent on fixtures (same bed name; no duplicate beds; clearing position does not delete the planting). Moving or rotating a bed 90 degrees on fixtures keeps its placements attached (100%). A resize that would leave a planting outside the footprint still shows that planting placed, with a fit flag, and does not unplace it (100%); save of that overflowing layout is refused until the user fixes or unplaces (100%). Canceling bed-delete confirm leaves the bed and placements (100% on the fixture); confirming delete unassigns plantings without deleting them (100%).
- **SC-007**: A calendar plan without a seasonal planting never appears as a placeable item on the layout (100% on the fixture set).

## Assumptions

- Household Gardens (membership, roles) and Seasonal Plantings (planting records, named beds, catalog variety identity) already exist and remain the source of plantings and bed names.
- Plant Database catalog spacing is the spacing source; unknown spacing is omitted, never invented. Pair checks use center-to-center distance and the larger of the two known values. Fit clearance from each bed edge is `ceil(s / 2)` inches for known spacing `s` (integer inches; never round down into a false fit).
- “Current or planned plantings” means seasonal planting records, including those with a future planted date. It does not mean planting-calendar plans.
- Recording new plantings (variety picker, dates, confirm-remove) stays on the planting list. Rename of an existing named bed stays on the planting list. Layout names a bed only when creating it, and places existing plantings.
- v1 beds are rectangles that may be rotated in 90-degree steps only. Rotate changes orientation; stored length, width, and placement local coordinates are not rewritten. Polygons, curves, paths, elevation, and arbitrary-angle rotation are out of scope.
- Scale is relative household measurement (tape-measure lengths), not GPS/survey grade. No required outer property boundary in v1; beds are positioned relative to each other.
- Overlapping beds are allowed without a bed-collision engine in v1; spacing checks apply to plantings in the same bed.
- Companion planting, crop rotation maps, and sun/shade overlays are out of scope.
- Planting calendar math is not performed on the canvas.
- Default length unit matches catalog spacing (inches) for v1; a metric display toggle may be added later without changing stored spacing meaning.
- Last-write-wins matches Household Gardens and Seasonal Plantings for concurrent online edits.
