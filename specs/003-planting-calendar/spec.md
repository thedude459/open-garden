# Feature Specification: Planting Calendar

**Feature Branch**: `003-planting-calendar`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "003-planting-calendar — For a selected garden, show when to start indoors, sow outdoors, transplant, and expect harvest. Per-garden seasonal calendar (not a global user calendar). Catalog enrichment only as needed: frost-relative sow/transplant windows (unavailable when unknown). Filter calendar by plant type; optionally seed from favorites. Offline: last-loaded calendar readable. Exclude: dragging plants onto a map; watering schedules."

## Clarifications

### Session 2026-08-16

- Q: How should indoor-start, sow, transplant, and harvest timing appear? → A: A date range from earliest to latest guidance (e.g. Mar 1–Mar 15)
- Q: How complete must frost-relative catalog guidance be for v1? → A: Operator baseline sync stores earliest/latest frost-relative weeks when the source has them; plants without that data stay unavailable but can still be on the calendar
- Q: What is first frost used for when computing windows? → A: Each indoor/sow/transplant range is relative to last frost or first frost as the catalog indicates; harvest still start-window plus days to maturity
- Q: How should the calendar help with “what should I start this week?” → A: Full list always shown; plants with any start window (indoor, sow, or transplant) overlapping this week are visually emphasized
- Q: What does “this week” mean for that emphasis? → A: Rolling 7 days starting today (today through the next 6 calendar days), using the viewer’s local date

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a Garden Planting Calendar (Priority: P1)

A garden member opens a garden that has both last-frost and first-frost dates and sees a seasonal calendar for plants they selected: indoor start, outdoor sow, transplant, and expected harvest as date ranges (earliest to latest). Indoor, sow, and transplant ranges use last frost or first frost according to each plant’s catalog guidance. Harvest is the start window plus days to maturity. Missing guidance is labeled unavailable rather than guessed. Plants whose indoor, sow, or transplant range overlaps the next 7 local calendar days (today through today+6) are visually emphasized; the rest of the list stays visible.

**Why this priority**: “What should I start now?” is the reason gardens store frost dates. A readable calendar for one garden is the MVP.

**Independent Test**: As a member of a garden with zone and both frost dates, add a last-frost-relative plant and a first-frost-relative plant, open the calendar, and see those ranges move when the matching frost date changes; a plant without guidance still appears with unavailable windows; a plant whose sow range includes today is emphasized while one that only harvests this week is not.

**Acceptance Scenarios**:

1. **Given** a garden with last and first frost dates and at least one plant on the calendar that has growing guidance, **When** a member opens the planting calendar, **Then** they see that garden’s seasonal windows for indoor start, outdoor sow, transplant, and expected harvest as date ranges from earliest to latest (as applicable to that plant).
2. **Given** the same plant on two gardens with different frost dates, **When** a member opens each garden’s calendar, **Then** the date ranges differ according to each garden’s frost dates (the calendar is per-garden, not a single user-wide calendar).
3. **Given** a last-frost-relative sow window and a first-frost-relative sow window on the same garden, **When** only last frost moves by 14 days, **Then** the last-frost-relative range moves and the first-frost-relative range does not; the reverse holds when only first frost moves.
4. **Given** a plant whose indoor-start, sow, transplant, or harvest guidance is unknown, **When** it appears on the calendar, **Then** that window is clearly unavailable and is not filled with invented dates or a guessed midpoint.
5. **Given** a garden missing last frost, first frost, or both, **When** a member opens the calendar, **Then** they see a clear explanation that the calendar cannot be produced until those site conditions are set (not a blank failure that looks broken). Members can still see and manage the calendar plant list so they can prepare it before frost dates are known.
6. **Given** a viewer of the garden, **When** they open the calendar, **Then** they can read it but cannot add or remove plants from it.
7. **Given** some plants whose indoor, sow, or transplant range overlaps today through the next 6 local calendar days and others that do not, **When** a member opens the calendar, **Then** the overlapping plants are visually emphasized, every calendar plant is still listed, and a plant whose only overlapping window is harvest is not treated as “start this week.”

