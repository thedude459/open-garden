# Feature Specification: Care Reminders

**Feature Branch**: `006-care-reminders`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "006-care-reminders — Reminders derived from seasonal plantings (water, fertilize, harvest), with offline queue-and-sync for completing or dismissing. Garden-shared among members. Depends on plantings being recorded. Exclude layout editing and purchasing."

## Clarifications

### Session 2026-08-17

- Q: What does dismiss do for repeating care (water/fertilize) vs harvest? → A: Skip this occurrence only. Repeating kinds can appear again when next due. Harvest dismiss ends that planting’s harvest reminder.
- Q: When catalog water/fertilize has no usable interval, omit the row or show unavailable? → A: Omit. No water/fertilize row when there is no usable interval.
- Q: Do missed watering/fertilizing intervals stack as many overdue items? → A: No. At most one open water/fertilize occurrence per planting (overdue, due today, or next upcoming).
- Q: How far ahead should harvest reminders appear? → A: All unfinished harvest reminders for current plantings (no day cutoff).
- Q: How should the reminder list be ordered? → A: Flat list: overdue (oldest first), then due today, then upcoming (soonest first). Not grouped by bed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Care Reminders for Garden Plantings (Priority: P1)

A garden member opens a garden and sees care reminders tied to that garden’s **seasonal plantings** (the same records as the planting list): harvest when it can be derived from a planted date and known days to maturity, and watering or fertilizing only when the catalog actually supplies a care interval. Reminders for unknown or only-qualitative needs (for example “Moderate” water with no interval) are omitted rather than invented or shown as unavailable rows. A variety that is only on the planting calendar, only a personal favorite, or only placed on the layout is not a reminder until someone records a planting.

**Why this priority**: Reminders only make sense once something is recorded as planted. A readable list of what needs attention is the MVP and can ship before complete/dismiss.

**Independent Test**: With a planting that has a planted date and known days to maturity, open reminders and see a harvest item for that planting; a planting with no planted date does not invent a harvest day; a calendar plan without a planting does not appear; non-members get the same not-found outcome as a missing garden.

**Acceptance Scenarios**:

1. **Given** a garden with at least one planting that has a planted date and known days to maturity, **When** a member opens care reminders, **Then** they see that planting identified and a harvest timing they can act on (due today, overdue, or upcoming — including harvests more than two weeks away). Items appear in a flat list: overdue (oldest first), then due today, then upcoming (soonest first), not grouped by bed.
2. **Given** catalog water or fertilize information that includes a usable interval for a planted variety, **When** reminders are shown, **Then** watering and/or fertilizing items appear when they can be derived, with **at most one** open watering item and **at most one** open fertilizing item per planting (overdue, due today, or next upcoming — not a stack of missed intervals). **Given** only a qualitative water label (for example Moderate) or missing fertilize data, **When** reminders are shown, **Then** that planting has no watering or fertilizing row (not an unavailable placeholder).
3. **Given** a planting with no planted date, **When** reminders are shown, **Then** that planting contributes **no** date-based reminder rows (not computed from today as if it were planted). Other plantings in the same garden may still appear when derivable.
4. **Given** a planting whose harvest date is already recorded on the planting list, **When** reminders are shown, **Then** harvest is not shown as due for that planting.
5. **Given** a garden with no plantings, **When** a member opens reminders, **Then** they see a clear empty state pointing them to record plantings (not a broken list).
6. **Given** a viewer, **When** they open reminders, **Then** they can read them; they cannot complete or dismiss.
7. **Given** User B is not a member, **When** they are signed in, **Then** they cannot open that garden’s reminders (same not-found outcome as a missing garden).
8. **Given** two planting rows of the same variety, **When** reminders are shown, **Then** each planting has its own reminder stream (two harvest items if both are dated).
9. **Given** a variety on the garden’s planting calendar (or a personal favorite, or a layout placement) with **no** planting record, **When** a member opens reminders, **Then** that variety does not appear as a reminder.

---

### User Story 2 - Complete or Dismiss a Reminder (Priority: P2)

An owner or collaborator marks a reminder done (care was performed) or dismisses it (skip this occurrence). Other members see that occurrence is no longer due. For repeating care (water/fertilize with an interval), a later occurrence can still become due. Harvest is one-shot: dismiss ends that planting’s harvest reminder. Viewers cannot complete or dismiss. Completing or dismissing does not remove the planting, catalog plant, favorite, calendar plan, or layout placement.

**Why this priority**: A reminder list that cannot be cleared becomes noise. Completion is household-shared because care is shared work.

**Independent Test**: Collaborator marks a harvest reminder done; another member no longer sees it as due; the planting remains on the planting list; viewer attempt to complete fails.

**Acceptance Scenarios**:

