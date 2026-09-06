# Feature Specification: UI Feedback & Garden Usability Polish

**Feature Branch**: `009-ui-feedback-polish`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "008-garden-planner-ux Improve UI feedback and garden usability to give the app a professional, polished feel." (action feedback app-wide; garden structure & navigation; professional visual polish; no backend/data model changes)

## Clarifications

### Session 2026-08-22

- Q: When is a brief confirmation notice required versus when is the updated screen enough? → A: Notices for service completions (unless navigation/removal makes success obvious); draft map gestures use the moved object plus Unsaved changes; misses still get a message. A newer notice of any kind replaces the current one; success has no Dismiss control.
- Q: How wide is app-wide busy and confirm? → A: First-class: overview, bed view, transplants, garden home/forms, auth, catalog. Plantings/calendar/reminders inherit shared notice/buttons only — no separate action-by-action audit
- Q: How does Open bed work without fighting drag-to-move? → A: Click/tap without drag still opens Bed View; drag still moves. Plus hover/focus cue and a labeled Open bed control
- Q: What is the empty Bed View next step? → A: Direct seed and Transplants as equal next steps
- Q: How long do confirmation and error notices stay? → A: Success auto-dismisses after a few seconds; errors and misses stay until dismissed

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Immediate Action Feedback (Priority: P1)

A gardener takes an action that waits on the service (save, delete, create garden, Direct seed on Bed View, submit sign-in or register, search or add from catalog, link a newly found plant, and similar). The control they used shows a busy state the instant they activate it, and it cannot be activated again until that attempt finishes. The rest of the screen stays usable (they can still read, scroll, and pan). When the attempt finishes, they always see success or failure — never a silent no-change. Service success uses a brief confirmation notice unless the screen already changed (they navigated away or the item is gone). Map draft gestures (place or move a bed, area, or planting) register by the object moving plus **Unsaved changes**; a miss still gets a visible message, not a dead drop.

**Why this priority**: Silent or delayed feedback is the main unprofessional feel. If this story ships alone, every primary and destructive action already feels trustworthy.

**Independent Test**: Automated: sign-in/register, Create garden, Save layout (including miss/offline), catalog search/add, and Add transplant. Garden home/forms (Save garden, invite, confirmed Delete garden) are implemented and checked in quickstart, not a separate Playwright file. On the map, place or drop an object and confirm it registered or that a miss is announced. Plantings list, calendar, and reminders are not part of this independent test.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator and a control that waits on the service (for example Save, Delete after confirm, Create garden, Direct seed, Search catalog, Add transplant, sign in, register), **When** they activate it, **Then** that control immediately shows a busy/in-progress appearance and cannot be activated again until the attempt finishes.
2. **Given** a waiting action is in progress, **When** the gardener looks at the rest of the screen, **Then** it is not frozen: they can still read labels, scroll lists, and pan/zoom the map; only the in-flight control (and any paired confirm) is locked.
3. **Given** a waiting **service** action completes successfully and the gardener stays on the same screen with the item still present (for example Save layout succeeded, catalog add succeeded), **When** the attempt ends, **Then** a brief confirmation notice appears using the product’s shared notice style and then goes away on its own after a few seconds. **When** success already changed the screen (navigated away) or removed the item (confirmed delete), **Then** that updated state is enough; no extra notice is required.
4. **Given** a waiting action fails (offline when the product requires online, validation, or the service refused), **When** the attempt ends, **Then** a visible failure message appears (notice and/or inline error), stays until the gardener dismisses it, and the control is usable again; the gardener is not left wondering whether anything happened.
5. **Given** a gardener places or moves a bed or non-planting area on Garden Overview, or places or moves a planting in Bed View, **When** the gesture completes on a valid target, **Then** the object is visibly in the new place and **Unsaved changes** is showing; no brief confirmation notice is required for that draft gesture. **When** the drop misses a valid target, **Then** they see a miss/failure message (same spirit as “drop missed a bed”) that stays until dismissed, and the object is not silently swallowed.
6. **Given** a viewer, **When** a page is loading (open a garden, catalog, or bed), **Then** they see the existing loading treatment; they never see busy/edit states on mutate controls their role cannot use. This story does not add a separate busy lock on navigation itself.
7. **Given** the gardener is already offline and the action requires being online, **When** they activate it, **Then** they get the existing online-required failure immediately (not an endless busy state).

