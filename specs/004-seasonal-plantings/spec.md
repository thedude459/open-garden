# Feature Specification: Seasonal Plantings

**Feature Branch**: `004-seasonal-plantings`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "004-seasonal-plantings — Record what is actually planted this season (variety, garden, optional named bed, plant/harvest dates) as a list, not a map. Named beds are containers (e.g. Raised bed 1), not polygons. Offline add/remove/update with queue-and-sync. Depends on household gardens and the plant catalog."

## Clarifications

### Session 2026-08-16

- Q: What happens when a queued edit meets a planting another member already removed? → A: Pending update/remove of a planting that no longer exists fails visibly and does not recreate it. Pending adds still sync. Repeats on an existing planting still coalesce to last intent.
- Q: May planted and harvest dates be in the future? → A: Planted and harvest dates MAY be in the past, today, or the future. Unset planted date still means not dated. Harvest cannot be earlier than planted when both are set.
- Q: How is the planting list organized by default? → A: Default grouped by named bed. Unassigned appears only when at least one planting has no bed (refined by the empty-beds question). Optional filter to one bed. Within a group, newest recorded planting first (`createdAt`, not planted date).
- Q: Do empty named beds appear on the grouped planting list? → A: Empty named beds appear as empty groups so they can be assigned into, renamed, or deleted. Unassigned appears only when at least one planting has no bed.
- Q: What happens when a planting is removed? → A: Permanent delete after confirm. No undelete or archive in this feature. Canceling confirm leaves the planting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a Planting in a Garden (Priority: P1)

A garden owner or collaborator records that a catalog variety is planted (or will be planted) in a garden this season. They pick the variety from the catalog (or from their personal favorites), see it on that garden’s planting list with enough identity to recognize it, set a planted date when known (including a future date), later set a harvest date (actual or expected), and remove plantings that were a mistake or were pulled out after confirming the delete. A planting without a planted date is still listed with that date clearly not set, not invented as today.

**Why this priority**: “What is in the ground” is the join between catalog varieties and a household garden. Layout and care reminders have nothing to attach to without it. A readable, editable list for one garden is the MVP.

**Independent Test**: As owner, add a planting for a catalog plant in a garden, see it on that garden’s list with variety identity, set or clear planted and harvest dates, confirm-remove it (and verify cancel leaves it); a viewer can read but not mutate; a non-member cannot find the list.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator and a catalog plant, **When** they add a planting to a garden they belong to, **Then** the planting appears on that garden’s planting list with the variety’s identity (common name, species, cultivar when known).
2. **Given** an owner or collaborator with personal favorites, **When** they add from favorites, **Then** that variety can become a planting on this garden without exposing those favorites to other members as a shared list.
3. **Given** a planting without a planted date yet, **When** a member opens the list, **Then** the entry is still listed and planted date is clearly not set (not filled with today or another invented date).
4. **Given** an owner or collaborator, **When** they set planted or harvest dates in the past, today, or the future, **Then** those dates persist and other members see them on the next load; if both are set, harvest on or after planted is accepted and harvest before planted is rejected.
5. **Given** an owner or collaborator, **When** they choose to remove a planting and confirm, **Then** it is permanently gone from the garden list (not listed, not restorable in this feature); the catalog plant, any personal favorite, and any planting-calendar plan for that variety remain. **When** they start remove but cancel the confirm, **Then** the planting remains.
6. **Given** a viewer, **When** they open the planting list, **Then** they can read it; they cannot add, edit, or remove plantings.
7. **Given** User B is not a member, **When** they are signed in, **Then** they cannot open that garden’s plantings (same not-found outcome as a missing garden).
8. **Given** the same catalog variety already recorded as a planting in the garden, **When** an owner or collaborator adds that variety again, **Then** a second planting row is created (two sowings or two beds are allowed; identity is the planting record, not the variety alone).

---

### User Story 2 - Optional Named Beds as Lists (Priority: P2)

A gardener optionally assigns a planting to a named bed in that garden (for example “Raised bed 1” or “Patio pots”). The planting list is grouped by bed by default. Empty named beds still appear as empty groups. Plantings with no bed appear in a distinct Unassigned group only when at least one planting is unassigned. The gardener may filter to one bed. Within a group, the newest recorded planting appears first (most recently created, not planted date). Beds are labels and containers, not drawn shapes.

**Why this priority**: Households talk about beds before they need a map. Grouping by name keeps the list usable; geometry is a later layout feature.

