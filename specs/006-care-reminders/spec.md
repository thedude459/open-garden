# Feature Specification: Care Reminders

**Feature Branch**: `006-care-reminders`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Reminders derived from seasonal plantings (water, fertilize, harvest), with offline queue-and-sync for completing or dismissing. Garden-shared among members. Depends on plantings being recorded. Exclude layout editing and purchasing."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Care Reminders for Garden Plantings (Priority: P1)

A garden member opens a garden and sees upcoming care reminders tied to that garden’s plantings: watering, fertilizing, and harvest, when those can be derived from planting dates and catalog care/maturity information. Reminders for unknown needs are omitted or marked unavailable rather than invented.

**Why this priority**: Reminders only make sense once something is planted. A readable list of what needs attention is the MVP.

**Independent Test**: With a planting that has a planted date and known days to maturity, open reminders and see a harvest reminder; a planting with no planted date does not invent a harvest day; non-members see nothing.

**Acceptance Scenarios**:

1. **Given** a garden with at least one planting that has enough information to derive a harvest reminder, **When** a member opens care reminders, **Then** they see that planting identified and a harvest timing they can act on.
2. **Given** catalog water or fertilize information for a planted variety, **When** reminders are shown, **Then** watering and/or fertilizing items appear when they can be derived; when that information is unknown, no fake schedule is shown.
3. **Given** a planting with no planted date, **When** reminders are shown, **Then** date-based reminders for that planting are absent or clearly not ready — not computed from today as if it were planted.
4. **Given** a garden with no plantings, **When** a member opens reminders, **Then** they see a clear empty state pointing them to record plantings (not a broken list).
5. **Given** a viewer, **When** they open reminders, **Then** they can read them.

---

### User Story 2 - Complete or Dismiss a Reminder (Priority: P2)

An owner or collaborator marks a reminder done (care was performed) or dismisses it (not relevant). Other members see that it is no longer due. Viewers cannot complete or dismiss.

**Why this priority**: A reminder list that cannot be cleared becomes noise. Completion is household-shared because care is shared work.

**Independent Test**: Collaborator marks a water reminder done; another member no longer sees it as due; viewer attempt to complete fails; completing does not delete the planting.

**Acceptance Scenarios**:

1. **Given** a due reminder, **When** an owner or collaborator marks it done, **Then** it is no longer due for any member, and the planting remains on the planting list.
2. **Given** a due reminder, **When** an owner or collaborator dismisses it, **Then** it is no longer due; the planting is unchanged.
3. **Given** a viewer, **When** they try to complete or dismiss, **Then** the action is refused.
4. **Given** a repeating kind of care (e.g. watering) where the catalog supports an interval, **When** the current occurrence is marked done, **Then** the next occurrence can appear when it is due (without duplicating the completed one as still due).
5. **Given** User B is not a member, **When** they are signed in, **Then** they see none of the garden’s reminders or completion state.

---

### User Story 3 - Offline Complete/Dismiss Queue (Priority: P3)

When offline, an owner or collaborator can complete or dismiss reminders on-device immediately. The change syncs when connectivity returns. Pending status is visible. Previously loaded reminder lists remain readable offline.

**Why this priority**: Care happens in the yard. Completing a reminder should not require waiting for coverage; generating new reminder rules can wait for online.

**Independent Test**: Load reminders online, go offline, mark one done (pending), reconnect; another member sees it completed; offline-only generation of brand-new reminder types is not required.

**Acceptance Scenarios**:

1. **Given** a previously loaded reminder list, **When** the device is offline, **Then** the list remains readable.
2. **Given** an owner or collaborator is offline, **When** they complete or dismiss a reminder, **Then** it updates on-device immediately and shows pending until sync.
3. **Given** pending completions, **When** connectivity returns, **Then** other members see the completed/dismissed state after one successful sync cycle.
4. **Given** the user was removed from the garden while they had pending completions, **When** they reconnect, **Then** those completions MUST NOT apply.

---

### Edge Cases