---

### User Story 2 - Know Where You Are in the Garden (Priority: P1)

A member always knows which garden they are in and whether they are looking at the whole garden map, a single bed’s plantings, or transplants. A persistent place marker (breadcrumb or header) shows **Garden name**, and on Bed View also **Bed name** (for example Garden name > Bed name). From Garden Overview, beds (plantable) and non-planting areas (walkways/structures, not plantable) are obviously different — not by color alone, but with distinct styling and iconography or labels. Selecting a bed has a discoverable “open this bed” cue (hover/focus treatment plus a labeled **Open bed** control). A click or tap on the bed that is not a drag still opens Bed View; dragging the bed still moves it. They do not have to guess that beds are clickable. Bed View has an in-product way back to Garden Overview (not only the browser back control).

**Why this priority**: The two-level garden (map vs bed) is the core of the current planner. If people cannot tell beds from non-planting areas or how to open a bed, polish elsewhere will not help them plan.

**Independent Test**: Open a garden that has beds and at least one non-planting area. Confirm the place marker, that beds vs areas are distinguishable without relying on color, that a bed shows an Open bed cue and a labeled Open bed control, that click-without-drag opens Bed View, that drag still moves the bed, and that Bed View returns to Overview without browser back. A viewer gets the same navigation and distinction and still cannot edit.

**Acceptance Scenarios**:

1. **Given** a member is on Garden Overview, Bed View, or Transplant View, **When** they look at the persistent header/breadcrumb, **Then** they see the garden’s name and which level they are on. On Bed View they also see that bed’s name (Garden name > Bed name).
2. **Given** Garden Overview with at least one bed and one non-planting area, **When** a member (including a viewer) looks at the map, **Then** they can tell which rectangles are plantable beds and which are non-planting areas without relying on color alone (shape treatment, pattern, icon, and/or text such as “Bed” vs “Area”).
3. **Given** Garden Overview, **When** a member points at or focuses a bed, **Then** an obvious Open bed (or equivalent) affordance is visible, and a labeled Open bed control is available (not hover-only). **When** they click or tap the bed without dragging, **Then** they go to that bed’s Bed View. **When** they drag the bed, **Then** it moves and they do not navigate. Click MUST NOT open a size inspector instead of Bed View (same rule as the current planner).
4. **Given** Bed View, **When** a member wants Garden Overview, **Then** they can return with an in-product control (for example Back to overview) without using the browser back control. That return MUST NOT discard an in-progress layout draft (same rule as the current planner).
5. **Given** a viewer, **When** they use Overview and Bed View, **Then** they get the same place marker, bed vs area distinction, and Open bed / back-to-overview paths, and they still cannot add, move, or delete beds, areas, or plantings.

---

### User Story 3 - Empty States That Point to the Next Step (Priority: P2)

A gardener who has no gardens yet, a garden with no beds on the map yet, or a bed with no plantings yet is not left with a bare “nothing here” line. Each empty state explains the situation in plain language and offers a clear next step appropriate to their role (create a garden, create a bed, or — in an empty bed — **Direct seed** and **Transplants** as equal next steps). Viewers see why the view is empty and do not see edit next-steps they cannot use.

**Why this priority**: First-time use is where the product currently feels unfinished. This story is independently useful even before full visual token polish.