**Independent Test**: Owner creates a named bed, assigns two plantings to it, sees the default grouped list, filters to that bed, moves a planting to another bed or to no bed, deletes the bed and confirms plantings remain unassigned; viewer cannot create beds.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator, **When** they create a named bed in a garden, **Then** that name appears as an empty group on the planting list they can assign plantings to, even before any planting is assigned.
2. **Given** plantings in more than one bed (and some unassigned), **When** a member opens the planting list, **Then** plantings are grouped by named bed (including empty named beds as empty groups) with a distinct Unassigned group; within each group the newest recorded planting (`createdAt`) is first.
3. **Given** every planting is assigned to a named bed, **When** a member opens the planting list, **Then** Unassigned is not shown; empty named beds still appear as empty groups.
4. **Given** the list is grouped by bed, **When** the user filters to one bed, **Then** only that bed’s plantings are shown; clearing the filter restores the full grouped list without deleting plantings.
5. **Given** an owner or collaborator, **When** they rename a bed, **Then** plantings assigned to it still belong to it and show the new name.
6. **Given** an owner or collaborator, **When** they delete a named bed, **Then** the bed is gone and its plantings remain in the garden as unassigned (not silently deleted).
7. **Given** a viewer, **When** they view plantings, **Then** they can see bed names but cannot create, rename, or delete beds.
8. **Given** a filter that matches no plantings, **When** the user is viewing the list, **Then** they see a clear empty state for that view and a way to show all plantings again; the saved plantings are unchanged.

---

### User Story 3 - Offline Planting Changes Queue and Sync (Priority: P3)

When offline, an owner or collaborator can add, update, or remove plantings and named beds on-device immediately. Changes sync when connectivity returns. Pending status is visible. The product does not silently drop intent. Previously loaded planting lists stay readable for members, including viewers.

**Why this priority**: Planting records are often captured in the yard with poor connectivity. Unlike garden membership and planting-calendar set changes, these mutations should queue.

**Independent Test**: Load the list online, go offline, add a planting, see it on the list as pending, reconnect, confirm it appears for another member after sync; a viewer offline can read but cannot queue mutations.

**Acceptance Scenarios**:

1. **Given** an owner or collaborator is offline, **When** they add, edit dates, reassign bed, or remove a planting (or create/rename/delete a named bed), **Then** the change is visible on-device immediately and marked pending until synced.
2. **Given** pending planting or bed changes, **When** connectivity returns, **Then** the garden’s planting list matches the user’s last on-device intent after one successful sync cycle.
3. **Given** sync has not completed, **When** the user views the list, **Then** unsynced items show a pending indicator. **Given** a queued update or remove failed (for example the planting no longer exists), **When** the user views the list, **Then** that item shows a needs-attention failure (not success) with the visible error; it is not treated as saved.
4. **Given** a viewer is offline, **When** they view a previously loaded planting list, **Then** they can read it but cannot queue mutations.
5. **Given** a user was removed from the garden while they had pending planting edits, **When** they reconnect, **Then** those mutations MUST NOT apply; they see that they no longer have access.
6. **Given** another member removed a planting while this device had a pending update or remove for it, **When** this device reconnects, **Then** the pending change fails visibly, the planting is not recreated, and a pending **add** of a new planting still syncs.

---

### Edge Cases