---

### User Story 2 - Choose Plants and Filter the Calendar (Priority: P2)

A gardener adds catalog plants to that garden’s calendar (including from their personal favorites), removes plants they do not want to plan, and filters the view by plant type so vegetables, herbs, or flowers can be reviewed separately.

**Why this priority**: A calendar of the entire catalog is noise; choosing plants (and filtering by type) makes the calendar usable. It still needs US1’s date rendering.

**Independent Test**: Owner or collaborator adds a favorite plant and a catalog plant, filters by type so only one type remains, removes a plant, and confirms a viewer cannot change the set; another user does not see this garden’s calendar plant list on a garden they do not belong to.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator and a populated catalog, **When** they add a plant to the garden’s calendar, **Then** that plant appears with whatever windows are known, including plants whose frost-relative weeks are unknown (those windows show as unavailable).
2. **Given** an owner or collaborator with personal favorites, **When** they add from favorites, **Then** matching favorite plants can be added to this garden’s calendar without exposing those favorites to other members as a shared favorites list.
3. **Given** plants of more than one type on the calendar, **When** the user filters by one plant type, **Then** only that type is shown; clearing the filter shows the full calendar set again.
4. **Given** an owner or collaborator, **When** they remove a plant from the calendar, **Then** it no longer appears there; the catalog entry and any personal favorite remain.
5. **Given** a viewer, **When** they try to add or remove calendar plants, **Then** the action is refused.
6. **Given** a plant whose zone range does not include the garden’s zone, **When** it is added or shown, **Then** the calendar still can list it with a clear zone-mismatch indication rather than silently hiding or inventing fitness.
7. **Given** a plant already on the garden’s calendar, **When** an owner or collaborator adds that same catalog plant again, **Then** the calendar still has a single entry for that plant (no duplicate rows).

---

### User Story 3 - Read a Previously Loaded Calendar Offline (Priority: P3)

After a member has opened a garden calendar while online, they can still read that last-loaded calendar when the device is offline. Adding or removing plants requires connectivity. Frost dates are garden site conditions from Household Gardens; changing them is not a calendar mutation, but this feature’s windows MUST refresh from current frost dates once the device is online again.

**Why this priority**: Field use is often offline; read-only last calendar is enough for v1 without a mutation queue.

**Independent Test**: Open a calendar online, go offline, still read the same windows; try to add a plant offline and see an online-required state.

**Acceptance Scenarios**:

1. **Given** a calendar was loaded while online, **When** the device goes offline, **Then** the previously loaded calendar remains readable.
2. **Given** the user is offline, **When** they try to add or remove calendar plants, **Then** they see that they need to be online and the calendar set does not change.
3. **Given** frost dates change on another device while this device is offline, **When** this device reconnects and refreshes, **Then** windows match the current garden frost dates (stale offline dates are not treated as source of truth after refresh).
4. **Given** a previously loaded calendar viewed offline, **When** the viewer’s local date has moved, **Then** current-week emphasis is computed from the cached windows and today’s local date (emphasis does not stay frozen on the load-day).

---

### Edge Cases