**Independent Test**: As owner, open the gardens list with zero gardens; open Overview with zero beds; open Bed View with zero plantings. Confirm copy plus a next-step control. Repeat as viewer and confirm no create/edit next-step they cannot perform.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no gardens, **When** they open the gardens list, **Then** they see guidance to create their first garden and a control that starts that, not only an empty list.
2. **Given** an owner or collaborator of a garden with no beds placed, **When** they open Garden Overview, **Then** they see guidance to place a first bed (name, length, and width as already required) and can start that from the empty state.
3. **Given** a member opens Bed View for a bed with no plantings, **When** the bed is empty, **Then** an owner or collaborator sees **Direct seed** and **Transplants** as equal next steps (neither is visually the only primary); a viewer sees that the bed is empty and no edit prompts.
4. **Given** a catalog search or filter with no matches, **When** results are empty, **Then** the empty state matches the shared empty-state language (what happened + what to try next), not a one-off sentence unique to that screen.

---

### User Story 4 - One Visual Language Across Screens (Priority: P2)

A gardener moving among the gardens list, garden overview, bed view, plant catalog, and sign-in/register sees one product: consistent spacing, card elevation, and button ranks (primary vs secondary vs destructive). Loading, empty, and error treatments look like the same family. Earlier one-off spacing, type, or button sizes on those screens are brought into the shared visual language (the color and type already used in the product, extended with spacing, elevation, and button hierarchy).

**Why this priority**: Professional feel is the cumulative impression of those screens. It can follow P1 feedback and navigation without blocking them.

**Independent Test**: Walk gardens list, a garden’s overview, a bed view, catalog, and auth. Confirm one spacing rhythm, one card elevation treatment, three button ranks, and matching loading/empty/error treatments. Confirm no remaining obvious one-off visual treatments on those screens.

**Acceptance Scenarios**:

1. **Given** the audited screens (gardens list, garden overview, bed view, plant catalog, sign-in/register), **When** a member compares buttons, **Then** primary, secondary, and destructive actions are visually distinct from each other and consistent from screen to screen.
2. **Given** those screens, **When** a member compares cards/panels and gaps between blocks, **Then** spacing and elevation follow one scale, not arbitrary per-screen padding and shadows.
3. **Given** a loading wait, an empty view, or an error, **When** they appear on those screens, **Then** they share one visual family (placement, type, and notice style) rather than unrelated treatments.
4. **Given** garden overview and bed view, **When** a member uses them after this feature, **Then** they still follow the current planner’s two-view rules; this story only changes how those views look and how actions announce themselves, not what the gardener is allowed to edit where.

---

### Edge Cases

