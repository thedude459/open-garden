# Feature Specification: Garden Layout Designer

**Feature Branch**: `005-garden-layout`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Draw beds to scale and place current or planned plantings with spacing checks. Depends on household gardens, named beds/plantings, and catalog spacing. Viewer read-only. Companion-planting rules are out of scope for v1. Exclude purchasing and care reminders."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draw Beds to Scale (Priority: P1)

A garden owner or collaborator opens a layout for a garden and draws or sizes named beds on a simple plan so bed footprints match real-world dimensions well enough to judge whether plants will fit. A viewer can open the same layout and see beds but not edit them.

**Why this priority**: Spatial planning starts with bed shapes and sizes. Placing plants is not useful if beds have no scale.

**Independent Test**: As owner, open layout, create or size at least two beds with length and width, reopen and see the same geometry; viewer cannot change bed shapes; non-member cannot open the layout.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator of a garden, **When** they open the garden layout, **Then** they see a plan of that garden’s beds (or an empty-layout state with a way to add a bed).
2. **Given** an owner or collaborator, **When** they add a rectangular bed with length and width, **Then** the bed appears to scale relative to other beds on the plan and keeps a name the household can recognize.
3. **Given** existing named beds from the planting list that have no geometry yet, **When** the user opens layout, **Then** those beds can be given a size and position without creating a disconnected duplicate name.
4. **Given** an owner or collaborator, **When** they move or resize a bed, **Then** other members see the updated plan on next open.
5. **Given** a viewer, **When** they open layout, **Then** they can see beds to scale but cannot add, move, resize, or delete them.

---

### User Story 2 - Place Plantings and Check Spacing (Priority: P2)

A gardener places a seasonal planting into a bed on the layout and sees whether catalog spacing requirements are satisfied relative to nearby placements. Overlap or tighter-than-spacing placement is clearly flagged; the product does not silently allow an impossible packing to look fine.

**Why this priority**: Spacing is why the catalog stores spacing requirements. Placement without checks is just a sticker board.

**Independent Test**: Place two plantings of known spacing in one bed too close together, see a spacing warning; move them apart, warning clears; a planting with unknown spacing is placeable with spacing marked unavailable (not a fake number).

**Acceptance Scenarios**:

1. **Given** a planting in the garden and a bed with geometry, **When** an owner or collaborator places that planting in the bed, **Then** the planting appears in that bed on the layout and the planting list reflects that bed assignment.
2. **Given** two placed plantings whose catalog spacing means they are too close, **When** the layout is shown, **Then** the user sees a clear spacing problem on those placements (not a silent overlap).
3. **Given** placements that satisfy spacing, **When** the layout is shown, **Then** no false spacing error is shown for that pair (100% on the fixture set).
4. **Given** a planting with unknown spacing, **When** it is placed, **Then** spacing is marked unavailable for that plant; the user can still place it.
5. **Given** a viewer, **When** they view layout, **Then** they see placements and spacing flags but cannot move plantings.

---

### User Story 3 - Read a Previously Loaded Layout Offline (Priority: P3)

After a member has opened a layout while online, they can still read that last-loaded plan offline (beds, placements, last spacing flags). Editing geometry or placements requires connectivity for v1 (no layout mutation queue).

**Why this priority**: Checking the plan in the yard is a read problem first. Queued geometry sync is deferred (YAGNI vs plantings list, which already queues).

**Independent Test**: Load layout online, go offline, still see beds and placements; try to move a bed offline and see online-required.

**Acceptance Scenarios**:

1. **Given** a layout loaded online, **When** the device is offline, **Then** the last-loaded beds and placements remain visible.
2. **Given** the user is offline, **When** they try to add, move, or resize beds or placements, **Then** they see that they need to be online and the layout does not change.
3. **Given** a viewer offline, **When** they open a previously loaded layout, **Then** they can read it.

---

### Edge Cases