- Garden with frost dates but zero plants on the calendar: empty-calendar state with a way for owner/collaborator to add plants.
- Plant has harvest guidance (days to maturity) but no sow/transplant/indoor-start guidance: harvest is unavailable; never invent a start date in order to show harvest. The plant MAY still be added to the calendar.
- Indoor start does not apply (direct-sow-only plant): indoor-start window is unavailable, not a fake indoor date or range.
- Catalog frost-relative weeks lack which frost they are relative to: that window is unavailable (do not assume last frost).
- A computed range that extends past first frost or before last frost is still shown as computed; it is not clipped to the frost dates.
- Filter yields no plants: clear empty state; user can clear the type filter.
- No plants have a start window overlapping today through today+6: full list still shown with no current-week emphasis (not an empty calendar).
- Seasonal windows cannot be produced (frost dates missing): no current-week emphasis; plant list still shown.
- Rolling 7 days crosses 31 December: a start window in early January can overlap “this week” in late December (windows are annual month-and-day ranges, like frost dates).
- User is not a garden member (including a guessed garden identity): calendar is not accessible; the outcome matches a missing garden (no distinct signal that the garden exists).
- Unauthenticated user: prompted to sign in; no calendar data.
- Favorites used as a picker: other members do not see the owner’s favorite list; they only see plants actually added to the garden calendar.
- Very large calendar set: list remains usable (paged or otherwise bounded at planning time); the UI does not dump an unbounded catalog.
- Garden has frost dates but no hardiness zone: windows still compute from frost dates; zone-mismatch is omitted or shown as unknown rather than a false mismatch.
- Catalog plant later deprecated or removed: calendar still lists the entry with an unavailable-variety indicator; owner/collaborator can still remove it.
- Two members add or remove calendar plants while both are online: the last successful change is kept; there is no merge editor. After save or a later load, each member sees the stored calendar set.
- Owner deletes the garden: the calendar is gone with the garden; catalog entries and personal favorites are unchanged.
- User is removed from the garden while this device is offline with a cached calendar: after reconnect and refresh, that calendar is not listed, not openable, and not treated as still accessible for new actions.
- This feature does not place plants on a map, record that they were planted, or create watering or care reminders. Adding a plant to the calendar MUST NOT create a seasonal planting record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Garden members MUST be able to open a planting calendar scoped to one garden they belong to (not a single calendar for all of a user’s gardens).
- **FR-002**: When a garden has both last-frost and first-frost dates, the calendar MUST present indoor-start, outdoor-sow, transplant, and expected-harvest windows for each plant on that garden’s calendar as date ranges from earliest to latest. Indoor-start, outdoor-sow, and transplant ranges MUST be computed from the garden frost date the catalog names for that window (last frost or first frost). Expected harvest MUST be the chosen start window plus days to maturity (transplant if known, otherwise outdoor sow, otherwise indoor start). A catalog value that is a single number MUST appear as a range whose start and end fall on the same day (not a separately invented midpoint). Windows MUST NOT be clipped to frost dates.
- **FR-003**: When last frost, first frost, or both are missing, the product MUST explain that seasonal windows cannot be produced until those site conditions are set; it MUST NOT invent frost dates. The saved calendar plant list MUST still be readable and editable by owner/collaborator in that state.
- **FR-004**: When a plant lacks guidance for a given window, including which frost that window is relative to, that window MUST be shown as unavailable — never as a fabricated date, midpoint, guessed span, or assumed last-frost anchor. Direct-sow plants with no indoor-start data use the same unavailable treatment (v1 has no separate “not applicable” state).
- **FR-005**: Growing guidance used for calendar math MUST come from the plant catalog in a vendor-replaceable way (the gardener’s calendar behavior MUST NOT depend on a named external data brand). Operator baseline catalog sync MUST persist earliest and latest frost-relative weeks, and which frost each indoor/sow/transplant window is relative to, when the source provides them. Unknown catalog fields stay unknown; plants without those fields MUST still be addable to a garden calendar, with those windows shown as unavailable.
- **FR-006**: Owners and collaborators MUST be able to add catalog plants to a garden’s calendar and remove them. Viewers MUST read the calendar only. Adding a catalog plant that is already on that garden’s calendar MUST leave a single entry (no duplicates).
- **FR-007**: Owners and collaborators MUST be able to add plants to the garden calendar starting from their personal favorites list. Favorites MUST remain private; adding a favorite to a calendar MUST NOT share the favorite list with other members.
- **FR-008**: Authenticated members MUST be able to filter the garden calendar by plant type (vegetable, herb, flower, fruit, shrub, tree); the filter MUST NOT remove plants from the garden’s saved calendar set, only from the current view. Type filter MUST NOT remove current-week emphasis from plants that remain visible.
- **FR-009**: Users MUST NOT see another garden’s calendar plants or dates unless they are members of that garden. A non-member MUST receive the same not-found outcome as a missing garden (no existence leak). Unauthenticated users MUST NOT access any calendar data.
- **FR-010**: After a calendar has been loaded online, that last-loaded view MUST remain readable offline. Adding/removing calendar plants MUST require connectivity and a clear online-required state in this feature. After reconnect and a refresh, windows MUST match current garden frost dates, and a user who is no longer a member MUST NOT keep acting on that calendar. Current-week emphasis on a cached calendar MUST use the viewer’s current local date.
- **FR-011**: The feature MUST NOT include layout placement, in-ground planting records, care or watering reminders, or purchasing. Calendar entries MUST NOT automatically become seasonal plantings.
- **FR-012**: Concurrent online add/remove of calendar plants MUST keep the last successful change; the product MUST NOT present a merge editor. After a save or a subsequent load, the user MUST see the currently stored calendar set.
- **FR-013**: When seasonal windows can be produced, the calendar MUST visually emphasize plants whose indoor-start, outdoor-sow, or transplant range overlaps the viewer’s local **this week**: today through the next 6 calendar days (7 days total). Emphasis MUST NOT hide other calendar plants. A harvest range overlapping that span MUST NOT by itself cause emphasis. Unavailable start windows MUST NOT be treated as overlapping. Emphasis MUST use the viewer’s current local date even when reading a cached calendar offline. There is no locale week-start setting in this feature.

