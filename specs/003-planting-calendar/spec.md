# Feature Specification: Planting Calendar

**Feature Branch**: `003-planting-calendar`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "For a selected garden, show when to start indoors, sow outdoors, transplant, and expect harvest. Per-garden seasonal calendar (not a global user calendar). Catalog enrichment only as needed: frost-relative sow/transplant windows (unavailable when unknown). Filter calendar by plant type; optionally seed from favorites. Offline: last-loaded calendar readable. Exclude: dragging plants onto a map; watering schedules."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a Garden Planting Calendar (Priority: P1)

A garden member opens a garden that has frost dates and sees a seasonal calendar for plants they selected: indoor start, outdoor sow, transplant, and expected harvest windows derived from that garden’s last/first frost dates and each plant’s growing guidance. Missing guidance is labeled unavailable rather than guessed.

**Why this priority**: “What should I start now?” is the reason gardens store frost dates. A readable calendar for one garden is the MVP.

**Independent Test**: As a member of a garden with zone and both frost dates, add at least one catalog plant that has growing guidance, open the calendar, and see indoor start, sow, transplant, and harvest timing that moves when frost dates change; a plant without guidance still appears with unavailable windows.

**Acceptance Scenarios**:

1. **Given** a garden with last and first frost dates and at least one plant on the calendar that has growing guidance, **When** a member opens the planting calendar, **Then** they see that garden’s seasonal windows for indoor start, outdoor sow, transplant, and expected harvest (as applicable to that plant).
2. **Given** the same plant on two gardens with different frost dates, **When** a member opens each garden’s calendar, **Then** the dates differ according to each garden’s frost dates (the calendar is per-garden, not a single user-wide calendar).
3. **Given** a plant whose indoor-start, sow, transplant, or harvest guidance is unknown, **When** it appears on the calendar, **Then** that window is clearly unavailable and is not filled with invented dates.
4. **Given** a garden missing last frost, first frost, or both, **When** a member opens the calendar, **Then** they see a clear explanation that the calendar cannot be produced until those site conditions are set (not a blank failure that looks broken).
5. **Given** a viewer of the garden, **When** they open the calendar, **Then** they can read it but cannot add or remove plants from it.

---

### User Story 2 - Choose Plants and Filter the Calendar (Priority: P2)

A gardener adds catalog plants to that garden’s calendar (including from their personal favorites), removes plants they do not want to plan, and filters the view by plant type so vegetables, herbs, or flowers can be reviewed separately.

**Why this priority**: A calendar of the entire catalog is noise; choosing plants (and filtering by type) makes the calendar usable. It still needs US1’s date rendering.

**Independent Test**: Owner or collaborator adds a favorite plant and a catalog plant, filters by type so only one type remains, removes a plant, and confirms a viewer cannot change the set; another user does not see this garden’s calendar plant list on a garden they do not belong to.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator and a populated catalog, **When** they add a plant to the garden’s calendar, **Then** that plant appears with whatever windows are known.
2. **Given** an owner or collaborator with personal favorites, **When** they add from favorites, **Then** matching favorite plants can be added to this garden’s calendar without exposing those favorites to other members as a shared favorites list.
3. **Given** plants of more than one type on the calendar, **When** the user filters by one plant type, **Then** only that type is shown; clearing the filter shows the full calendar set again.
4. **Given** an owner or collaborator, **When** they remove a plant from the calendar, **Then** it no longer appears there; the catalog entry and any personal favorite remain.
5. **Given** a viewer, **When** they try to add or remove calendar plants, **Then** the action is refused.
6. **Given** a plant whose zone range does not include the garden’s zone, **When** it is added or shown, **Then** the calendar still can list it with a clear zone-mismatch indication rather than silently hiding or inventing fitness.

---

### User Story 3 - Read a Previously Loaded Calendar Offline (Priority: P3)

After a member has opened a garden calendar while online, they can still read that last-loaded calendar when the device is offline. Adding or removing plants and changing garden frost dates require connectivity.

**Why this priority**: Field use is often offline; read-only last calendar is enough for v1 without a mutation queue.

**Independent Test**: Open a calendar online, go offline, still read the same windows; try to add a plant offline and see an online-required state.

**Acceptance Scenarios**:

1. **Given** a calendar was loaded while online, **When** the device goes offline, **Then** the previously loaded calendar remains readable.
2. **Given** the user is offline, **When** they try to add or remove calendar plants, **Then** they see that they need to be online and the calendar set does not change.
3. **Given** frost dates change on another device while this device is offline, **When** this device reconnects and refreshes, **Then** windows match the current garden frost dates (stale offline dates are not treated as source of truth after refresh).

---

### Edge Cases