- What happens if the gardener activates Save while a previous Save is still in progress? The in-flight Save stays the only attempt; the control stays busy until it finishes.
- What happens if they confirm delete, then lose connectivity before the delete finishes? They see failure (online-required or service failure), the item remains, and they can try again.
- What happens if a map drop is valid for the object but the later Save is refused (spacing or fit)? They already saw the object move (draft registered); Save then shows the existing spacing/fit refusal, not a silent no-op.
- What happens if a viewer never hovers (keyboard or touch)? Open bed must still be discoverable with focus and a labeled Open bed control, not hover-only. Click-without-drag still opens Bed View for viewers (read-only). Dragging a bed as a viewer still MUST NOT move it.
- What happens if an owner starts a pointer on a bed and then drags? The bed moves; they MUST NOT be taken to Bed View for that gesture.
- What happens on a small screen? Place marker, Open bed, and back-to-overview remain usable; busy state still applies to the control that was activated.
- What happens if a second notice is posted while one is visible? The newest notice replaces the current one (any kind); notices MUST NOT stack.
- What happens if success navigates away (sign-in, open garden)? Arrival on the next screen is enough confirmation; a leftover notice from the previous screen MUST NOT appear on the new screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every control that waits on the service MUST show a busy/in-progress state immediately when activated, before the result arrives.
- **FR-002**: While that attempt is in progress, the triggering control MUST be inactive so the same action cannot be submitted twice. The rest of the interface MUST remain responsive (read, scroll, pan/zoom).
- **FR-003**: When a waiting **service** action finishes, the gardener MUST see success or failure. Silent completion is not allowed. Success MUST show a brief confirmation notice unless navigation or removal already makes success obvious. Failure MUST show a notice and/or inline error. Draft map place/move follow FR-005 (no extra success notice; misses still announced).
- **FR-004**: Destructive actions (delete garden, delete bed, delete area, remove planting, delete transplant, and similar) MUST keep their existing confirm step, then apply FR-001–FR-003 to the confirmed action.
- **FR-005**: Map gestures that place or move a bed, non-planting area, or planting MUST give immediate visual follow-through. A completed valid gesture MUST show that it registered via the object’s new place and **Unsaved changes** (no extra success notice). A miss MUST be announced and MUST NOT silently discard the object (direct-seed drop on the tray still MUST NOT silently delete, per the current planner).
- **FR-006**: First-class busy + confirm screens are Garden Overview, Bed View, Transplant View, garden home and garden forms, sign-in/register, and the plant catalog (including search, add/favorite, and linking a plant found on a name search with no prior local match). Plantings list, calendar, and reminders MAY pick up the shared notice and button appearance; this feature MUST NOT require a separate action-by-action busy/confirm audit of those three screens.
- **FR-007**: Garden Overview, Bed View, and Transplant View MUST show a persistent place marker with the garden name and the current level. Bed View MUST include the bed name (Garden name > Bed name).
- **FR-008**: On Garden Overview, plantable beds and non-planting areas MUST be visually distinct using more than color (pattern and/or iconography and a visible **Bed** or **Area** label).
- **FR-009**: Beds on Garden Overview MUST expose a discoverable Open bed affordance on hover and keyboard focus **and** a labeled Open bed control. A click or tap on the bed that is not a drag MUST open Bed View. Dragging the bed MUST still move it (owners/collaborators) and MUST NOT navigate. Opening a bed MUST NOT open a size inspector.
- **FR-010**: Bed View MUST provide an in-product return to Garden Overview. That return MUST NOT discard the shared in-memory layout draft.
- **FR-011**: Empty gardens list, empty Garden Overview (no beds), and empty Bed View (no plantings) MUST explain the situation and offer a role-appropriate next step. Empty Bed View for an owner or collaborator MUST present Direct seed and Transplants as equal next steps. Viewers MUST NOT be offered create/edit next steps they cannot perform.
- **FR-012**: Loading, empty, and error presentations MUST share one visual family across the audited screens.
- **FR-013**: The product’s existing color and type language MUST be extended with a consistent spacing scale, card elevation, and three button ranks (primary, secondary, destructive), applied on gardens list, garden overview, bed view, plant catalog, and sign-in/register. One-off spacing, type, or control sizing on those screens MUST be brought into that language.
- **FR-014**: This feature MUST NOT require new server-stored fields, new resource types, or changes to membership rules. Planner rules from Garden Planner UX remain in force (two views, draft until Save except confirmed deletes, online-required mutations, drop-missed-a-bed, transplant vs direct seed).
- **FR-015**: Offline-required failures MUST appear immediately when the gardener is already offline; a busy state MUST NOT run indefinitely.
- **FR-016**: Keyboard and assistive-tech users MUST receive the same busy, success, failure, miss, and navigation cues (including live status where a miss or error is announced).
- **FR-017**: Success confirmation notices MUST go away on their own after a few seconds. Error and miss notices MUST stay until the gardener dismisses them. At most one notice is visible; a newer post of any kind replaces the current notice. Success notices have no Dismiss control.

### Key Entities