### Key Entities *(include if feature involves data)*

- **Garden calendar**: The per-garden set of catalog plants a household is planning, plus the seasonal windows computed for that garden’s site profile when both frost dates are set.
- **Growing guidance**: Catalog facts for a variety: earliest and latest weeks before or after a named frost (last frost or first frost) for indoor start, outdoor sow, and transplant, plus days to maturity for harvest estimates. Each indoor/sow/transplant window includes which frost it is relative to when known. Populated from the replaceable plant-data source during operator baseline sync when the source has them; otherwise unknown. A single catalog number is a range with equal earliest and latest.
- **Seasonal window**: A computed date range (earliest through latest) for one action on one calendar entry in one garden, stored as annual month-and-day like frost dates. Not a single recommended day unless earliest and latest coincide.
- **This week**: The viewer’s local calendar date today through the next 6 local calendar days (7 days total). Not a locale Sunday–Saturday or Monday–Sunday week.
- **Calendar entry**: One catalog plant included on one garden’s calendar. Identity is the garden plus the catalog variety — not a record that the plant is in the ground, and not a personal favorite.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: Garden **owner** and **collaborator** may add/remove calendar plants. **Viewer** may read the calendar (including the plant list and computed windows when available). Non-members and signed-out users have no access. Catalog remains readable by all authenticated users; favorites remain owner-private.
- **Sharing rules**: The calendar set is shared with all garden members (it is garden data, not personal). Favorites used as a picker stay personal. There is no public calendar and no share-by-link for this feature.
- **Isolation**: Calendar contents of Garden A MUST NOT appear on Garden B or to non-members. A non-member MUST receive the same not-found outcome as a missing garden.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Last-loaded calendar for a garden MUST be readable offline.
- Mutations to the calendar set require connectivity (no offline queue in this feature).
- Current-week emphasis on a cached calendar MUST follow the viewer’s local date at view time, not the date the calendar was last loaded.
- Offline use MUST NOT block cached catalog, favorites, or garden detail from earlier features.
- After reconnect and refresh, stale cached calendars for gardens the user was removed from MUST NOT stay actionable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: *(Usability study — not a CI gate.)* At least 90% of participants with a garden that has frost dates can open that garden’s calendar and identify indoor-start or outdoor-sow timing for a named plant in under 2 minutes.
- **SC-002**: On fixtures, last-frost-relative indoor-start or sow ranges (both earliest and latest) move when last frost moves by 14 days and do not move when only first frost moves; first-frost-relative ranges do the reverse (100%). Plants without guidance stay unavailable.
- **SC-003**: Two gardens with different frost dates never show identical computed date ranges for the same guided plant (verified on fixtures).
- **SC-004**: Filtering by plant type shows only that type (100% on fixtures); removing a plant from the calendar leaves catalog and favorites unchanged; adding an already-listed plant does not create a second row (100%).
- **SC-005**: Non-members see 0 of another household’s calendar entries and receive the same not-found outcome as a missing garden. Viewers cannot add/remove (100% on the role fixture).
- **SC-006**: After loading a calendar online, it remains readable offline; an offline add attempt shows an online-required state within 5 seconds and does not change the set.
- **SC-007**: *(Usability study — not a CI gate.)* At least 85% of participants agree the calendar is clear enough to decide whether to start a plant this week (including when a window is marked unavailable), aided by current-week emphasis on the full list.
- **SC-008**: On fixtures, plants with an indoor, sow, or transplant range overlapping today through today+6 (viewer local date) are emphasized (100%); plants with only a harvest overlap, or with no overlap, are not emphasized; the full calendar set remains listed (100%).