- Harvest reminder after harvest date already recorded on the planting: harvest reminder is not shown as due (or is shown completed).
- Planting removed: its reminders disappear.
- Catalog variety deprecated: reminders still identify the planting; user can dismiss.
- Rapid double-complete: final state is completed once; no duplicate completions.
- Time of day / time zones: due dates are calendar days for the household, not hour-precise alarms in v1.
- No push-notification vendor is required for v1 if in-app reminder list meets success criteria; the user must still be able to find due items when they open the garden.
- Watering every day vs drought: product uses catalog water needs when present; it does not claim weather-station accuracy.
- Unauthenticated: no reminder data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Garden members MUST be able to view care reminders for plantings in gardens they belong to.
- **FR-002**: The product MUST derive harvest reminders from plantings that have a planted date and known days to maturity (or an explicit harvest date). It MUST NOT invent maturity or planted dates.
- **FR-003**: The product MUST derive watering and fertilizing reminders only when catalog (or equivalent replaceable) care information exists for that variety; unknown care MUST NOT produce a fabricated interval.
- **FR-004**: Owners and collaborators MUST be able to mark a reminder completed or dismissed. Viewers MUST NOT. Completion/dismissal MUST be visible to all remaining members.
- **FR-005**: Completing or dismissing a reminder MUST NOT delete the planting, catalog plant, or favorite.
- **FR-006**: Users MUST NOT see reminders for gardens they do not belong to.
- **FR-007**: Previously loaded reminder lists MUST remain readable offline. Complete and dismiss MUST apply on-device immediately while offline and MUST sync when connectivity returns without silently dropping intent. Pending state MUST be visible.
- **FR-008**: The feature MUST NOT include layout editing, planting-calendar generation, or purchasing.

### Key Entities *(include if feature involves data)*

- **Care reminder**: A due or upcoming care action (water, fertilize, or harvest) tied to one planting in one garden.
- **Reminder occurrence**: A single instance that can be completed or dismissed (repeating care creates later occurrences rather than leaving the same item forever due).
- **Planting**: Source record from Seasonal Plantings (variety, dates, garden).

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**: **Owner** and **collaborator** complete/dismiss. **Viewer** reads. Non-members: no access.
- **Sharing rules**: Reminders and their completion state are garden-shared among members (household chores, not personal).
- **Isolation**: Garden A reminders MUST NOT leak to non-members or other gardens. Personal favorites remain unrelated.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Last-loaded reminder list is readable offline.
- Complete/dismiss queues on-device like planting mutations and favorites; last intent per occurrence wins when coalescing repeats.
- Creating or recomputing new reminder occurrences MAY wait until online; lack of connectivity MUST NOT hide already-loaded due items or drop queued completions.
- Pending sync MUST be visible; removal from the garden voids pending completions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of participants with a dated planting can open that garden’s reminders and identify at least one harvest-related item (or a clear not-ready state) in under 1 minute.
- **SC-002**: On fixtures, plantings without planted dates never receive a fabricated harvest day; unknown water needs never produce a watering interval (100%).
- **SC-003**: Completing a reminder clears it as due for a second member after refresh (100% on fixtures); the planting still exists.
- **SC-004**: Non-members see 0 reminders; viewers cannot complete (100% on the role fixture).
- **SC-005**: Offline complete then reconnect: other members see completed state within one successful sync cycle; pending is visible before sync.
- **SC-006**: At least 85% of participants agree they can tell what to do today versus what is not due yet.

## Assumptions

- Seasonal Plantings already exist; reminders are not generated from catalog browse or from calendar plans unless the gardener also recorded a planting.
- Household Gardens membership applies unchanged.
- v1 reminder kinds are water, fertilize, and harvest only. Pruning, pest, and succession-sow reminders are out of scope.
- In-app list is sufficient for v1; operating-system push notifications are optional later and not required to meet SC-001.
- Water/fertilize intervals, when present, are coarse household guidance (e.g. from catalog water needs), not weather-adjusted irrigation control.
- Timezone is the household’s implicit local date; no per-reminder timezone field.
- Layout designer is not required to use reminders; reminders do not move plants on a map.