1. **Given** a due reminder, **When** an owner or collaborator marks it done, **Then** it is no longer due for any member, and the planting remains on the planting list.
2. **Given** a due reminder, **When** an owner or collaborator dismisses it, **Then** that occurrence is no longer due; the planting is unchanged (including planted and harvest dates). **Given** a repeating kind with an interval, **When** they dismiss the current occurrence, **Then** a later occurrence can still appear when it is next due. **Given** a harvest reminder, **When** they dismiss it, **Then** harvest is not due again for that planting unless the household records a new planting row.
3. **Given** a viewer, **When** they try to complete or dismiss, **Then** the action is refused.
4. **Given** a repeating kind of care (for example watering) where the catalog supplies an interval, **When** the current occurrence is marked done, **Then** at most one next occurrence can appear (when it is due or upcoming), without duplicating the completed one as still due and without stacking missed intervals.
5. **Given** a one-shot harvest reminder marked done, **When** any member reloads reminders, **Then** harvest is not due again for that planting unless the household records a new planting row.
6. **Given** User B is not a member, **When** they are signed in, **Then** they see none of the garden’s reminders or completion state.
7. **Given** two members complete or dismiss the same occurrence online, **When** both saves succeed, **Then** the later successful save is the stored result (last-write-wins; no merge editor).

---

### User Story 3 - Offline Complete/Dismiss Queue (Priority: P3)

When offline, an owner or collaborator can complete or dismiss already-loaded reminders on-device immediately. The change syncs when connectivity returns. Pending status is visible. Previously loaded reminder lists remain readable offline. Generating a brand-new reminder list from the server MAY wait until online. Opening reminders offline with **no** prior successful load shows online-required or an empty state — not a broken error.

**Why this priority**: Care happens in the yard. Completing a reminder should not require waiting for coverage.

**Independent Test**: Load reminders while connected, then lose connectivity without wiping the last load; mark one done (pending); reconnect and refresh; another member sees it completed; after membership loss, stale last-load MUST NOT authorize complete/dismiss.

**Acceptance Scenarios**:

1. **Given** a previously loaded reminder list, **When** reminder APIs are unreachable, **Then** the last loaded list remains readable.
2. **Given** an owner or collaborator is offline, **When** they complete or dismiss a reminder, **Then** it updates on-device immediately and shows pending until sync.
3. **Given** pending completions, **When** connectivity returns, **Then** other members see the completed/dismissed state after one successful sync cycle.
4. **Given** a viewer is offline, **When** they view a previously loaded list, **Then** they can read it but cannot queue complete or dismiss.
5. **Given** the user was removed from the garden while they had pending completions, **When** they reconnect, **Then** those completions MUST NOT apply; they see that they no longer have access (same not-found as a missing garden).
6. **Given** another member already completed or dismissed the same occurrence, **When** this device syncs a pending complete/dismiss, **Then** last successful stored state wins; the product MUST NOT recreate a due item that the household already cleared.

---

### Edge Cases