## Assumptions

- Household Gardens (named garden, membership, zone, frost dates) already exists and is implemented. This feature does not create gardens, change invite rules, or edit frost dates; it consumes the garden’s site profile.
- Both last frost and first frost are required to compute seasonal windows for the garden as a whole (a calendar mixes spring and fall plants). Household Gardens allows those dates to be omitted independently; this feature treats any incomplete pair as “windows not available,” while still allowing the plant list to be managed.
- Each indoor-start, outdoor-sow, and transplant catalog window is relative to last frost or first frost as the source indicates. Harvest is not independently frost-relative: it is days to maturity applied to both ends of the start window (transplant if known, otherwise outdoor sow, otherwise indoor start). If no start window exists, harvest stays unavailable rather than counting from today or from an invented sow date.
- Computed ranges are not clipped to last or first frost. A harvest or start range that extends past first frost is still shown.
- Plant catalog varieties, types, zone ranges, and days to maturity already exist. Frost-relative earliest/latest week fields and which frost they anchor to are catalog enrichment: operator baseline sync stores them when the source provides them; on-demand miss-fill MAY persist them the same way as other catalog attributes. Missing values stay unavailable. This feature MUST NOT invent curated default weeks or assume last frost when the source does not name an anchor. Direct-sow plants with no indoor-start guidance use the same unavailable treatment as unknown guidance; v1 does not distinguish a separate “not applicable” state.
- Calendar windows are typical outdoor-garden estimates for home gardeners, not legal or scientific guarantees, and not adjusted for indoor grow lights, greenhouses, or row cover unless later specified.
- Northern-hemisphere seasonal reading of last frost (spring) and first frost (fall) matches Household Gardens. Southern-hemisphere season reversal is out of scope for v1.
- “Seed from favorites” means the current user picks from their own favorites; it does not copy someone else’s favorites.
- Watering schedules, layout canvas, bed geometry, and recording actual plant-in-ground dates belong to later features (Seasonal Plantings, Garden Layout, Care Reminders). Calendar plans are not automatically turned into plantings.
- Exact display grouping (week list vs month vs timeline) is a UX choice at planning time as long as SC-001 remains achievable. Current-week emphasis is required regardless of grouping; it is not a filter that hides plants.
- “This week” is a rolling 7-day span starting on the viewer’s local today (today through today+6). Seasonal windows are annual month-and-day ranges, so a late-December span can overlap an early-January start window. Default sort order among plants is a UX choice at planning time.
- Calendar list presentation is suitable for household scale (tens to low hundreds of planned plants per garden, not thousands); exact paging follows product UX defaults at planning time.
