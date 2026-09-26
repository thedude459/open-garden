# Feature Specification: Garden View Clarity

**Feature Branch**: `014-garden-view-clarity`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "The names of the plantings and the bed name make the view look very busy. Maybe putting the name of the planting in the circle or an abbreviation would be better. I wouldn't need to know the bed name and the dimensions when I am planting, I would really only need to know that in the garden view that shows all the beds. I would like the garden overview page to not show the configurations of the garden and instead show the actual garden. All the information about it could be moved to a configuration tab or something. I want navigation and seeing the full garden to be easy and user friendly."

## Clarifications

### Session 2026-09-12

- Q: When a gardener is planting in a bed, what short text should appear on each planting mark? → A: Shortened common name that fits on the mark (start of the name, truncated if needed)
- Q: When the gardener selects a planting mark, where should the full common name appear? → A: Full name off the plan (one detail/status line) while the mark stays selected
- Q: On the all-beds garden map, should each occupied bed still show planting names (and a count when the same name appears more than once)? → A: Keep planting names (and counts) on each occupied bed on the all-beds map
- Q: In the in-bed planting view, may the current bed’s name still appear off the plan (page heading or “you are here”), as long as name and size are not painted on the bed itself? → A: Bed name allowed off the plan (heading / you-are-here); not on the bed drawing; size not shown in this view
- Q: Besides name, notes, hardiness, and frost dates, should sharing (members, invite, leave) and delete-garden move to the same configuration destination so they are not on the garden map? → A: Configuration includes name/notes/zone/frost and members, invite, leave, and delete garden

## User Scenarios & Testing *(mandatory)*

Gardeners already have a **whole-garden map** (every bed and area) and a **per-bed planting view** (marks on that bed). Today, opening a garden often lands on garden facts and household controls (name, notes, hardiness, frost dates, members, invite, leave, delete) instead of that map. In the planting view, full planting names sit beside the marks and the bed’s name and size stay on screen, so two nearby plants (for example two Sweet Basil) look crowded.

This feature is **presentation and navigation**. It does not add new garden data, change who may edit a garden, or change what Overview vs Bed View is allowed to edit.

### User Story 1 - Open A Garden, See The Garden (Priority: P1)

A member opens a garden from the garden list (or uses the garden’s “see the whole garden” destination) and immediately sees the **visual garden**: beds and non-planting areas on the map, at relative size and position. Garden identity (the garden’s name in the header) is enough context. Name, notes, hardiness zone, frost dates, members, and delete are **not** the first thing on that screen.

**Why this priority**: The gardener’s job is to see the plot. Configuration is occasional; the map is daily.

**Independent Test**: From the garden list, open a garden (including one with no beds). The first screen is Garden Overview, not configuration. Open a garden that has beds: those beds show name and size on the map.

**Acceptance Scenarios**:

1. **Given** a member on the garden list, **When** they open a garden, **Then** they see the visual garden (all beds on the map) as the primary content without scrolling past garden configuration fields.
2. **Given** that visual garden view, **When** they look at each bed, **Then** they can tell beds apart by **name** and judge scale by **size**, and occupied beds still show planting **names** (and a **count** when the same name appears more than once).
3. **Given** the visual garden view, **When** they look for name, notes, hardiness, frost dates, members, invite, leave, or delete garden, **Then** those are not occupying the map; they are reached from a separate configuration destination (User Story 3).
4. **Given** a viewer, **When** they open the garden, **Then** they see the same map-first layout and cannot change configuration.

---

### User Story 2 - Plant In A Bed Without Label Clutter (Priority: P1)

A gardener opens a single bed to place or inspect plantings. They already know which bed they are in. They do **not** need that bed’s name and dimensions repeated on the plan. Each planting is identified by a **shortened common name on the planting mark** (from the start of the name, truncated to fit), not by a full name floating beside the mark that overlaps neighbors.

**Why this priority**: Overlapping full names and extra bed chrome make planting harder than the map itself.

**Independent Test**: Open a bed that has two nearby plantings with the same or similar names. Marks stay readable with truncated names on the marks; selecting one shows the full name off the plan; the bed’s name and dimensions are not persistent visual chrome on the plan.

**Acceptance Scenarios**:

1. **Given** a bed with two or more plantings close together, **When** a member is in the in-bed planting view, **Then** each planting shows a shortened common name **on the mark** (from the start of the name, truncated to fit), and full names are not drawn as separate labels beside the marks.
2. **Given** that in-bed view, **When** the gardener is placing or moving plantings, **Then** the bed’s name and dimensions are **not** painted on the bed drawing. The bed **name** MAY appear off the plan (heading or you-are-here). **Size is not shown** in this view.
3. **Given** a short label that could match more than one plant, **When** the gardener selects a planting, **Then** the **full common name** appears in one detail line **off the plan** (not as a second label on the bed).
4. **Given** a viewer, **When** they open the in-bed view, **Then** they see the same quiet marks and cannot move plantings.

---

### User Story 3 - Configuration Lives Next Door (Priority: P2)

A gardener still needs to rename the garden, edit notes, set hardiness and frost dates, and manage who is in the household (members, invite, leave, delete). That work lives in a **garden configuration** destination in the same garden navigation as Overview, plantings, calendar, and similar — not on the screen whose job is to show the plot.

**Why this priority**: Settings and sharing must remain findable; they just must not hide the garden.

**Independent Test**: From the visual garden, open configuration, change a setting an owner is allowed to change, save, return to the map. Confirm members/invite/leave/delete are on that same destination (with today’s role rules). Viewers can open configuration read-only.

**Acceptance Scenarios**:

1. **Given** a member on the visual garden, **When** they choose the configuration destination, **Then** they see garden name, notes, hardiness zone, frost dates, and the member list (the household facts that used to dominate the garden landing).
2. **Given** an owner or collaborator, **When** they save a configuration change they are allowed to make, **Then** the change persists (same role rules as today: collaborators may edit name/notes/site; owners invite, change roles, transfer, remove, and delete).
3. **Given** a viewer, **When** they open configuration, **Then** they can read garden facts and members and cannot save, invite, or delete.
4. **Given** any garden destination (configuration, plantings list, calendar, reminders, transplants, in-bed view), **When** the gardener wants the full garden map, **Then** they can reach it in **one** navigation action.

---

### Edge Cases

- A planting with a very long common name: the mark shows a truncated prefix of that name (not stretched across neighbors); the full name appears on the off-plan detail line when the mark is selected.
- Two plantings whose truncated prefixes match: the gardener can still tell them apart by selecting a mark (full name on the off-plan detail line) and by position on the bed.
- A bed with no plantings: the in-bed view is still uncluttered (no empty name stack); the all-beds view still shows that empty bed with name and size.
- A garden with no beds yet: opening the garden still prefers the visual garden (empty map / existing empty guidance), not the configuration form (including members and delete).
- Screen readers and small screens: garden name and current bed name remain available as accessible names (heading / you-are-here). They MUST NOT be duplicated as labels on the bed drawing in the in-bed view.
- Offline: viewing the map and marks from the last available garden data still works as today. Saving configuration or the plan while offline keeps today’s online-required behavior (no new offline editor).
- Unsaved layout draft: moving between the visual garden and an in-bed view still shares the working draft (existing planner rule); this feature does not add a new discard rule.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Opening a garden from the garden list MUST present the **visual garden** (the all-beds map) as the primary content. Garden configuration (facts, members, invite, leave, delete) MUST NOT be the first-screen primary content.
- **FR-002**: The all-beds visual garden MUST continue to show each bed’s **name** and **dimensions** so gardeners can identify beds and judge scale.
- **FR-003**: Garden name, notes, hardiness zone, frost dates, **members**, **invite**, **leave**, and **delete garden** MUST live on a dedicated **configuration** destination in garden navigation, not on the visual garden as the main body. Existing role rules for those actions MUST stay (owner vs collaborator vs viewer).
- **FR-004**: In the in-bed planting view, the product MUST NOT paint the bed’s **name** or **dimensions** on the bed drawing. The current bed **name** MAY appear off the plan (page heading or you-are-here). **Dimensions MUST NOT** be shown in this view (they remain on the all-beds visual garden).
- **FR-005**: In the in-bed planting view, each planting MUST show a **shortened common name on the planting mark**, taken from the **start** of the common name and truncated to fit the mark. Initials-only codes and separate full-name labels beside the mark MUST NOT be used.
- **FR-006**: Selecting a planting mark in the in-bed view MUST show that planting’s **full common name** in **one detail line off the plan**. The product MUST NOT draw the full name as an extra label on the bed. Selecting another mark MUST update that line. Clicking empty plan (not a mark) MUST clear the selection and the line.
- **FR-007**: From any other destination in that garden (configuration, lists, calendar, reminders, transplants, in-bed view), the gardener MUST be able to open the visual garden in **one** navigation action.
- **FR-008**: Viewers MUST see the same map-first layout, quiet in-bed marks, and configuration destination. They MUST NOT be able to change configuration, invite or remove members, delete the garden, or move plantings (existing role rules).
- **FR-009**: Owners and collaborators keep existing permission to edit garden configuration and (where already allowed) the plan. This feature MUST NOT weaken sharing or isolation. (Complement of FR-008: FR-008 is viewer UX; FR-009 is owner/collaborator non-regression.)
- **FR-010**: The all-beds visual garden MUST still summarize plantings on each occupied bed as **names** (and a **count** when the same name appears more than once). This feature MUST NOT remove that glanceable inventory and MUST NOT start drawing in-bed planting positions on the all-beds view.