- Harvest reminder after harvest date already recorded on the planting: harvest is not shown as due (and not shown as upcoming).
- Harvest whose derived date is weeks or months away: still listed as upcoming (no 14-day or other day cutoff). Completed or dismissed harvest is not listed.
- Completing a harvest reminder does **not** auto-write the planting’s harvest date (that stays on the planting list). The harvest occurrence is still no longer due.
- Dismissing a repeating reminder skips **this occurrence only**; it does not suppress that care kind forever. The next occurrence can become due after the interval. Harvest dismiss ends that planting’s harvest reminder (one-shot). Dismissing does not change planted or harvest dates.
- Planting removed: its reminders disappear; they are not left as orphan chores.
- Catalog variety deprecated: reminders still identify the planting; the user can complete or dismiss.
- Rapid double-complete: final state is completed once; no duplicate due items.
- Time of day / time zones: due dates are calendar days for the household, not hour-precise alarms in v1.
- No operating-system push notifications in v1; the user finds due items when they open the garden’s reminders.
- Watering every day vs drought: product uses a catalog **interval** when present; qualitative labels and weather are not turned into a cadence. Missed intervals do **not** stack: at most one open water item and one open fertilize item per planting.
- Planted date in the past with an interval and no completions: the open occurrence is overdue or due today from the latest interval boundary on or before today (anchored at planted date), not one overdue row per missed week.
- Planted date in the future with an interval: the open occurrence is upcoming on the planted date (not due today).
- Unauthenticated: no reminder data.
- Non-member: same not-found as a missing garden (no existence leak).
- Layout placements and calendar plans do not create reminders.
- Reminders are not drawn on the garden layout canvas.
- Empty reminder list when plantings exist but none are dated / none have derivable care: clear “nothing due / not ready” state at garden level, not an error. Undated plantings contribute no rows; dated plantings still appear when derivable. Missing water/fertilize intervals MUST NOT add unavailable rows.
- List order: overdue oldest-first, then due today, then upcoming soonest-first. The list is not grouped by named bed or by care kind.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Garden members MUST be able to view care reminders for plantings in gardens they belong to. Non-members MUST receive the same not-found outcome as a missing garden. Unauthenticated users MUST NOT access reminder data.
- **FR-002**: The product MUST derive harvest reminders from plantings that have a planted date and known days to maturity. It MUST NOT invent maturity or planted dates. If the planting already has a harvest date, harvest MUST NOT be shown as due.
- **FR-003**: The product MUST derive watering and fertilizing reminders only when catalog (or equivalent replaceable) care information includes a usable interval for that variety. Qualitative labels without an interval, and missing fertilize data, MUST produce **no** watering or fertilizing row (not an unavailable placeholder and not a fabricated schedule). For each planting, there MUST be at most one open watering occurrence and at most one open fertilizing occurrence (overdue, due today, or next upcoming). Missed intervals MUST NOT appear as separate overdue items. The first interval is anchored at the planted date; if planted is in the past with no completion or skip, the open occurrence uses the latest interval boundary on or before today; if planted is in the future, the open occurrence is upcoming on the planted date. After complete or dismiss, the next occurrence is that occurrence’s date plus the interval (still a single open item).
- **FR-004**: Owners and collaborators MUST be able to mark a reminder occurrence completed or dismissed. Viewers MUST NOT. Completion and dismissal MUST be visible to all remaining members. Concurrent online complete/dismiss of the same occurrence MUST keep the last successful save (no merge editor). Dismiss MUST skip the current occurrence only: repeating kinds (water/fertilize with an interval) MAY become due again after that interval; harvest dismiss MUST end that planting’s harvest reminder (one-shot, same as complete for due-state). A complete or dismiss POST MUST upsert the `(plantingId, kind, dueOn)` key from the request body (204 even when that `dueOn` is not the currently derived open occurrence). Derivation MUST NOT recreate a due item the household already cleared: for harvest, **any** prior complete or dismiss for that planting hides harvest; for repeating kinds, the cursor is the event with the greatest `occurrence_on`.
- **FR-005**: Completing or dismissing a reminder MUST NOT delete the planting, catalog plant, favorite, calendar plan, or layout placement. Completing harvest MUST NOT automatically set the planting’s harvest date.
- **FR-006**: Garden A’s reminders MUST NOT appear in Garden B. Cross-garden isolation is enforced together with FR-001 (non-members receive the same not-found outcome as a missing garden).
- **FR-007**: Previously loaded reminder lists MUST remain readable offline. Complete and dismiss MUST apply on-device immediately while offline and MUST sync when connectivity returns without silently dropping intent. Pending state MUST be visible. Failed sync MUST show as needs-attention (not success). This feature’s queue MUST NOT be used to mutate plantings, beds, layout, calendar plans, or favorites.
- **FR-008**: The feature MUST NOT include layout editing, planting-calendar generation, purchasing, weather-based irrigation, companion-planting rules, or operating-system push notifications.
- **FR-009**: Reminders MUST attach to planting records, not to catalog browse, personal favorites, or calendar plans. A calendar plan or favorite without a planting MUST NOT appear. Two plantings of the same variety MUST produce two independent reminder streams.
- **FR-010**: Overdue and due-today items MUST be distinguishable from upcoming items. Every unfinished harvest reminder for a current planting MUST remain listed regardless of how far in the future it is (no rolling day cutoff). Harvest MUST NOT appear if it is already recorded on the planting list, or if **any** harvest complete or dismiss event exists for that planting (one-shot per planting row, regardless of which `dueOn` was posted). Water and fertilize remain limited to one open occurrence each (FR-003), which MAY be upcoming. The default list MUST be flat (not grouped by bed or by care kind) and MUST order items overdue (oldest due date first), then due today, then upcoming (soonest due date first). Tie-break among the same due date: planting identity then kind (harvest, water, fertilize) so the order is stable.
- **FR-011**: A planting whose catalog variety is later unavailable MUST still identify its reminders; owners and collaborators MUST still be able to complete or dismiss them.
- **FR-012**: After reconnect and a refresh, list contents MUST reflect current membership: a user removed while offline MUST NOT keep acting as a member (stale cache MUST NOT authorize complete or dismiss).

### Key Entities *(include if feature involves data)*

- **Care reminder**: A due, overdue, or upcoming care action (water, fertilize, or harvest) tied to one planting in one garden.
- **Reminder occurrence**: A single instance that can be completed or dismissed. Repeating care (when an interval exists) keeps **at most one open occurrence per kind per planting** rather than stacking missed intervals. Dismiss skips this occurrence only; it does not permanently suppress that care kind. Harvest is one-shot per planting row: complete or dismiss ends harvest for that planting.
- **Planting**: Source record from Seasonal Plantings (variety, planted/harvest dates, garden). Distinct from a calendar plan, a favorite, and a layout placement.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**:
  - **Owner** and **collaborator**: read, complete, and dismiss.
  - **Viewer**: read only.
  - **Non-member**: no access (same not-found as a missing garden).