- Garden with plantings but no bed geometry: empty or unplaced list; plantings are not lost.
- Deleting a bed on the layout: consistent with seasonal plantings — plantings are not destroyed; they become unassigned/unplaced.
- Bed smaller than a plant’s spacing diameter: placing that plant flags a fit/spacing problem.
- Very large garden dimensions: plan remains navigable (zoom/pan or equivalent UX at planning time); household scale, not GIS.
- Two members edit layout online at once: last saved plan wins or the user is told their save could not apply; no silent split-brain that looks like both saved. Exact conflict UX at planning time as long as data is not silently corrupted.
- Companion-plant “good neighbor” suggestions are not shown.
- Unauthenticated or non-member: no layout data.
- Units: household-familiar length units consistent with catalog spacing (inches) unless the product later adds a display-unit toggle; do not mix unlabeled units.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Garden members MUST be able to open a layout plan for a garden they belong to.
- **FR-002**: Owners and collaborators MUST be able to add, name, position, size, and remove rectangular beds on that plan using real-world length and width so beds are to scale relative to each other.
- **FR-003**: Named beds used on the planting list and on the layout MUST be the same household objects (geometry is additional information on the bed, not a second parallel bed list).
- **FR-004**: Owners and collaborators MUST be able to place a garden planting into a bed on the layout (position within the bed). Viewers MUST NOT edit geometry or placements.
- **FR-005**: The layout MUST flag placements that violate catalog spacing requirements relative to other placements in the same bed. Unknown spacing MUST NOT be treated as zero or as “fits.”
- **FR-006**: Removing a bed from the layout MUST NOT delete planting records; plantings become unassigned as in Seasonal Plantings.
- **FR-007**: Non-members MUST NOT view or edit a garden’s layout.
- **FR-008**: A previously loaded layout MUST remain readable offline. Geometry and placement edits MUST require connectivity in this feature and MUST show an online-required state (no silent failure).
- **FR-009**: The feature MUST NOT include companion-planting rules, purchasing, care reminders, or automatic calendar generation.

### Key Entities *(include if feature involves data)*

- **Garden layout**: The to-scale plan of one garden: bed footprints and planting placements.
- **Bed geometry**: Length, width, and position of a named bed on the plan (rectangular in v1).
- **Placement**: The position of a seasonal planting inside a bed on the layout.
- **Spacing check**: A comparison of catalog spacing requirements against distances between placements in a bed.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: **Owner** and **collaborator** edit layout. **Viewer** reads. Non-members: no access.
- **Sharing rules**: Layout is garden-shared among members (same membership as Household Gardens).
- **Isolation**: Layout of Garden A MUST NOT be visible to non-members or mixed into Garden B.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Last-loaded layout is readable offline.
- Layout mutations are online-only in v1 (unlike planting list queue).
- Offline layout read MUST NOT block other cached garden, catalog, or planting list views.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of participants can add a named bed with length and width and see it on the plan in under 3 minutes.
- **SC-002**: On fixtures with known spacing, too-close placements always show a warning and adequately spaced placements do not (100%).
- **SC-003**: Non-members see 0 layout data; viewers cannot mutate (100% on the role fixture).
- **SC-004**: After loading layout online, it remains readable offline; an offline resize attempt shows online-required within 5 seconds.
- **SC-005**: At least 85% of participants agree they can tell whether two plants in a bed look too crowded given the spacing flags.
- **SC-006**: Assigning a planting to a bed on the layout and on the planting list stays consistent on fixtures (same bed name; no duplicate beds).

## Assumptions

- Household Gardens and Seasonal Plantings (named beds, plantings, catalog spacing) already exist.
- v1 beds are rectangles. Polygons, curves, paths, and elevation are out of scope.
- Scale is relative household measurement (tape-measure lengths), not GPS/survey grade.
- Companion planting, crop rotation maps, and sun/shade overlays are out of scope.
- Planting calendar math is not performed on the canvas.
- Default length unit matches catalog spacing (inches) for v1; a metric display toggle may be added later without changing stored spacing meaning.