- Garden with frost dates but zero plants on the calendar: empty-calendar state with a way for owner/collaborator to add plants.
- Plant has harvest guidance (days to maturity) but no sow/transplant guidance: show harvest as unavailable or only show the windows that can be computed; never invent sow dates.
- Indoor start does not apply (direct-sow-only plant): indoor-start window is unavailable or marked not applicable, not a fake indoor date.
- Filter yields no plants: clear empty state; user can clear the type filter.
- User is not a garden member: calendar is not accessible.
- Unauthenticated user: prompted to sign in; no calendar data.
- Favorites used as a picker: other members do not see the owner’s favorite list; they only see plants actually added to the garden calendar.
- Very large calendar set: list remains usable (paged or otherwise bounded at planning time); the UI does not dump an unbounded catalog.
- This feature does not place plants on a map, record that they were planted, or create watering reminders.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Garden members MUST be able to open a planting calendar scoped to one garden they belong to (not a single calendar for all of a user’s gardens).
- **FR-002**: When a garden has last-frost and first-frost dates, the calendar MUST present indoor-start, outdoor-sow, transplant, and expected-harvest windows for each plant on that garden’s calendar, using that garden’s frost dates and the plant’s growing guidance.
- **FR-003**: When frost dates are missing, the product MUST explain that the calendar cannot be produced until site conditions are set; it MUST NOT invent frost dates.
- **FR-004**: When a plant lacks guidance for a given window, that window MUST be shown as unavailable or not applicable — never as a fabricated date.
- **FR-005**: Growing guidance used for calendar math MUST come from the plant catalog in a vendor-replaceable way (the gardener’s calendar behavior MUST NOT depend on a named external data brand). Unknown catalog fields stay unknown.
- **FR-006**: Owners and collaborators MUST be able to add catalog plants to a garden’s calendar and remove them. Viewers MUST read the calendar only.
- **FR-007**: Owners and collaborators MUST be able to add plants to the garden calendar starting from their personal favorites list. Favorites MUST remain private; adding a favorite to a calendar MUST NOT share the favorite list with other members.
- **FR-008**: Authenticated members MUST be able to filter the garden calendar by plant type (vegetable, herb, flower, fruit, shrub, tree); the filter MUST NOT remove plants from the garden’s saved calendar set, only from the current view.
- **FR-009**: Users MUST NOT see another garden’s calendar plants or dates unless they are members of that garden.
- **FR-010**: After a calendar has been loaded online, that last-loaded view MUST remain readable offline. Adding/removing calendar plants MUST require connectivity and a clear online-required state in this feature.
- **FR-011**: The feature MUST NOT include layout placement, in-ground planting records, care or watering reminders, or purchasing.

### Key Entities *(include if feature involves data)*

- **Garden calendar**: The per-garden set of catalog plants a household is planning, plus the seasonal windows computed for that garden’s site profile.
- **Growing guidance**: Catalog facts that relate a variety to frost (e.g. weeks before/after last frost to start indoors, sow, or transplant) and days to maturity for harvest estimates. Individual fields may be unknown.
- **Calendar entry**: One catalog plant included on one garden’s calendar. Not a record that the plant is in the ground.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: Garden **owner** and **collaborator** may add/remove calendar plants. **Viewer** may read the calendar. Non-members and signed-out users have no access. Catalog remains readable by all authenticated users; favorites remain owner-private.
- **Sharing rules**: The calendar set is shared with all garden members (it is garden data, not personal). Favorites used as a picker stay personal.
- **Isolation**: Calendar contents of Garden A MUST NOT appear on Garden B or to non-members.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Last-loaded calendar for a garden MUST be readable offline.
- Mutations to the calendar set require connectivity (no offline queue in this feature).
- Offline use MUST NOT block cached catalog, favorites, or garden detail from earlier features.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of participants with a garden that has frost dates can open that garden’s calendar and identify indoor-start or outdoor-sow timing for a named plant in under 2 minutes.
- **SC-002**: Changing a garden’s last frost date on a fixture set shifts computed windows for plants with guidance; 100% of fixture plants with guidance show a different indoor-start or sow date when last frost moves by 14 days (plants without guidance stay unavailable).
- **SC-003**: Two gardens with different frost dates never show identical computed dates for the same guided plant (verified on fixtures).
- **SC-004**: Filtering by plant type shows only that type (100% on fixtures); removing a plant from the calendar leaves catalog and favorites unchanged.
- **SC-005**: Non-members see 0 of another household’s calendar entries. Viewers cannot add/remove (100% on the role fixture).
- **SC-006**: After loading a calendar online, it remains readable offline; an offline add attempt shows an online-required state within 5 seconds and does not change the set.
- **SC-007**: At least 85% of participants agree the calendar is clear enough to decide whether to start a plant this week (including when a window is marked unavailable).

## Assumptions

- Household Gardens (named garden, membership, zone, frost dates) already exists. This feature does not create gardens or change invite rules.
- Plant catalog varieties, types, zone ranges, and days to maturity already exist. Additional frost-relative guidance fields may be added to the catalog when a source provides them; missing values stay unavailable.
- Calendar windows are typical outdoor-garden estimates for home gardeners, not legal or scientific guarantees, and not adjusted for indoor grow lights, greenhouses, or row cover unless later specified.
- Northern-hemisphere seasonal reading of last frost (spring) and first frost (fall) matches Household Gardens. Southern-hemisphere season reversal is out of scope for v1.
- “Seed from favorites” means the current user picks from their own favorites; it does not copy someone else’s favorites.
- Watering schedules, layout canvas, bed geometry, and recording actual plant-in-ground dates belong to later features.
- Exact display grouping (week list vs month vs timeline) is a UX choice at planning time as long as SC-001 remains achievable.