- **Sharing rules**: Reminders and their completion/dismissal state are garden-shared among members (household chores, not personal). They are not globally visible. Favorites stay personal.
- **Isolation**: Garden A reminders MUST NOT leak to non-members or other gardens. Personal favorites and planting-calendar plans remain unrelated lists.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Last-loaded reminder list is readable offline (including viewers).
- Complete/dismiss queues on-device like planting-list mutations (pending visible; last intent per occurrence wins when coalescing repeats). Not online-only like membership and calendar plant-set changes. Not a layout mutation queue.
- Creating or recomputing the reminder list from the server MAY wait until online; lack of connectivity MUST NOT hide already-loaded due items or drop queued completions. With no prior successful load, the page shows online-required or an empty state — not a broken error.
- If sync fails, the item shows needs-attention, not success.
- Removal from the garden voids pending completions; stale cache MUST NOT authorize new complete/dismiss.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: *(Usability study — not a CI gate. Technical first-load target is <2s on the local network after the garden is open; manual quickstart check only, not a CI timing gate.)* At least 90% of participants with a dated planting can open that garden’s reminders and identify at least one harvest-related item (or a clear not-ready state) in under 1 minute.
- **SC-002**: On fixtures, plantings without planted dates never receive a fabricated harvest day; qualitative or missing water/fertilize data produce no watering or fertilizing row; a planting weeks past with an interval and no completions shows at most one open water/fertilize item (not one per missed interval) (100%).
- **SC-003**: Completing a reminder clears it as due for a second member after refresh (100% on fixtures); the planting still exists; harvest date on the planting is unchanged unless the gardener edited it on the planting list.
- **SC-004**: Non-members see not-found (not an empty reminder list of a garden they can name); viewers cannot complete or dismiss (100% on the role fixture).
- **SC-005**: Offline complete then reconnect: other members see completed state within one successful sync cycle; pending is visible before sync (100% on fixtures).
- **SC-006**: *(Usability study — not a CI gate.)* At least 85% of participants agree they can tell what is due today or overdue versus what is upcoming. On fixtures, overdue items appear before due-today items, which appear before upcoming items (100% for the order check).
- **SC-007**: On fixtures, two plantings of the same variety yield two harvest reminder streams when both are dated; a harvest more than 14 days away still appears as upcoming; a calendar-only plan without a planting does not appear (100%).
- **SC-008**: On a two-editor fixture, the later successful complete or dismiss is the stored result after both saves; a following load shows that result (100%).

## Assumptions

- Seasonal Plantings and Household Gardens already exist. Reminders are generated from planting records, not from catalog browse, favorites, or calendar plans, unless the gardener also recorded a planting.
- Garden Layout may exist; reminders do not require a layout and MUST NOT be edited on the layout canvas.
- v1 reminder kinds are water, fertilize, and harvest only. Pruning, pest, and succession-sow reminders are out of scope.
- Current catalog water fields may be qualitative (for example Low / Moderate / High). v1 does **not** map those labels to a number of days. Watering and fertilizing rows appear only when a replaceable catalog (or later catalog field) supplies an interval; otherwise those kinds are omitted (no unavailable placeholder). Harvest from planted date + days to maturity is the reminder that current fixtures can always demonstrate.
- Completing harvest does not auto-fill the planting’s harvest date; that remains a planting-list edit. The completed harvest occurrence still stays not due.
- Dismiss means skip this occurrence (for example it rained, skip today’s watering). It is not “never show this kind again.” Harvest remains one-shot, so dismiss still ends that planting’s harvest reminder. There is no undo or restore of a dismissed occurrence in v1.
- Repeating care does not accumulate a backlog of missed weeks. One open water item and one open fertilize item per planting is enough for the household to catch up.
- Harvest has no rolling window: if it is still unfinished for a current planting, it stays on the list even when far in the future.
- Default reminder list is time-ordered, not bed-grouped. Named-bed grouping remains on the planting list.
- In-app list is sufficient for v1; operating-system push notifications are out of scope.
- Timezone is the household’s implicit local date; no per-reminder timezone field and no hour-of-day alarms.
- Last-write-wins for online concurrent complete/dismiss matches Household Gardens and Seasonal Plantings (no merge UI).
- Offline mutation queue matches planting-list intent (queue-and-sync, pending visible), not membership/calendar (online-only) and not layout (online-only, no queue).
- Existing email-and-password accounts are reused; this feature does not add registration or third-party sign-in.
- “Due today” uses the household’s local calendar date when the list is opened, not a frozen server midnight in another region.