- Duplicate planting of the same variety in the same garden: allowed (two rows of tomatoes in different beds or successive sowings); identity is the planting record, not the variety alone.
- Planting remove: the product asks for explicit confirmation; after confirm, the planting is permanently gone with no undelete or archive. Canceling confirm leaves the planting unchanged. The same variety MAY be recorded again as a new planting.
- Harvest date before planted date: rejected with a clear message; prior values remain. Future planted and future harvest dates are allowed. Unset dates stay unset (not coerced to today).
- Catalog plant later deprecated or unavailable: planting list still shows the record with an unavailable-variety indicator; the user can still remove it.
- User removed from the garden while they have pending offline planting edits: on reconnect, mutations MUST NOT apply; the user sees that they no longer have access.
- Empty garden planting list: clear empty state inviting the gardener to record a planting. Unassigned is not shown when there are no plantings.
- Empty named beds: still shown as empty groups on the planting list (including when the garden has no plantings yet). Unassigned is omitted when every planting has a bed, and when there are no plantings.
- Named bed with blank or whitespace-only name: rejected.
- Two beds with the same name in one garden: rejected; names are unique per garden (trim, case-insensitive).
- Offline queue vs a member who deleted the planting online: pending update or remove fails visibly and MUST NOT recreate the planting; pending adds of new plantings still sync. The product does not silently pretend both the delete and the stale edit happened.
- Unauthenticated access: no planting or bed data.
- Non-member access: same not-found outcome as a missing garden (no existence leak).
- A variety on the garden’s planting calendar is not a planting until someone records it; recording a planting does not add or remove a calendar plan.
- This feature does not draw bed shapes, compute spacing, generate care reminders, or perform planting-calendar math.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Owners and collaborators MUST be able to add a planting that links one catalog variety to one garden they belong to. Variety choice MUST use a searchable, paged catalog (not an unbounded dump of every plant) and MAY include the current user’s personal favorites as a picker without making favorites garden-shared.
- **FR-002**: Garden members MUST be able to list plantings for a garden they belong to, with variety identity and planted/harvest dates (each date optional until set). An unset date MUST display as not set, never as today or another invented value. When set, planted and harvest dates MAY be in the past, today, or the future.
- **FR-003**: Owners and collaborators MUST be able to update planted date, harvest date, and bed assignment, and MUST be able to remove a planting. Remove MUST require an explicit confirmation step. After confirmation, deletion is permanent (no undelete or archive in this feature). Canceling confirm MUST leave the planting unchanged. Concurrent online saves of the same planting MUST keep the last successful save; the product MUST NOT present a merge editor.
- **FR-004**: Viewers MUST read plantings and named beds and MUST NOT create, update, or delete them.
- **FR-005**: Owners and collaborators MUST be able to create, rename, and delete named beds within a garden. Beds MUST be named containers only (no size, shape, or map position in this feature). A bed name MUST be non-empty after trim, at most 120 characters, and unique among beds in that garden (trim, case-insensitive).
- **FR-006**: A planting MAY be assigned to one bed in its garden or to no bed. Deleting a bed MUST NOT delete its plantings; they become unassigned.
- **FR-007**: Users MUST NOT see, open, or modify plantings or bed names for gardens they do not belong to. A non-member MUST receive the same not-found outcome as a missing garden. Unauthenticated users MUST NOT access planting data.
- **FR-008**: When offline, owners and collaborators MUST be able to add, update, and remove plantings and named beds on-device immediately; those changes MUST sync when connectivity returns and MUST NOT be silently dropped. Unsynced work MUST show as pending. Failed sync MUST show as needs-attention (not success). Rapid repeats of the same action on an **existing** planting or bed MUST coalesce to the last intentional action. Planting remove still requires confirmation before it is queued. If the target planting no longer exists (another member already removed it), a pending update or remove MUST fail visibly and MUST NOT recreate that planting; a pending **add** MUST still create a new planting.
- **FR-009**: Previously loaded planting lists MUST remain readable offline for members (including viewers). After reconnect and a refresh, list contents MUST reflect current membership: a user removed while offline MUST NOT keep acting as a member (stale cache MUST NOT authorize new actions).
- **FR-010**: Catalog entries, personal favorites, and planting-calendar plans MUST NOT be deleted or altered when a planting is removed. Plantings MUST NOT appear on a personal favorites list unless the user also favorited the variety. Recording a planting MUST NOT automatically create or remove a calendar plan, and a calendar plan MUST NOT automatically become a planting.
- **FR-011**: If planted and harvest dates are both set, harvest date MUST NOT be earlier than planted date. Invalid pairs MUST be rejected with a clear message. The product MUST NOT reject a date solely because it is in the future.
- **FR-012**: A planting whose catalog variety is later unavailable MUST remain on the list with an unavailable-variety indicator; owners and collaborators MUST still be able to remove it.
- **FR-013**: The same catalog variety MAY appear as multiple plantings in one garden. Each planting is a separate record.
- **FR-014**: The feature MUST NOT include bed geometry, layout canvas, planting-calendar window math, care reminders, purchasing, or a count/quantity field beyond separate planting rows.
- **FR-015**: The default planting list MUST be grouped by named bed. Empty named beds MUST still appear as empty groups. Plantings with no bed MUST appear in a distinct Unassigned group only when at least one planting is unassigned. Members MUST be able to filter the view to a single bed without mutating the saved set. Within a group, plantings MUST appear newest-recorded-first (`createdAt` descending, not planted date). The grouped view MUST use the garden’s full planting set for that load (request `pageSize` 200 and fetch remaining pages when `total` exceeds the first page) so grouping is not truncated by pagination.

### Key Entities *(include if feature involves data)*

- **Planting**: A garden-scoped record that a catalog variety is in the ground or will be (recorded on this list), not a planting-calendar plan. Optional planted date, optional harvest date (each may be past, today, or future), optional named bed. Distinct from a calendar plan line and from a personal favorite. Identity is the planting record; the same variety may be recorded more than once in one garden. After confirmed delete, the planting is gone (no archived copy in this feature).
- **Named bed**: A label/container inside one garden (name unique within that garden after trim, case-insensitive). No geometry in this feature.
- **Garden** and **Plant** (catalog variety): Already defined in prior features; plantings reference them. Membership roles are unchanged from Household Gardens.