- **Action attempt**: One activation of a waiting control or one completed map gesture. Has in-progress, succeeded, or failed; never “unknown.”
- **Place marker**: The persistent garden + level label (and bed name on Bed View) that tells the gardener where they are.
- **Bed vs non-planting area**: Existing garden map objects; this feature only changes how they are recognized, not what they store.
- **Empty state**: A first-time or zero-item view that includes explanation plus a next step (or a read-only explanation for viewers).
- **Shared notice**: The product-wide confirmation/error presentation. Success notices auto-dismiss after a few seconds and have no Dismiss control. Error and miss notices stay until dismissed. A newer post of any kind replaces the current notice.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: Unchanged. Owner and collaborator mutate; viewer reads. Place marker, bed vs area distinction, Open bed, back to overview, and empty-state *explanations* are for every member. Empty-state *create/edit* next steps and busy states on mutate controls are only for roles that can take those actions.
- **Sharing rules**: Unchanged. A garden remains shareable with specific users as owner, collaborator, or viewer.
- **Isolation**: Unchanged. One household garden’s layout and plantings stay invisible to non-members (same not-found outcome as a missing garden).

### Offline / PWA Considerations

- Waiting actions that already require online (planner mutations, auth, most catalog writes) MUST fail visibly with the existing online-required (or equivalent) message; they MUST NOT change local draft or stored data when offline, matching current planner and auth rules.
- Planting-list queue-and-sync (already specified) MUST still show pending vs failed. This feature MUST NOT require busy/confirm wiring on those queue actions; those screens MAY pick up shared notice and button appearance only (FR-006).
- Previously loaded screens remain readable offline. Empty-state next steps that require online MUST say so if the gardener is offline rather than appearing to work.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After activating a waiting control, gardeners see an in-progress state on that control in under 0.5 seconds (perceived as immediate), on a typical household connection.
- **SC-002**: In a moderated walkthrough of 5 **service** actions (including one delete and one save that stays on the same screen), every save-style success shows a confirmation notice, every delete-style success is obvious from the item being gone, and every failure shows a message; 0% complete with no visible change and no message.
- **SC-003**: Double-activating Save or Create garden (two activations within one second) results in a single attempt, not two gardens or two saves.
- **SC-004**: At least 9 of 10 untrained testers, after 10 seconds on Garden Overview, correctly identify which shapes are plantable beds vs non-planting areas without being told to use color.
- **SC-005**: Untrained testers can go from a garden’s home to Overview, open a named bed, and return to Overview using only on-screen controls (no browser back) in under 30 seconds on the first try.
- **SC-006**: A signed-in user with zero gardens can start creating a garden from the gardens list in under 15 seconds because the next step is on screen.
- **SC-007**: A visual review of gardens list, garden overview, bed view, catalog, and sign-in/register finds a single spacing rhythm, a single card elevation treatment, and three consistent button ranks, with no remaining obvious one-off control styling on those screens.

## Assumptions

- Garden Planner UX (two-view overview vs bed, transplant view, draft until Save except confirmed deletes, online-required planner mutations, drop-missed-a-bed) is already the product behavior; this feature polishes feedback and appearance on top of it.
- Household roles (owner, collaborator, viewer) and not-found-for-non-members stay as specified in household gardens.
- The product already has a small shared visual vocabulary (earth/leaf colors and type). This feature extends it with spacing, elevation, and button ranks rather than introducing a new brand.
- Brief confirmation notices apply to **service** completions when the gardener stays on the same screen and the item remains. Navigating away or removing the item stands as success (no extra notice). Draft map place/move uses the object plus **Unsaved changes** only. Misses still get a message. Success notices auto-dismiss after a few seconds and have no Dismiss control; errors and misses stay until dismissed. A newer post of any kind replaces the current notice. A leftover notice MUST NOT appear after a screen change.
- “Link provisional plant” means the existing catalog path where a name search with no local match may add a newly found plant — it is in scope for busy + confirm only.
- Calendar, reminders, and the plantings list inherit shared notice and button language only. They are not first-class for a busy/confirm action audit in this feature.
- No new server features, identifiers, or permission flags are required. Any notice or busy state is client presentation.
- Mobile-width use is in scope for the same stories (place marker, Open bed, back, busy controls) without a separate mobile app.