### Key Entities

- **Visual garden (all-beds view)**: The map of beds and non-planting areas. This is where bed names and sizes belong, and where the gardener “sees the garden.” Product name: **Garden Overview** (`/gardens/:id/layout`).
- **In-bed planting view**: The close view of one bed’s planting marks. Short labels on marks; no persistent bed name/size chrome. Product name: **Bed View** (`/gardens/:id/layout/beds/:bedId`).
- **Planting mark label**: The planting’s common name shortened from the start to fit on the mark; the stored name is unchanged.
- **Garden configuration**: The garden’s name, notes, hardiness zone, frost dates, member list, invite, leave, and delete — all in a dedicated destination, not on the map. Product name: **Configuration** (`/gardens/:id/configure`).

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: Unchanged household roles — owner, collaborator, viewer. Owners and collaborators may edit garden facts and the plan as they do today. **Invite, role change, transfer, remove member, and delete garden** remain owner-only. Viewers may open the visual garden, in-bed view, and configuration in read-only form (including seeing who is a member).
- **Sharing rules**: A garden remains visible only to its members. Non-members still get the same not-found outcome as a missing garden. Sharing controls live on configuration, not on the map.
- **Isolation**: Configuration and plan edits stay scoped to that garden. Other households’ gardens are unaffected.

### Offline / PWA Considerations

- Opening the visual garden and in-bed marks from the last successfully loaded garden data MUST still work offline (same as today’s layout read cache).
- Saving configuration or saving the plan while offline MUST keep today’s online-required behavior (message, no silent local commit).
- This feature MUST NOT introduce a second offline copy of garden settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the garden list, a member reaches a view of **all beds on the map** in one open action, and that view is not dominated by configuration fields (100% of trials on a garden that already has beds).
- **SC-002**: On a bed with at least two nearby plantings, a gardener can identify each mark without reading overlapping full-name labels beside the marks (100% on a fixture with two close plantings of the same common name).
- **SC-003**: After moving garden facts **and** sharing/delete into configuration, an owner can still change name/notes/site, invite or remove a member, and (with confirm) delete — and see allowed changes persist after leaving and returning (100% on a fixture garden).
- **SC-004**: From configuration or the in-bed view, a gardener can return to the full garden map in one navigation action (100%).
- **SC-005**: A viewer can complete SC-001, SC-002, and SC-004 but cannot save configuration, invite members, delete the garden, or move plantings (100%).

## Assumptions

- Garden Overview vs Bed View **editing split** from the existing garden planner stays: Overview owns bed geometry and areas; Bed View owns plantings. This feature only changes what is **shown** and **where garden settings live**.
- Short labels are the existing common name from the start, truncated to fit the mark. Gardeners do not type a separate nickname. Initials-only codes are out of scope.
- Selecting a planting mark reveals the full common name in one detail line off the plan, not by hover and not by painting the full name onto the bed. Clicking another mark switches the line to that planting. Clicking empty plan (not a mark) clears the selection and the line.
- “Configuration” is a first-class destination in garden navigation (the gardener asked for a tab or similar). It is not a modal that blocks the map as the only way to edit those fields.
- Opening a garden from the list **lands on the visual garden**, not on configuration. Members, invite, leave, and delete are not on that landing.
- Plantings list, calendar, reminders, and transplants stay; this feature does not redesign those pages except to keep one-step access to the map.
- Delete garden from configuration still requires the existing confirm step.
- No new plant catalog fields, no new membership rules, no TLS/hostname work.
- Header/title that names the garden, and in-bed heading/you-are-here that names the **current bed**, may remain. Bed **size** stays on the all-beds view only. The problem is on-plan clutter and a settings-first landing.