### Access Control *(mandatory when data is user-owned or shared)*

- **Roles / permissions**:
  - **Owner** and **collaborator**: create, read, update, and delete plantings and named beds.
  - **Viewer**: read plantings and bed names only.
  - **Non-member**: no access (same not-found as a missing garden).
- **Sharing rules**: Plantings and bed names are garden-shared among members. They are not globally visible. Favorites stay personal. Catalog plants remain readable by every authenticated user.
- **Isolation**: Garden A’s plantings and beds MUST never appear in Garden B or to non-members. A planting list is not a user-global “my plants” inventory.

### Offline / PWA Considerations *(include if feature has client behavior)*

- Read of previously loaded planting lists works offline.
- Owner/collaborator planting and bed mutations queue on-device and sync on reconnect; last intentional action per existing planting or bed wins when coalescing rapid repeats. A queued update or remove MUST NOT resurrect a planting another member already deleted.
- If sync fails, the item shows needs-attention (failed), not a success or a still-spinning pending-only state; the user is not told the change succeeded when it did not. Unsynced work that has not yet failed shows pending.
- Membership changes remain online-only (Household Gardens); a queued planting MUST NOT grant access to a garden the user was removed from.
- Planting-calendar add/remove stays online-only (Planting Calendar); this feature’s queue MUST NOT be used to mutate calendar plans.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: *(Usability study — not a CI gate. Technical first-load target is <2s on the local network after the garden is open; manual quickstart check only, not a CI coverage gate — see plan.md.)* At least 90% of participants can add a planting of a named variety to a garden and see it on the list in under 1 minute.
- **SC-002**: On fixtures, harvest-before-planted is rejected and prior values remain; a future planted date and a future harvest on or after planted save; canceling planting remove leaves the planting; confirming remove permanently deletes it with no restore path and leaves the catalog plant, favorites, and calendar plans intact (100%).
- **SC-003**: Named-bed assign/group/unassign and delete-bed-keeps-plantings behave correctly on fixtures (100%). Default view groups by bed with Unassigned distinct when needed; empty named beds still appear; filter to one bed hides other groups without deleting plantings; newest recorded planting (`createdAt`) in a group appears first (100%).
- **SC-004**: Non-members see 0 plantings (not-found, not an empty list of a garden they can name); viewers cannot mutate (100% on the role fixture).
- **SC-005**: Offline add then reconnect: the planting exists for another member within one successful sync cycle; pending is visible before sync. On fixtures, a pending update of a planting another member already removed does not recreate it and shows a visible failure (100%).
- **SC-006**: *(Usability study — not a CI gate.)* At least 85% of participants can tell which plantings are unassigned vs in a named bed.
- **SC-007**: On fixtures, adding the same variety twice yields two planting rows; adding from a personal favorite does not show that favorites list to another member (100%).
- **SC-008**: On a two-editor fixture, the later successful save of dates or bed assignment is the stored result after both saves; a following load shows that result (100%).

## Assumptions

- Household Gardens membership and the plant catalog already exist. Planting Calendar may exist; this feature still treats calendar plans and plantings as separate lists.
- “This season” is a household notion; v1 does not require a formal season object or automatic year rollover. Planted and harvest dates are specific calendar dates (with year) in the household’s local date sense, not annual month-day frost dates. They may be past, today, or future; unset means not dated.
- Multiple plantings of the same variety in one garden are allowed. v1 does not store a quantity/count on a planting; two dozen tomatoes are either one row or many rows, as the household chooses to record them.
- Planting calendar entries (plans) are not automatically turned into plantings; the gardener records plantings explicitly. There is no “convert this calendar row” action in v1.
- Layout designer will consume these plantings and named beds later; this feature only needs a list of named containers, not polygons.
- Care reminders will consume these plantings later; this feature does not generate reminders.
- Bed names follow the same length limit as garden names (120 characters after trim).
- Date values have no separate time-of-day or per-planting time zone in v1.
- Existing email-and-password accounts are reused; this feature does not add registration or third-party sign-in.
- Last-write-wins for online concurrent edits matches Household Gardens (no merge UI).
- Planting remove is permanent after confirm, matching garden delete in Household Gardens (no undelete or archive in this feature). The same variety MAY be recorded again as a new planting.
- Offline mutation queue matches personal favorites intent (queue-and-sync, pending visible), not Household Gardens membership (online-only) and not Planting Calendar plant-set changes (online-only). Queued updates do not resurrect a planting another member already removed.
